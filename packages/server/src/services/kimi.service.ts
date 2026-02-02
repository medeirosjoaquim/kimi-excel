import OpenAI from "openai";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  KimiMessage,
  KimiFileInfo,
  KimiUploadResponse,
  AnalysisResult,
  KimiPluginToolCall,
} from "@kimi-excel/shared";
import type { KimiPlugin } from "../domain/interfaces/KimiPlugin.js";
import { getPluginRegistry } from "../infrastructure/bootstrap.js";
import { logger } from "../lib/logger.js";

const KIMI_BASE_URL = "https://api.moonshot.ai/v1";
const MAX_TOOL_ITERATIONS = 10; // Prevent infinite loops
const log = logger.kimi;

// File generation instructions to be appended to all system prompts
const FILE_GENERATION_INSTRUCTIONS = `

## File Generation Rules
When asked to generate, create, export, or make an Excel/CSV file:

**YOU MUST:**
- Output the actual data directly as CSV text in a \`\`\`csv code block
- Include column headers as the first row
- Put actual data values, not code or placeholders

**YOU MUST NOT:**
- Write Python/code to generate the file - output the DATA directly
- Output base64 encoded content
- Provide fake download URLs (like file.io links)
- Tell users to run scripts

**Example:**
Here is your data. Save as \`filename.csv\`:
\`\`\`csv
Date,Product,Amount
2024-01-01,Widget,100
2024-01-02,Gadget,200
\`\`\`

The system will convert your CSV to a downloadable Excel file.`;

export interface AnalyzeOptions {
  model?: string;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
  onToolCall?: (toolCall: KimiPluginToolCall) => void;
  usePlugin?: boolean;
  abortSignal?: AbortSignal;
}

export interface ChatOptions extends AnalyzeOptions {
  history?: { role: "user" | "assistant"; content: string }[];
}

export class KimiService {
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
      log.error("File not found", { path: absolutePath });
      throw new Error(`File not found: ${absolutePath}`);
    }

    try {
      const file = fs.createReadStream(absolutePath);

      log.debug("Uploading file to Kimi", { path: absolutePath });
      const response = await this.client.files.create({
        file,
        purpose: "file-extract" as "assistants",
      });

      log.info("File uploaded successfully", {
        fileId: response.id,
        filename: response.filename,
      });
      return response as unknown as KimiUploadResponse;
    } catch (error) {
      log.error("Failed to upload file", {
        path: absolutePath,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
  }

  async getFileInfo(fileId: string): Promise<KimiFileInfo> {
    try {
      log.debug("Fetching file info", { fileId });
      const response = await this.client.files.retrieve(fileId);
      return response as unknown as KimiFileInfo;
    } catch (error) {
      log.error("Failed to fetch file info", {
        fileId,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
  }

  async listFiles(): Promise<KimiFileInfo[]> {
    try {
      log.debug("Listing files from Kimi");
      const response = await this.client.files.list();
      log.debug("Files listed successfully", { count: response.data.length });
      return response.data as unknown as KimiFileInfo[];
    } catch (error) {
      log.error("Failed to list files", {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      log.debug("Deleting file", { fileId });
      await this.client.files.del(fileId);
      log.info("File deleted successfully", { fileId });
    } catch (error) {
      log.error("Failed to delete file", {
        fileId,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
  }

  async getFileContent(fileId: string): Promise<string> {
    try {
      log.debug("Fetching file content", { fileId });
      const response = await this.client.files.content(fileId);
      const content = await response.text();
      log.debug("File content fetched successfully", {
        fileId,
        contentLength: content.length,
      });
      return content;
    } catch (error) {
      log.error("Failed to fetch file content", {
        fileId,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
  }

  async analyzeFile(
    fileId: string,
    question: string,
    options: AnalyzeOptions = {}
  ): Promise<AnalysisResult> {
    const {
      model = "kimi-k2-0905-preview",
      stream = true,
      onChunk,
      onToolCall,
      usePlugin = false,
    } = options;

    const fileInfo = await this.getFileInfo(fileId);

    // Get the appropriate plugin for this file
    const registry = getPluginRegistry();
    const plugin = usePlugin ? registry.getPluginForFile(fileInfo) : null;

    let messages: KimiMessage[];

    if (plugin) {
      messages = [
        {
          role: "system",
          content: plugin.getSystemPrompt(1),
        },
        {
          role: "system",
          content: JSON.stringify([
            {
              id: fileId,
              filename: fileInfo.filename,
              file_type: fileInfo.file_type || plugin.inferFileType(fileInfo.filename),
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
      return this.streamAnalysis(messages, model, onChunk, onToolCall, plugin ?? undefined, options.abortSignal);
    } else {
      return this.nonStreamAnalysis(messages, model, plugin ?? undefined);
    }
  }

  private async streamAnalysis(
    messages: KimiMessage[],
    model: string,
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolCall: KimiPluginToolCall) => void,
    plugin?: KimiPlugin,
    abortSignal?: AbortSignal
  ): Promise<AnalysisResult> {
    log.debug("Starting stream analysis", { model, messageCount: messages.length, hasPlugin: !!plugin });

    // Clone messages for the agentic loop
    const conversationMessages = [...messages];
    let fullContent = "";
    const allToolCalls: AnalysisResult["toolCalls"] = [];
    let iteration = 0;

    // Agentic loop: continue until no more tool calls or max iterations reached
    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;
      log.debug(`Agentic loop iteration ${iteration}`, { messageCount: conversationMessages.length });

      const requestParams: OpenAI.ChatCompletionCreateParamsStreaming = {
        model,
        messages: conversationMessages as unknown as OpenAI.ChatCompletionMessageParam[],
        temperature: 0.6,
        max_tokens: 8192,
        top_p: 1,
        stream: true,
      };

      if (plugin) {
        log.debug("Using plugin", { pluginName: plugin.name });
        requestParams.tools = [plugin.getToolDefinition()] as unknown as OpenAI.ChatCompletionTool[];
      }

      log.debug("Creating chat completion stream");
      let stream;
      try {
        stream = await this.client.chat.completions.create(requestParams);
        log.debug("Stream created successfully");
      } catch (error) {
        log.error("Failed to create chat completion stream", {
          iteration,
          model,
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : typeof error,
        });
        throw error;
      }

      let iterationContent = "";
      const iterationToolCalls: KimiPluginToolCall[] = [];
      const toolResults: Map<string, string> = new Map(); // Capture tool results from stream
      let chunkIndex = 0;

      try {
        for await (const chunk of stream) {
          chunkIndex++;
          // Check if aborted
          if (abortSignal?.aborted) {
            log.debug("Stream aborted by signal");
            throw new Error("ABORTED");
          }

          // Log full chunk structure for first few chunks and when interesting
          if (chunkIndex <= 3 || chunk.choices[0]?.finish_reason) {
            log.debug(`Stream chunk #${chunkIndex}`, {
              id: chunk.id,
              object: chunk.object,
              finish_reason: chunk.choices[0]?.finish_reason,
              choiceIndex: chunk.choices[0]?.index,
              hasContent: !!chunk.choices[0]?.delta?.content,
              hasToolCalls: !!chunk.choices[0]?.delta?.tool_calls,
              deltaKeys: Object.keys(chunk.choices[0]?.delta || {}),
            });
          }

          const choice = chunk.choices[0];

          // Extended delta type for Kimi-specific fields
          const delta = choice?.delta as {
            reasoning_content?: string;
            content?: string;
            tool_calls?: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall[];
            tool_result?: { tool_call_id: string; content: string }; // Potential Kimi field
          };

          // Log when we see unexpected fields
          const deltaKeys = Object.keys(delta || {}).filter(k =>
            (delta as Record<string, unknown>)[k] !== undefined &&
            (delta as Record<string, unknown>)[k] !== null
          );
          const expectedKeys = ['role', 'content', 'tool_calls', 'refusal'];
          const unexpectedKeys = deltaKeys.filter(k => !expectedKeys.includes(k));
          if (unexpectedKeys.length > 0) {
            log.info("Unexpected delta fields detected", {
              unexpectedKeys,
              allKeys: deltaKeys,
              chunkIndex
            });
          }

          // Handle reasoning_content (Kimi-specific field for thinking)
          if (delta?.reasoning_content) {
            log.debug("Reasoning content received", { length: delta.reasoning_content.length });
          }

          // Handle tool_result if Kimi provides it directly
          if (delta?.tool_result) {
            log.debug("Tool result received", { toolCallId: delta.tool_result.tool_call_id });
            toolResults.set(delta.tool_result.tool_call_id, delta.tool_result.content);
          }

          if (delta?.content) {
            iterationContent += delta.content;
            fullContent += delta.content;
            onChunk?.(delta.content);
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              // Kimi uses _plugin format, not function format
              const tcAny = tc as unknown as {
                index?: number;
                id?: string;
                type?: string;
                _plugin?: { name?: string; arguments?: string };
                function?: { name?: string; arguments?: string };
              };

              const existingCall = iterationToolCalls.find((t) => t.index === tcAny.index);

              if (existingCall) {
                // Accumulate arguments for existing tool call
                const newArgs = tcAny._plugin?.arguments ?? tcAny.function?.arguments;
                if (newArgs) {
                  existingCall._plugin.arguments += newArgs;
                }
                // Update id if we get it in a later chunk
                if (tcAny.id && existingCall.id.startsWith('pending_')) {
                  existingCall.id = tcAny.id;
                  allToolCalls.push(existingCall);
                  onToolCall?.(existingCall);
                }
              } else if (tcAny.index !== undefined) {
                // New tool call - extract name from _plugin or function format
                const toolName = tcAny._plugin?.name ?? tcAny.function?.name ?? "";
                const toolArgs = tcAny._plugin?.arguments ?? tcAny.function?.arguments ?? "";

                const newToolCall: KimiPluginToolCall = {
                  index: tcAny.index,
                  id: tcAny.id ?? `pending_${tcAny.index}`,
                  type: "_plugin",
                  _plugin: {
                    name: toolName,
                    arguments: toolArgs,
                  },
                };
                iterationToolCalls.push(newToolCall);

                // Only notify and track if we have an id
                if (tcAny.id) {
                  allToolCalls.push(newToolCall);
                  onToolCall?.(newToolCall);
                }

                log.debug("New tool call detected", {
                  index: tcAny.index,
                  id: tcAny.id,
                  name: toolName,
                  type: tcAny.type
                });
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message === "ABORTED") {
          log.debug("Stream aborted, returning partial result");
          return { content: fullContent, toolCalls: allToolCalls };
        }
        log.error("Error reading stream", {
          iteration,
          chunkIndex,
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : typeof error,
        });
        throw error;
      }

      log.debug(`Iteration ${iteration} completed`, {
        contentLength: iterationContent.length,
        toolCallCount: iterationToolCalls.length,
        totalChunks: chunkIndex,
        toolResultsCollected: toolResults.size,
      });

      // If no tool calls in this iteration, we're done
      if (iterationToolCalls.length === 0) {
        log.debug("No tool calls, ending agentic loop", { totalIterations: iteration });
        break;
      }

      // Tool calls were made - append assistant message with tool_calls to conversation
      log.debug("Tool calls received, continuing agentic loop", {
        toolCallCount: iterationToolCalls.length,
        tools: iterationToolCalls.map(tc => tc._plugin.name),
        hasToolResults: toolResults.size > 0,
      });

      // Add assistant message with tool_calls
      const assistantMessage: KimiMessage = {
        role: "assistant",
        content: iterationContent,
        tool_calls: iterationToolCalls,
      };
      conversationMessages.push(assistantMessage);

      // For _plugin tools executed by Kimi, we need to include tool result messages
      // Kimi's _plugin system executes tools server-side and provides results
      // The tool_call_id references Kimi's internal execution cache
      for (const toolCall of iterationToolCalls) {
        // Check if we captured results from the stream
        const resultContent = toolResults.get(toolCall.id);

        if (resultContent) {
          // We got results from the stream
          const toolResultMessage: KimiMessage = {
            role: "tool",
            content: resultContent,
            tool_call_id: toolCall.id,
          };
          conversationMessages.push(toolResultMessage);
          log.debug("Added tool result from stream", {
            toolCallId: toolCall.id,
            contentLength: resultContent.length
          });
        } else {
          // For _plugin tools, Kimi handles execution internally
          // Empty content works - Kimi uses the tool_call_id to reference its cached execution result
          const toolResultMessage: KimiMessage = {
            role: "tool",
            content: "", // Empty - Kimi fills with actual execution results
            tool_call_id: toolCall.id,
          };
          conversationMessages.push(toolResultMessage);
          log.debug("Added empty tool result for _plugin (Kimi fills internally)", {
            toolCallId: toolCall.id,
            toolName: toolCall._plugin.name
          });
        }
      }

      log.debug("Conversation updated for next iteration", {
        messageCount: conversationMessages.length
      });
    }

    if (iteration >= MAX_TOOL_ITERATIONS) {
      log.warn("Max tool iterations reached", { maxIterations: MAX_TOOL_ITERATIONS });
    }

    return { content: fullContent, toolCalls: allToolCalls };
  }

  private async nonStreamAnalysis(
    messages: KimiMessage[],
    model: string,
    plugin?: KimiPlugin
  ): Promise<AnalysisResult> {
    try {
      log.debug("Starting non-stream analysis", { model, messageCount: messages.length, hasPlugin: !!plugin });

      const requestParams: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages: messages as unknown as OpenAI.ChatCompletionMessageParam[],
        temperature: 0.6,
        max_tokens: 8192,
        top_p: 1,
        stream: false,
      };

      if (plugin) {
        requestParams.tools = [plugin.getToolDefinition()] as unknown as OpenAI.ChatCompletionTool[];
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

      log.debug("Non-stream analysis completed", { contentLength: content.length, toolCallCount: toolCalls.length });
      return { content, toolCalls };
    } catch (error) {
      log.error("Failed to complete non-stream analysis", {
        model,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
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

  async analyzeWithContext(
    fileIds: string[],
    question: string,
    options: ChatOptions = {}
  ): Promise<AnalysisResult> {
    const {
      model = "kimi-k2-0905-preview",
      stream = true,
      onChunk,
      onToolCall,
      usePlugin = false,
      history = [],
    } = options;

    log.info("analyzeWithContext called", { fileCount: fileIds.length, usePlugin, historyLength: history.length });

    // Get plugin registry
    const registry = getPluginRegistry();

    // Collect file info for all files
    log.debug("Fetching file info", { fileIds });
    const fileInfoList = await Promise.all(
      fileIds.map(async (fileId) => this.getFileInfo(fileId))
    );
    log.debug("File info fetched", { files: fileInfoList.map(f => f.filename) });

    // Find the appropriate plugin for these files (if using plugins)
    let plugin: KimiPlugin | null = null;
    if (usePlugin && fileIds.length > 0) {
      plugin = registry.getPluginForFiles(fileInfoList);
      log.debug("Plugin selected", { pluginName: plugin?.name ?? "none" });
    }

    // Build file info objects using plugin or fallback
    const fileInfos = fileInfoList.map((info, idx) => ({
      id: fileIds[idx],
      filename: info.filename,
      file_type: info.file_type || (plugin?.inferFileType(info.filename) ?? this.inferFileType(info.filename)),
    }));

    let messages: KimiMessage[];

    if (plugin && fileIds.length > 0) {
      messages = [
        {
          role: "system",
          content: plugin.getSystemPrompt(fileIds.length),
        },
        {
          role: "system",
          content: JSON.stringify(fileInfos),
          name: "resource:file-info",
        },
      ];
    } else if (fileIds.length > 0) {
      // Non-plugin mode: fetch and include file contents
      const fileContents = await Promise.all(
        fileIds.map(async (fileId, idx) => {
          const content = await this.getFileContent(fileId);
          return `=== File: ${fileInfos[idx].filename} ===\n${content}`;
        })
      );

      messages = [
        {
          role: "system",
          content:
            "You are a helpful data analysis assistant. Analyze the provided file data and answer questions about it accurately and concisely. When multiple files are provided, you can cross-reference data between them." +
            FILE_GENERATION_INSTRUCTIONS,
        },
        {
          role: "user",
          content: `Here are the contents of the files:\n\n${fileContents.join("\n\n---\n\n")}`,
        },
      ];
    } else {
      // No files, just general chat
      messages = [
        {
          role: "system",
          content:
            "You are a helpful data analysis assistant. You can analyze Excel and CSV files when they are provided. Answer questions accurately and concisely." +
            FILE_GENERATION_INSTRUCTIONS,
        },
      ];
    }

    // Add conversation history
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current question
    messages.push({
      role: "user",
      content: question,
    });

    log.debug("Messages prepared", { messageCount: messages.length, stream });

    if (stream) {
      return this.streamAnalysis(messages, model, onChunk, onToolCall, plugin ?? undefined, options.abortSignal);
    } else {
      return this.nonStreamAnalysis(messages, model, plugin ?? undefined);
    }
  }
}

let kimiServiceInstance: KimiService | null = null;

export function getKimiService(): KimiService {
  if (!kimiServiceInstance) {
    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey) {
      throw new Error("MOONSHOT_API_KEY environment variable is required");
    }
    kimiServiceInstance = new KimiService(apiKey);
  }
  return kimiServiceInstance;
}
