/**
 * Parses AI message content to detect and extract file data.
 *
 * Supports:
 * 1. CSV code blocks that can be converted to Excel:
 *    ```csv
 *    Header1,Header2
 *    value1,value2
 *    ```
 * 2. Base64-encoded files (XLSX files start with UEsDBB - PK zip header)
 */

export interface ParsedFile {
  filename: string;
  content: string;
  contentType: "csv" | "base64";
  startIndex: number;
  endIndex: number;
}

export interface ParsedContent {
  text: string;
  files: ParsedFile[];
}

// XLSX files in base64 start with PK zip header: UEsDBB
const XLSX_BASE64_START = "UEsDBB";

// Regex to match CSV code blocks: ```csv ... ```
const CSV_CODE_BLOCK_REGEX = /```csv\s*\n([\s\S]*?)\n```/gi;

// Regex to match general code blocks
const CODE_BLOCK_REGEX = /```(?:\w*)?\s*\n?([\s\S]*?)\n?```/g;

// Regex to extract filename from context
const FILENAME_REGEX = /[`'""]([^`'""]+\.(xlsx|xls|csv|json|txt|pdf))[`'""]/gi;

/**
 * Extracts a likely filename from text near the content
 */
function extractFilename(text: string, defaultExt: string = ".csv"): string {
  const matches = [...text.matchAll(FILENAME_REGEX)];
  if (matches.length > 0) {
    // Get the last match (closest to the content)
    let filename = matches[matches.length - 1][1];
    // Ensure it has .csv extension for CSV files
    if (defaultExt === ".csv" && !filename.endsWith(".csv")) {
      filename = filename.replace(/\.\w+$/, ".csv");
    }
    return filename;
  }

  // Generate a default filename
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `data_${timestamp}${defaultExt}`;
}

/**
 * Checks if content looks like valid CSV data
 */
function isValidCsv(content: string): boolean {
  const lines = content.trim().split("\n");

  // Must have at least 2 lines (header + data)
  if (lines.length < 2) {
    return false;
  }

  // First line should have commas (headers)
  const firstLine = lines[0];
  if (!firstLine.includes(",")) {
    return false;
  }

  // Check consistency of column count
  const headerColCount = firstLine.split(",").length;
  const dataLine = lines[1];
  const dataColCount = dataLine.split(",").length;

  // Allow some flexibility in column count
  return Math.abs(headerColCount - dataColCount) <= 1;
}

/**
 * Cleans base64 content
 */
function cleanBase64Content(content: string): string {
  return content
    .replace(/^[-=]+\s*/gm, "")
    .replace(/\s*[-=]+$/gm, "")
    .replace(/^base64,/i, "")
    .replace(/\s+/g, "");
}

/**
 * Checks if content is valid base64-encoded XLSX
 */
function isValidBase64Xlsx(content: string): boolean {
  const cleaned = cleanBase64Content(content);

  if (cleaned.length < 500) {
    return false;
  }

  if (!cleaned.startsWith(XLSX_BASE64_START)) {
    return false;
  }

  return /^[A-Za-z0-9+/]*={0,3}$/.test(cleaned);
}

/**
 * Parses message content and extracts downloadable files
 */
export function parseMessageContent(content: string): ParsedContent {
  const files: ParsedFile[] = [];
  let processedContent = content;

  // First, look for CSV code blocks (```csv ... ```)
  const csvMatches = [...content.matchAll(CSV_CODE_BLOCK_REGEX)];

  for (const match of csvMatches) {
    const csvContent = match[1].trim();

    if (!isValidCsv(csvContent)) {
      continue;
    }

    // Look for filename in context
    const contextStart = Math.max(0, match.index! - 300);
    const contextText = content.slice(contextStart, match.index!);
    const filename = extractFilename(contextText, ".csv");

    files.push({
      filename,
      content: csvContent,
      contentType: "csv",
      startIndex: match.index!,
      endIndex: match.index! + match[0].length,
    });
  }

  // Also check for base64-encoded XLSX files
  const codeBlockMatches = [...content.matchAll(CODE_BLOCK_REGEX)];

  for (const match of codeBlockMatches) {
    const blockContent = match[1];

    // Skip if we already processed this as CSV
    if (files.some(f => f.startIndex === match.index)) {
      continue;
    }

    if (!isValidBase64Xlsx(blockContent)) {
      continue;
    }

    const contextStart = Math.max(0, match.index! - 300);
    const contextText = content.slice(contextStart, match.index!);
    const filename = extractFilename(contextText, ".xlsx");

    files.push({
      filename,
      content: cleanBase64Content(blockContent),
      contentType: "base64",
      startIndex: match.index!,
      endIndex: match.index! + match[0].length,
    });
  }

  // Replace file blocks with placeholders
  if (files.length > 0) {
    const sortedFiles = [...files].sort((a, b) => b.startIndex - a.startIndex);

    for (const file of sortedFiles) {
      processedContent =
        processedContent.slice(0, file.startIndex) +
        processedContent.slice(file.endIndex);
    }

    // Clean up extra newlines
    processedContent = processedContent.replace(/\n{3,}/g, "\n\n").trim();
  }

  return {
    text: processedContent,
    files,
  };
}

/**
 * Checks if content contains downloadable file data
 */
export function hasBase64FileContent(content: string): boolean {
  // Check for CSV code blocks
  if (/```csv\s*\n/i.test(content)) {
    const matches = [...content.matchAll(CSV_CODE_BLOCK_REGEX)];
    if (matches.some(m => isValidCsv(m[1]))) {
      return true;
    }
  }

  // Check for base64 XLSX
  if (content.includes(XLSX_BASE64_START)) {
    const matches = [...content.matchAll(CODE_BLOCK_REGEX)];
    return matches.some(m => isValidBase64Xlsx(m[1]));
  }

  return false;
}
