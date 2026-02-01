import type { ExcelPluginTool } from "../types/kimi.js";

export const excelPlugin: ExcelPluginTool = {
  type: "_plugin",
  _plugin: {
    name: "excel",
    description:
      "An analysis tool for Excel and CSV files, providing file structure inspection, data statistical analysis, and pandas operation functions.",
    functions: [
      {
        name: "read_file",
        description:
          "Given an Excel or CSV file, outputs basic file information including sheet names, column headers, row count, etc.",
        parameters: {
          type: "object",
          properties: {
            file_id: {
              type: "string",
              description: "ID of the file to read",
            },
            sheet_name: {
              type: "string",
              description: "Sheet name (defaults to first sheet)",
            },
          },
          required: ["file_id"],
        },
      },
      {
        name: "head",
        description: "Outputs the first N rows of data from the file",
        parameters: {
          type: "object",
          properties: {
            file_id: {
              type: "string",
              description: "ID of the file to analyze",
            },
            n: {
              type: "integer",
              description: "Number of rows to view",
              default: 5,
            },
            sheet_name: {
              type: "string",
              description: "Sheet name (defaults to first sheet)",
            },
          },
          required: ["file_id"],
        },
      },
      {
        name: "tail",
        description: "Outputs the last N rows of data from the file",
        parameters: {
          type: "object",
          properties: {
            file_id: {
              type: "string",
              description: "ID of the file to analyze",
            },
            n: {
              type: "integer",
              description: "Number of rows to view",
              default: 5,
            },
            sheet_name: {
              type: "string",
              description: "Sheet name (defaults to first sheet)",
            },
          },
          required: ["file_id"],
        },
      },
      {
        name: "describe",
        description: "Outputs statistical description of numeric columns (count, mean, std, min, max, percentiles)",
        parameters: {
          type: "object",
          properties: {
            file_id: {
              type: "string",
              description: "ID of the file to analyze",
            },
            sheet_name: {
              type: "string",
              description: "Sheet name (defaults to first sheet)",
            },
          },
          required: ["file_id"],
        },
      },
      {
        name: "groupby",
        description: "Groups data by specified column and performs aggregation operations",
        parameters: {
          type: "object",
          properties: {
            file_id: {
              type: "string",
              description: "ID of the file to analyze",
            },
            by: {
              type: "string",
              description: "Column name to group by",
            },
            agg: {
              type: "object",
              description:
                'Aggregation configuration: {"column_name": "aggregation_function"}. Functions: sum, mean, count, min, max, std, median',
            },
            sheet_name: {
              type: "string",
              description: "Sheet name (defaults to first sheet)",
            },
            limit: {
              type: "integer",
              description: "Limit number of groups returned",
            },
          },
          required: ["file_id", "by", "agg"],
        },
      },
      {
        name: "filter",
        description: "Filters data based on conditions",
        parameters: {
          type: "object",
          properties: {
            file_id: {
              type: "string",
              description: "ID of the file to analyze",
            },
            conditions: {
              type: "string",
              description: "Filter conditions in pandas query format, e.g., 'age > 30 and city == \"NYC\"'",
            },
            sheet_name: {
              type: "string",
              description: "Sheet name (defaults to first sheet)",
            },
            limit: {
              type: "integer",
              description: "Limit number of rows returned",
            },
          },
          required: ["file_id", "conditions"],
        },
      },
      {
        name: "sort",
        description: "Sorts data by specified column(s)",
        parameters: {
          type: "object",
          properties: {
            file_id: {
              type: "string",
              description: "ID of the file to analyze",
            },
            by: {
              type: "string",
              description: "Column name to sort by",
            },
            ascending: {
              type: "boolean",
              description: "Sort in ascending order",
              default: true,
            },
            sheet_name: {
              type: "string",
              description: "Sheet name (defaults to first sheet)",
            },
            limit: {
              type: "integer",
              description: "Limit number of rows returned",
            },
          },
          required: ["file_id", "by"],
        },
      },
      {
        name: "value_counts",
        description: "Counts unique values in a column",
        parameters: {
          type: "object",
          properties: {
            file_id: {
              type: "string",
              description: "ID of the file to analyze",
            },
            column: {
              type: "string",
              description: "Column name to count values for",
            },
            sheet_name: {
              type: "string",
              description: "Sheet name (defaults to first sheet)",
            },
            limit: {
              type: "integer",
              description: "Limit number of unique values returned",
            },
          },
          required: ["file_id", "column"],
        },
      },
    ],
  },
};
