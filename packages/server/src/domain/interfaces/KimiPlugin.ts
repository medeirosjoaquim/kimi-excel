import type { ExcelPluginTool, KimiFileInfo } from "@kimi-excel/shared";

/**
 * Kimi Plugin Interface - Strategy Pattern
 *
 * Each plugin defines:
 * - Which file types it can handle
 * - The tool definition for Kimi API
 * - System prompts for the AI
 */
export interface KimiPlugin {
  /** Unique plugin identifier */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /** File extensions this plugin can process (e.g., ['.xlsx', '.xls', '.csv']) */
  readonly supportedExtensions: string[];

  /** MIME types this plugin can process */
  readonly supportedMimeTypes: string[];

  /**
   * Check if this plugin can process the given file
   */
  canProcess(file: KimiFileInfo): boolean;

  /**
   * Get the tool definition for Kimi API
   * Returns the plugin tool structure that Kimi understands
   */
  getToolDefinition(): ExcelPluginTool;

  /**
   * Get the system prompt for this plugin
   * Provides context to the AI about how to use this plugin
   */
  getSystemPrompt(fileCount: number): string;

  /**
   * Get file type from filename (for resource:file-info)
   */
  inferFileType(filename: string): string;
}

/**
 * Plugin context passed to analysis
 */
export interface PluginContext {
  plugin: KimiPlugin;
  files: KimiFileInfo[];
}
