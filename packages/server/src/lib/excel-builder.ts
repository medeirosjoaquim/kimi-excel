import ExcelJS from "exceljs";

interface WorkbookOptions {
  title?: string;
  subject?: string;
  description?: string;
}

/**
 * Create a new Excel workbook with metadata
 */
export function createWorkbook(options: WorkbookOptions = {}): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Kimi Excel";
  workbook.created = new Date();
  workbook.modified = new Date();

  if (options.title) {
    workbook.title = options.title;
  }
  if (options.subject) {
    workbook.subject = options.subject;
  }
  if (options.description) {
    workbook.description = options.description;
  }

  return workbook;
}

/**
 * Add a data sheet to a workbook
 */
export function addDataSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  data: unknown[][],
  headers?: string[]
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(sheetName);

  // Add headers if provided
  if (headers && headers.length > 0) {
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
  }

  // Add data rows
  for (const row of data) {
    worksheet.addRow(row);
  }

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellLength = cell.value?.toString().length || 0;
      maxLength = Math.max(maxLength, Math.min(cellLength + 2, 50));
    });
    column.width = maxLength;
  });

  return worksheet;
}

/**
 * Add a metadata sheet to a workbook
 */
export function addMetadataSheet(
  workbook: ExcelJS.Workbook,
  metadata: Record<string, unknown>
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet("Metadata");

  const headerRow = worksheet.addRow(["Property", "Value"]);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  for (const [key, value] of Object.entries(metadata)) {
    worksheet.addRow([key, String(value)]);
  }

  worksheet.getColumn(1).width = 20;
  worksheet.getColumn(2).width = 40;

  return worksheet;
}
