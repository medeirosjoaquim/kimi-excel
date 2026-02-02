import type {
  KimiUtilityPlugin,
  UtilityPluginRegistry,
} from "../../domain/interfaces/KimiUtilityPlugin.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("UtilityPluginRegistry");

/**
 * Registry for utility plugins (non-file-based tools)
 *
 * Manages plugins that provide general-purpose tools like timezone conversion,
 * calculations, etc. These plugins don't require file uploads.
 */
export class KimiUtilityPluginRegistry implements UtilityPluginRegistry {
  private plugins: Map<string, KimiUtilityPlugin> = new Map();

  /**
   * Register a new utility plugin
   */
  register(plugin: KimiUtilityPlugin): void {
    if (this.plugins.has(plugin.name)) {
      log.warn("Plugin already registered, overwriting", {
        name: plugin.name,
      });
    }
    this.plugins.set(plugin.name, plugin);
    log.info("Utility plugin registered", {
      name: plugin.name,
      autoInclude: plugin.autoInclude,
    });
  }

  /**
   * Get a plugin by name
   */
  getPluginByName(name: string): KimiUtilityPlugin | null {
    return this.plugins.get(name) ?? null;
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): KimiUtilityPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins that should be auto-included in all requests
   */
  getAutoIncludePlugins(): KimiUtilityPlugin[] {
    return this.getAllPlugins().filter((p) => p.autoInclude);
  }

  /**
   * Get tool definitions for all auto-include plugins
   */
  getAutoIncludeToolDefinitions(): ReturnType<
    KimiUtilityPlugin["getToolDefinition"]
  >[] {
    return this.getAutoIncludePlugins().map((p) => p.getToolDefinition());
  }

  /**
   * Get combined system prompt additions from all auto-include plugins
   */
  getAutoIncludeSystemPrompt(): string {
    const prompts = this.getAutoIncludePlugins()
      .map((p) => p.getSystemPromptAddition())
      .filter((p) => p.length > 0);

    return prompts.length > 0 ? prompts.join("\n\n") : "";
  }

  /**
   * Find a plugin that can handle a specific function name
   */
  findPluginForFunction(functionName: string): KimiUtilityPlugin | null {
    for (const plugin of this.plugins.values()) {
      if (plugin.canHandle(functionName)) {
        return plugin;
      }
    }
    return null;
  }

  /**
   * Execute a function if a plugin can handle it
   * @returns The result string, or null if no plugin can handle the function
   */
  executeFunction(
    functionName: string,
    args: Record<string, unknown>
  ): string | null {
    const plugin = this.findPluginForFunction(functionName);
    if (plugin) {
      log.debug("Executing utility function", {
        functionName,
        plugin: plugin.name,
      });
      try {
        const result = plugin.execute(functionName, args);
        log.debug("Utility function executed", {
          functionName,
          resultLength: result.length,
        });
        return result;
      } catch (error) {
        log.error("Utility function execution failed", {
          functionName,
          plugin: plugin.name,
          error: error instanceof Error ? error.message : String(error),
        });
        return JSON.stringify({
          error: `Failed to execute ${functionName}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
    return null;
  }
}
