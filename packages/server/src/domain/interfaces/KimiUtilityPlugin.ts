import type { UtilityPluginTool } from "@kimi-excel/shared";

/**
 * Kimi Utility Plugin Interface
 *
 * Unlike file-based plugins, utility plugins provide tools that are always
 * available and don't require file uploads. They handle general purpose
 * operations like timezone conversion, calculations, etc.
 *
 * These plugins execute their tools server-side (not via Kimi's built-in plugins).
 */
export interface KimiUtilityPlugin {
  /** Unique plugin identifier */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /**
   * Whether this plugin should be automatically included in all requests
   * When true, the plugin tools are always available
   */
  readonly autoInclude: boolean;

  /**
   * Check if this plugin can handle a specific function name
   */
  canHandle(functionName: string): boolean;

  /**
   * Execute a function from this plugin
   * @param functionName The name of the function to execute
   * @param args The arguments passed to the function
   * @returns The result as a JSON string
   */
  execute(functionName: string, args: Record<string, unknown>): string;

  /**
   * Get the tool definition for Kimi API
   * Returns the plugin tool structure that Kimi understands
   */
  getToolDefinition(): UtilityPluginTool;

  /**
   * Get the system prompt addition for this plugin
   * Provides context to the AI about how to use this plugin
   */
  getSystemPromptAddition(): string;
}

/**
 * Utility Plugin Registry Interface
 */
export interface UtilityPluginRegistry {
  register(plugin: KimiUtilityPlugin): void;
  getPluginByName(name: string): KimiUtilityPlugin | null;
  getAllPlugins(): KimiUtilityPlugin[];
  getAutoIncludePlugins(): KimiUtilityPlugin[];
}
