import OpenAI from "openai";
import * as fs from "node:fs";
import * as path from "node:path";
import type { KimiMessage, KimiFileInfo, KimiUploadResponse, AnalysisResult } from "@kimi-excel/shared";
import { excelPlugin } from "../config/excel-plugin.js";

const KIMI_BASE_URL = "https://api.moonshot.ai/v1";

export class KimiClient {
  private client: OpenAI;

  constructor(apiKey: string) {
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
    } = {}
  ): Promise<AnalysisResult> {
    const {
      model = "kimi-k2-0905-preview",
      stream = true,
      onChunk,
      usePlugin = false,
    } = options;

    const fileInfo = await this.getFileInfo(fileId);

    let messages: KimiMessage[];

    if (usePlugin) {
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
    } else {
      const fileContent = await this.getFileContent(fileId);
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
      return this.streamAnalysis(messages, model, onChunk, usePlugin);
    } else {
      return this.nonStreamAnalysis(messages, model, usePlugin);
    }
  }

  private async streamAnalysis(
    messages: KimiMessage[],
    model: string,
    onChunk?: (chunk: string) => void,
    usePlugin = false
  ): Promise<AnalysisResult> {
    const requestParams: OpenAI.ChatCompletionCreateParamsStreaming = {
      model,
      messages: messages as unknown as OpenAI.ChatCompletionMessageParam[],
      temperature: 0.6,
      max_tokens: 8192,
      top_p: 1,
      stream: true,
    };

    if (usePlugin) {
      requestParams.tools = [excelPlugin] as unknown as OpenAI.ChatCompletionTool[];
    }

    const stream = await this.client.chat.completions.create(requestParams);

    let fullContent = "";
    const toolCalls: AnalysisResult["toolCalls"] = [];

    for await (const chunk of stream) {
      const choice = chunk.choices[0];

      if (choice?.delta?.content) {
        fullContent += choice.delta.content;
        onChunk?.(choice.delta.content);
      }

      if (choice?.delta?.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const existingCall = toolCalls.find((t) => t.index === tc.index);
          if (existingCall && tc.function?.arguments) {
            existingCall._plugin.arguments += tc.function.arguments;
          } else if (tc.id) {
            toolCalls.push({
              index: tc.index ?? toolCalls.length,
              id: tc.id,
              type: "_plugin",
              _plugin: {
                name: tc.function?.name ?? "",
                arguments: tc.function?.arguments ?? "",
              },
            });
          }
        }
      }
    }

    return { content: fullContent, toolCalls };
  }

  private async nonStreamAnalysis(
    messages: KimiMessage[],
    model: string,
    usePlugin = false
  ): Promise<AnalysisResult> {
    const requestParams: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: messages as unknown as OpenAI.ChatCompletionMessageParam[],
      temperature: 0.6,
      max_tokens: 8192,
      top_p: 1,
      stream: false,
    };

    if (usePlugin) {
      requestParams.tools = [excelPlugin] as unknown as OpenAI.ChatCompletionTool[];
    }

    const response = await this.client.chat.completions.create(requestParams);

    const choice = response.choices[0];
    const content = choice?.message?.content ?? "";
    const toolCalls: AnalysisResult["toolCalls"] = [];

    if (choice?.message?.tool_calls) {
      for (const [index, tc] of choice.message.tool_calls.entries()) {
        if (tc.function) {
          toolCalls.push({
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
    }

    return { content, toolCalls };
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
