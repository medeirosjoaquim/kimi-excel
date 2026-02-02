/**
 * Local executor for Excel tool operations.
 * Since we can't execute server-side plugins, we execute tools locally
 * using the file content retrieved from Kimi's files API.
 */

export interface ExcelToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface ParsedExcelData {
  headers: string[];
  rows: Array<Record<string, unknown>>;
  totalRows: number;
}

/**
 * Parse file content (extracted from Kimi's files.content API) into structured data.
 * The content format depends on how Kimi extracts files - typically markdown or plain text.
 */
export function parseFileContent(content: string): ParsedExcelData {
  const lines = content.trim().split("\n");
  const headers: string[] = [];
  const rows: Array<Record<string, unknown>> = [];

  // Try to detect if it's a markdown table or plain text
  const isMarkdownTable = lines.some((line) => line.includes("|"));

  if (isMarkdownTable) {
    // Parse markdown table format
    let headerParsed = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("---") || /^\|[-:\s|]+\|$/.test(trimmed)) {
        continue;
      }
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        const cells = trimmed
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        if (!headerParsed) {
          headers.push(...cells);
          headerParsed = true;
        } else {
          const row: Record<string, unknown> = {};
          cells.forEach((cell, i) => {
            row[headers[i] || `col_${i}`] = parseValue(cell);
          });
          rows.push(row);
        }
      }
    }
  } else {
    // Try CSV-like format
    const firstLine = lines[0];
    if (firstLine) {
      const delimiter = firstLine.includes("\t") ? "\t" : ",";
      const headerCells = firstLine.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
      headers.push(...headerCells);

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cells = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
        const row: Record<string, unknown> = {};
        cells.forEach((cell, idx) => {
          row[headers[idx] || `col_${idx}`] = parseValue(cell);
        });
        rows.push(row);
      }
    }
  }

  return { headers, rows, totalRows: rows.length };
}

function parseValue(val: string): unknown {
  if (val === "" || val === "null" || val === "NULL") return null;
  const num = Number(val);
  if (!isNaN(num) && val !== "") return num;
  if (val.toLowerCase() === "true") return true;
  if (val.toLowerCase() === "false") return false;
  return val;
}

/**
 * Execute an Excel tool operation locally
 */
export function executeExcelTool(
  toolName: string,
  args: Record<string, unknown>,
  fileContent: string
): ExcelToolResult {
  try {
    const data = parseFileContent(fileContent);

    switch (toolName) {
      case "excel_read_file":
      case "read_file":
        return {
          success: true,
          data: {
            columns: data.headers,
            column_count: data.headers.length,
            row_count: data.totalRows,
            sample_values: data.headers.reduce(
              (acc, h) => {
                acc[h] = data.rows.slice(0, 3).map((r) => r[h]);
                return acc;
              },
              {} as Record<string, unknown[]>
            ),
          },
        };

      case "excel_head":
      case "head":
        const headN = (args.n as number) || 5;
        return {
          success: true,
          data: {
            columns: data.headers,
            rows: data.rows.slice(0, headN),
            total_rows: data.totalRows,
          },
        };

      case "excel_tail":
      case "tail":
        const tailN = (args.n as number) || 5;
        return {
          success: true,
          data: {
            columns: data.headers,
            rows: data.rows.slice(-tailN),
            total_rows: data.totalRows,
          },
        };

      case "excel_describe":
      case "describe":
        const stats: Record<string, Record<string, number>> = {};
        for (const header of data.headers) {
          const values = data.rows.map((r) => r[header]).filter((v) => typeof v === "number") as number[];
          if (values.length > 0) {
            const sorted = [...values].sort((a, b) => a - b);
            const sum = values.reduce((a, b) => a + b, 0);
            const mean = sum / values.length;
            const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
            stats[header] = {
              count: values.length,
              mean: Math.round(mean * 100) / 100,
              std: Math.round(Math.sqrt(variance) * 100) / 100,
              min: sorted[0],
              max: sorted[sorted.length - 1],
              "25%": sorted[Math.floor(sorted.length * 0.25)],
              "50%": sorted[Math.floor(sorted.length * 0.5)],
              "75%": sorted[Math.floor(sorted.length * 0.75)],
            };
          }
        }
        return { success: true, data: stats };

      case "excel_value_counts":
      case "value_counts":
        const column = args.column as string;
        const limit = (args.limit as number) || 10;
        if (!column) return { success: false, error: "column is required" };
        const counts: Record<string, number> = {};
        for (const row of data.rows) {
          const val = String(row[column] ?? "null");
          counts[val] = (counts[val] || 0) + 1;
        }
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit);
        return { success: true, data: Object.fromEntries(sorted) };

      case "excel_filter":
      case "filter":
        // Simple filter implementation - just return a subset for now
        const filterLimit = (args.limit as number) || 10;
        return {
          success: true,
          data: {
            note: "Filter conditions not fully implemented locally",
            conditions: args.conditions,
            sample_rows: data.rows.slice(0, filterLimit),
          },
        };

      case "excel_groupby":
      case "groupby":
        const groupBy = args.by as string;
        const agg = args.agg as Record<string, string>;
        const groupLimit = (args.limit as number) || 10;
        if (!groupBy) return { success: false, error: "by is required" };

        const groups: Record<string, Array<Record<string, unknown>>> = {};
        for (const row of data.rows) {
          const key = String(row[groupBy] ?? "null");
          if (!groups[key]) groups[key] = [];
          groups[key].push(row);
        }

        const result: Array<Record<string, unknown>> = [];
        for (const [key, groupRows] of Object.entries(groups).slice(0, groupLimit)) {
          const aggResult: Record<string, unknown> = { [groupBy]: key };
          if (agg) {
            for (const [col, func] of Object.entries(agg)) {
              const values = groupRows.map((r) => r[col]).filter((v) => typeof v === "number") as number[];
              if (values.length > 0) {
                switch (func) {
                  case "sum":
                    aggResult[`${col}_sum`] = values.reduce((a, b) => a + b, 0);
                    break;
                  case "mean":
                    aggResult[`${col}_mean`] = values.reduce((a, b) => a + b, 0) / values.length;
                    break;
                  case "count":
                    aggResult[`${col}_count`] = values.length;
                    break;
                  case "min":
                    aggResult[`${col}_min`] = Math.min(...values);
                    break;
                  case "max":
                    aggResult[`${col}_max`] = Math.max(...values);
                    break;
                }
              }
            }
          }
          result.push(aggResult);
        }
        return { success: true, data: result };

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
