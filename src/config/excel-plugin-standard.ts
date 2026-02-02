import type OpenAI from "openai";

// Standard OpenAI-compatible tool format for Excel operations
// These can be used with Kimi's tool call system using type: "function"
export const excelToolsStandard: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "excel_read_file",
      description:
        "Read basic information about an Excel or CSV file including sheet names, column headers, row count, etc.",
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
  },
  {
    type: "function",
    function: {
      name: "excel_head",
      description: "Get the first N rows of data from the file",
      parameters: {
        type: "object",
        properties: {
          file_id: {
            type: "string",
            description: "ID of the file to analyze",
          },
          n: {
            type: "integer",
            description: "Number of rows to view (default: 5)",
          },
          sheet_name: {
            type: "string",
            description: "Sheet name (defaults to first sheet)",
          },
        },
        required: ["file_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "excel_describe",
      description:
        "Get statistical description of numeric columns (count, mean, std, min, max, percentiles)",
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
  },
  {
    type: "function",
    function: {
      name: "excel_groupby",
      description: "Group data by specified column and perform aggregation operations",
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
  },
  {
    type: "function",
    function: {
      name: "excel_filter",
      description: "Filter data based on conditions",
      parameters: {
        type: "object",
        properties: {
          file_id: {
            type: "string",
            description: "ID of the file to analyze",
          },
          conditions: {
            type: "string",
            description:
              'Filter conditions in pandas query format, e.g., \'age > 30 and city == "NYC"\'',
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
  },
  {
    type: "function",
    function: {
      name: "excel_value_counts",
      description: "Count unique values in a column",
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
  },
];

// Kimi's built-in file analysis tool (if available)
// Based on builtin_function format like $web_search
export const kimiBuiltinFileReader: OpenAI.ChatCompletionTool = {
  type: "function", // Note: might need to be "builtin_function" depending on Kimi's API
  function: {
    name: "$file_reader", // Speculative - need to verify actual name
    description: "Read and analyze uploaded files",
  },
} as OpenAI.ChatCompletionTool;
