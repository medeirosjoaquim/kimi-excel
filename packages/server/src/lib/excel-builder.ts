import ExcelJS from "exceljs";

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
 * Add a data sheet to the workbook
 */
export function addDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  data: unknown[][],
  headers?: string[]
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name);

  // Add headers if provided
  if (headers && headers.length > 0) {
    sheet.addRow(headers);
    formatHeaders(sheet);
  }

  // Add data rows
  for (const row of data) {
    sheet.addRow(row);
  }

  // Auto-size columns
  autoSizeColumns(sheet);

  return sheet;
}

/**
 * Format header row with bold text and background color
 */
export function formatHeaders(sheet: ExcelJS.Worksheet): void {
  const headerRow = sheet.getRow(1);

  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  headerRow.alignment = {
    vertical: "middle",
    horizontal: "left",
  };

  headerRow.height = 20;
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
