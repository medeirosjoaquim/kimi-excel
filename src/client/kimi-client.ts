import OpenAI from "openai";
import * as fs from "node:fs";
import * as path from "node:path";
import type { KimiMessage, KimiFileInfo, KimiUploadResponse, AnalysisResult } from "../types/kimi.js";
import { excelPlugin } from "../config/excel-plugin.js";
import { excelToolsStandard } from "../config/excel-plugin-standard.js";
import { executeExcelTool } from "../utils/excel-executor.js";

const KIMI_BASE_URL = "https://api.moonshot.ai/v1";

export class KimiClient {
  private client: OpenAI;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new OpenAI({
      apiKey,
      baseURL: KIMI_BASE_URL,
    });
  }

  async uploadFile(filePath: string): Promise<KimiUploadResponse> {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const file = fs.createReadStream(absolutePath);

    const response = await this.client.files.create({
      file,
      purpose: "file-extract" as "assistants",
    });

    return response as unknown as KimiUploadResponse;
  }

  async getFileInfo(fileId: string): Promise<KimiFileInfo> {
    const response = await this.client.files.retrieve(fileId);
    return response as unknown as KimiFileInfo;
  }

  async listFiles(): Promise<KimiFileInfo[]> {
    const response = await this.client.files.list();
    return response.data as unknown as KimiFileInfo[];
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.client.files.del(fileId);
  }

  async getFileContent(fileId: string): Promise<string> {
    const response = await this.client.files.content(fileId);
    return response.text();
  }

  async analyzeFile(
    fileId: string,
    question: string,
    options: {
      model?: string;
      stream?: boolean;
      onChunk?: (chunk: string) => void;
      usePlugin?: boolean;
      useStandardTools?: boolean; // Use standard OpenAI tool format with local execution
    } = {}
  ): Promise<AnalysisResult> {
    const {
      model = "kimi-k2-0905-preview",
      stream = true,
      onChunk,
      usePlugin = false,
      useStandardTools = true, // Default to standard tools with local execution
    } = options;

    const fileInfo = await this.getFileInfo(fileId);

    // Always fetch file content - needed for local tool execution
    const fileContent = await this.getFileContent(fileId);

    let messages: KimiMessage[];

    if (usePlugin && !useStandardTools) {
      // Original _plugin format (may not work with Kimi API)
      messages = [
        {
          role: "system",
          content: "You are a helpful data analysis assistant. Analyze the provided Excel/CSV file and answer questions about it. Use the excel plugin tools to read and analyze the data.",
        },
        {
          role: "system",
          content: JSON.stringify([
            {
              id: fileId,
              filename: fileInfo.filename,
              file_type: fileInfo.file_type || this.inferFileType(fileInfo.filename),
            },
          ]),
          name: "resource:file-info",
        },
        {
          role: "user",
          content: question,
        },
      ];
    } else if (usePlugin && useStandardTools) {
      // Standard OpenAI tool format with local execution
      messages = [
        {
          role: "system",
          content: `You are a helpful data analysis assistant. You have access to Excel analysis tools to analyze the uploaded file.
The file "${fileInfo.filename}" (ID: ${fileId}) has been uploaded and is ready for analysis.
Use the excel tools to read, analyze, and answer questions about the data.
Always use the file_id "${fileId}" when calling tools.`,
        },
        {
          role: "user",
          content: question,
        },
      ];
    } else {
      // No plugin - embed file content directly
      messages = [
        {
          role: "system",
          content: "You are a helpful data analysis assistant. Analyze the provided file data and answer questions about it accurately and concisely.",
        },
        {
          role: "user",
          content: `Here is the content of the file "${fileInfo.filename}":\n\n${fileContent}\n\n---\n\nQuestion: ${question}`,
        },
      ];
    }

    if (stream) {
      return this.streamAnalysis(messages, model, onChunk, usePlugin, useStandardTools, fileContent);
    } else {
      return this.nonStreamAnalysis(messages, model, usePlugin, useStandardTools, fileContent);
    }
  }

  private async streamAnalysis(
    messages: KimiMessage[],
    model: string,
    onChunk?: (chunk: string) => void,
    usePlugin = false,
    useStandardTools = true,
    fileContent = ""
  ): Promise<AnalysisResult> {
    const conversationMessages = [...messages];
    let fullContent = "";
    const allToolCalls: AnalysisResult["toolCalls"] = [];
    const MAX_TOOL_ITERATIONS = 10;
    let iteration = 0;

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const requestParams: OpenAI.ChatCompletionCreateParamsStreaming = {
        model,
        messages: conversationMessages as unknown as OpenAI.ChatCompletionMessageParam[],
        temperature: 0.6,
        max_tokens: 8192,
        top_p: 1,
        stream: true,
      };

      if (usePlugin) {
        if (useStandardTools) {
          // Use standard OpenAI-compatible tool format
          requestParams.tools = excelToolsStandard;
        } else {
          // Use original _plugin format (may not work)
          requestParams.tools = [excelPlugin] as unknown as OpenAI.ChatCompletionTool[];
        }
      }

      const stream = await this.client.chat.completions.create(requestParams);

      let iterationContent = "";
      const iterationToolCalls: Array<{
        index: number;
        id: string;
        name: string;
        arguments: string;
      }> = [];
      let finishReason: string | null = null;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];

        if (choice?.delta?.content) {
          iterationContent += choice.delta.content;
          fullContent += choice.delta.content;
          onChunk?.(choice.delta.content);
        }

        if (choice?.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const existingCall = iterationToolCalls.find((t) => t.index === tc.index);
            if (existingCall && tc.function?.arguments) {
              existingCall.arguments += tc.function.arguments;
            } else if (tc.id) {
              iterationToolCalls.push({
                index: tc.index ?? iterationToolCalls.length,
                id: tc.id,
                name: tc.function?.name ?? "",
                arguments: tc.function?.arguments ?? "",
              });
            }
          }
        }

        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }

      // If no tool calls, we're done
      if (finishReason !== "tool_calls" || iterationToolCalls.length === 0) {
        break;
      }

      // Convert to our format and collect
      for (const tc of iterationToolCalls) {
        allToolCalls.push({
          index: tc.index,
          id: tc.id,
          type: "_plugin",
          _plugin: {
            name: tc.name,
            arguments: tc.arguments,
          },
        });
      }

      // Add assistant message with tool_calls to conversation (OpenAI format)
      conversationMessages.push({
        role: "assistant",
        content: iterationContent || "",
        tool_calls: iterationToolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      } as unknown as KimiMessage);

      // Execute tools locally and send results back
      for (const tc of iterationToolCalls) {
        let toolResult: string;

        if (useStandardTools && fileContent) {
          // Execute tool locally using file content
          const args = JSON.parse(tc.arguments || "{}");
          const result = executeExcelTool(tc.name, args, fileContent);
          toolResult = JSON.stringify(result.success ? result.data : { error: result.error });
        } else {
          // Fallback: send acknowledgment (may not work for all tools)
          toolResult = JSON.stringify({ status: "executed", tool: tc.name });
        }

        const toolMessage: KimiMessage = {
          role: "tool",
          content: toolResult,
          tool_call_id: tc.id,
        };
        conversationMessages.push(toolMessage);
      }
    }

    return { content: fullContent, toolCalls: allToolCalls };
  }

  private async nonStreamAnalysis(
    messages: KimiMessage[],
    model: string,
    usePlugin = false,
    useStandardTools = true,
    fileContent = ""
  ): Promise<AnalysisResult> {
    const conversationMessages = [...messages];
    let fullContent = "";
    const allToolCalls: AnalysisResult["toolCalls"] = [];
    const MAX_TOOL_ITERATIONS = 10;
    let iteration = 0;

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const requestParams: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages: conversationMessages as unknown as OpenAI.ChatCompletionMessageParam[],
        temperature: 0.6,
        max_tokens: 8192,
        top_p: 1,
        stream: false,
      };

      if (usePlugin) {
        if (useStandardTools) {
          requestParams.tools = excelToolsStandard;
        } else {
          requestParams.tools = [excelPlugin] as unknown as OpenAI.ChatCompletionTool[];
        }
      }

      const response = await this.client.chat.completions.create(requestParams);
      const choice = response.choices[0];
      const content = choice?.message?.content ?? "";
      fullContent += content;

      const finishReason = choice?.finish_reason;
      const toolCalls = choice?.message?.tool_calls ?? [];

      // If no tool calls, we're done
      if (finishReason !== "tool_calls" || toolCalls.length === 0) {
        break;
      }

      // Collect tool calls
      const iterationToolCalls: Array<{
        index: number;
        id: string;
        name: string;
        arguments: string;
      }> = [];

      for (const [index, tc] of toolCalls.entries()) {
        if (tc.function) {
          iterationToolCalls.push({
            index,
            id: tc.id,
            name: tc.function.name ?? "",
            arguments: tc.function.arguments ?? "",
          });
          allToolCalls.push({
            index,
            id: tc.id,
            type: "_plugin",
            _plugin: {
              name: tc.function.name ?? "",
              arguments: tc.function.arguments ?? "",
            },
          });
        }
      }

      // Add assistant message with tool_calls to conversation (OpenAI format)
      conversationMessages.push({
        role: "assistant",
        content: content || "",
        tool_calls: iterationToolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      } as unknown as KimiMessage);

      // Execute tools locally and send results back
      for (const tc of iterationToolCalls) {
        let toolResult: string;

        if (useStandardTools && fileContent) {
          // Execute tool locally using file content
          const args = JSON.parse(tc.arguments || "{}");
          const result = executeExcelTool(tc.name, args, fileContent);
          toolResult = JSON.stringify(result.success ? result.data : { error: result.error });
        } else {
          // Fallback: send acknowledgment (may not work for all tools)
          toolResult = JSON.stringify({ status: "executed", tool: tc.name });
        }

        const toolMessage: KimiMessage = {
          role: "tool",
          content: toolResult,
          tool_call_id: tc.id,
        };
        conversationMessages.push(toolMessage);
      }
    }

    return { content: fullContent, toolCalls: allToolCalls };
  }

  private inferFileType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
      ".csv": "text/csv",
      ".tsv": "text/tab-separated-values",
    };
    return mimeTypes[ext] ?? "application/octet-stream";
  }
}
