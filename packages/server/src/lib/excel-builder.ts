import ExcelJS from "exceljs";

// Style definitions for different row types
const STYLES = {
  // Section headers - single cell titles like "Overview", "Key Insights"
  sectionHeader: {
    font: { bold: true, size: 12, color: { argb: "FF1F4E79" } },
    fill: {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FFD6E3F8" },
    },
    border: {
      bottom: { style: "medium" as const, color: { argb: "FF1F4E79" } },
    },
  },
  // Table headers - multi-column headers like "Status | Count | Percentage"
  tableHeader: {
    font: { bold: true, size: 10, color: { argb: "FFFFFFFF" } },
    fill: {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FF2F5496" },
    },
    border: {
      bottom: { style: "thin" as const, color: { argb: "FF1F4E79" } },
    },
  },
  // Title row - main document title
  titleRow: {
    font: { bold: true, size: 14, color: { argb: "FF1F4E79" } },
    fill: {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FFFFFFFF" },
    },
    border: {
      bottom: { style: "thick" as const, color: { argb: "FF1F4E79" } },
    },
  },
};

// Common table header patterns to detect
const TABLE_HEADER_PATTERNS = [
  ["metric", "value"],
  ["status", "count"],
  ["contributor", "pr count", "role"],
  ["pr number", "title", "status"],
  ["name", "value"],
  ["key", "value"],
  ["item", "description"],
  ["category", "count"],
  ["field", "value"],
];

/**
 * Detect if a row is a section header (single value, typically a title)
 */
function isSectionHeader(row: unknown[], nextRow?: unknown[]): boolean {
  // Count non-empty cells
  const nonEmptyCells = row.filter(
    (cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""
  );

  // Section header: single non-empty cell
  if (nonEmptyCells.length !== 1) return false;

  const value = String(nonEmptyCells[0]).trim().toLowerCase();

  // Check if the next row looks like a table header (multiple values)
  if (nextRow) {
    const nextNonEmpty = nextRow.filter(
      (cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""
    );
    // If next row has multiple values, this is likely a section header
    if (nextNonEmpty.length >= 2) return true;
  }

  // Common section header keywords
  const sectionKeywords = [
    "overview",
    "summary",
    "details",
    "insights",
    "distribution",
    "contributors",
    "themes",
    "work",
    "priority",
    "recent",
    "active",
    "common",
    "key",
    "total",
    "analysis",
    "breakdown",
    "statistics",
    "metrics",
    "results",
  ];

  return sectionKeywords.some((keyword) => value.includes(keyword));
}

/**
 * Detect if a row is a table header (multiple columns with header-like values)
 */
function isTableHeader(row: unknown[], prevRow?: unknown[]): boolean {
  // Count non-empty cells
  const nonEmptyCells = row.filter(
    (cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""
  );

  // Table header needs at least 2 columns
  if (nonEmptyCells.length < 2) return false;

  // Check if all non-empty values are short strings (typical for headers)
  const allShortStrings = nonEmptyCells.every((cell) => {
    const str = String(cell).trim();
    return str.length > 0 && str.length <= 30 && !/^\d+(\.\d+)?%?$/.test(str);
  });

  if (!allShortStrings) return false;

  // Check against known patterns
  const rowLower = row.map((cell) =>
    cell !== null && cell !== undefined ? String(cell).trim().toLowerCase() : ""
  );

  for (const pattern of TABLE_HEADER_PATTERNS) {
    const matches = pattern.every((p) => rowLower.some((cell) => cell.includes(p)));
    if (matches) return true;
  }

  // Check if previous row was a section header or empty
  if (prevRow) {
    const prevNonEmpty = prevRow.filter(
      (cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""
    );
    // If previous row is empty or a section header, this might be a table header
    if (prevNonEmpty.length <= 1) return true;
  }

  return false;
}

/**
 * Create a new Excel workbook with metadata
 */
export function createWorkbook(metadata?: {
  creator?: string;
  title?: string;
  subject?: string;
  description?: string;
}): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = metadata?.creator || "Kimi Excel";
  workbook.created = new Date();
  workbook.modified = new Date();

  if (metadata?.title) workbook.title = metadata.title;
  if (metadata?.subject) workbook.subject = metadata.subject;
  if (metadata?.description) workbook.description = metadata.description;

  return workbook;
}

/**
 * Add a data sheet to the workbook with smart header detection
 */
export function addDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  data: unknown[][],
  headers?: string[]
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name);

  // Add explicit headers if provided
  if (headers && headers.length > 0) {
    sheet.addRow(headers);
    formatTableHeaderRow(sheet, 1, headers.length);
  }

  // Add data rows with smart formatting
  const startRow = headers ? 2 : 1;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const prevRow = i > 0 ? data[i - 1] : undefined;
    const nextRow = i < data.length - 1 ? data[i + 1] : undefined;

    sheet.addRow(row);
    const excelRowNum = startRow + i;

    // Check if this is the first row and looks like a main title
    if (i === 0 && isMainTitle(row)) {
      formatTitleRow(sheet, excelRowNum, row.length);
    }
    // Check if this is a section header
    else if (isSectionHeader(row, nextRow)) {
      formatSectionHeaderRow(sheet, excelRowNum, row.length);
    }
    // Check if this is a table header
    else if (isTableHeader(row, prevRow)) {
      formatTableHeaderRow(sheet, excelRowNum, row.length);
    }
  }

  // Auto-size columns
  autoSizeColumns(sheet);

  return sheet;
}

/**
 * Check if row is the main document title
 */
function isMainTitle(row: unknown[]): boolean {
  const nonEmpty = row.filter(
    (cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""
  );
  if (nonEmpty.length !== 1) return false;

  const value = String(nonEmpty[0]).trim().toLowerCase();
  return (
    value.includes("summary") ||
    value.includes("report") ||
    value.includes("analysis") ||
    value.includes("status") ||
    value.length > 15
  );
}

/**
 * Format a row as a main title
 */
function formatTitleRow(sheet: ExcelJS.Worksheet, rowNum: number, colCount: number): void {
  const row = sheet.getRow(rowNum);

  row.font = STYLES.titleRow.font;
  row.fill = STYLES.titleRow.fill;
  row.height = 25;

  // Apply bottom border to used cells
  for (let i = 1; i <= Math.max(colCount, 4); i++) {
    const cell = row.getCell(i);
    cell.border = STYLES.titleRow.border;
  }
}

/**
 * Format a row as a section header
 */
function formatSectionHeaderRow(sheet: ExcelJS.Worksheet, rowNum: number, colCount: number): void {
  const row = sheet.getRow(rowNum);

  row.font = STYLES.sectionHeader.font;
  row.fill = STYLES.sectionHeader.fill;
  row.height = 22;

  // Apply bottom border to used cells
  for (let i = 1; i <= Math.max(colCount, 4); i++) {
    const cell = row.getCell(i);
    cell.border = STYLES.sectionHeader.border;
  }
}

/**
 * Format a row as a table header
 */
function formatTableHeaderRow(sheet: ExcelJS.Worksheet, rowNum: number, colCount: number): void {
  const row = sheet.getRow(rowNum);

  row.font = STYLES.tableHeader.font;
  row.fill = STYLES.tableHeader.fill;
  row.height = 20;

  row.alignment = {
    vertical: "middle",
    horizontal: "left",
  };

  // Apply border to used cells
  for (let i = 1; i <= colCount; i++) {
    const cell = row.getCell(i);
    cell.border = STYLES.tableHeader.border;
  }
}

/**
 * Format header row with bold text and background color (legacy, uses new table header style)
 */
export function formatHeaders(sheet: ExcelJS.Worksheet): void {
  const headerRow = sheet.getRow(1);
  const colCount = headerRow.cellCount || 10;

  headerRow.font = STYLES.tableHeader.font;
  headerRow.fill = STYLES.tableHeader.fill;

  headerRow.alignment = {
    vertical: "middle",
    horizontal: "left",
  };

  headerRow.height = 20;

  // Apply border to cells
  for (let i = 1; i <= colCount; i++) {
    const cell = headerRow.getCell(i);
    if (cell.value) {
      cell.border = STYLES.tableHeader.border;
    }
  }
}

/**
 * Auto-size columns based on content
 */
export function autoSizeColumns(sheet: ExcelJS.Worksheet): void {
  sheet.columns.forEach((column) => {
    if (!column.eachCell) return;

    let maxLength = 10; // Minimum width

    column.eachCell({ includeEmpty: false }, (cell) => {
      const cellValue = cell.value?.toString() || "";
      const cellLength = cellValue.length;

      if (cellLength > maxLength) {
        maxLength = cellLength;
      }
    });

    // Set column width (max 50 characters)
    column.width = Math.min(maxLength + 2, 50);
  });
}

/**
 * Add a metadata sheet with key-value pairs
 */
export function addMetadataSheet(
  workbook: ExcelJS.Workbook,
  metadata: Record<string, string | number | boolean>
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet("Metadata");

  // Add headers
  sheet.addRow(["Key", "Value"]);
  formatHeaders(sheet);

  // Add metadata rows
  for (const [key, value] of Object.entries(metadata)) {
    sheet.addRow([key, value]);
  }

  // Auto-size columns
  autoSizeColumns(sheet);

  return sheet;
}
