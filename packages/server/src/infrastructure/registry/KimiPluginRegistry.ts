import * as path from "node:path";
import type { KimiFileInfo } from "@kimi-excel/shared";
import type { KimiPlugin } from "../../domain/interfaces/KimiPlugin.js";
import type { PluginRegistry } from "../../domain/interfaces/PluginRegistry.js";

/**
 * Kimi Plugin Registry Implementation
 *
 * Manages plugin registration and lookup using Strategy + Factory patterns
 */
export class KimiPluginRegistry implements PluginRegistry {
  private pluginsByExtension: Map<string, KimiPlugin> = new Map();
  private pluginsByName: Map<string, KimiPlugin> = new Map();
  private plugins: Set<KimiPlugin> = new Set();

  register(plugin: KimiPlugin): void {
    // Register by name
    this.pluginsByName.set(plugin.name, plugin);

    // Register by each supported extension
    for (const ext of plugin.supportedExtensions) {
      this.pluginsByExtension.set(ext.toLowerCase(), plugin);
    }

    // Add to set of unique plugins
    this.plugins.add(plugin);
  }

  getPluginForFile(file: KimiFileInfo): KimiPlugin | null {
    // First, try to find a plugin that explicitly says it can process this file
    for (const plugin of this.plugins) {
      if (plugin.canProcess(file)) {
        return plugin;
      }
    }

    // Fallback: try by extension
    const ext = path.extname(file.filename).toLowerCase();
    return this.pluginsByExtension.get(ext) ?? null;
  }

  getPluginByExtension(extension: string): KimiPlugin | null {
    const normalizedExt = extension.startsWith(".")
      ? extension.toLowerCase()
      : `.${extension.toLowerCase()}`;
    return this.pluginsByExtension.get(normalizedExt) ?? null;
  }

  getPluginByName(name: string): KimiPlugin | null {
    return this.pluginsByName.get(name) ?? null;
  }

  getAllPlugins(): KimiPlugin[] {
    return Array.from(this.plugins);
  }

  getSupportedExtensions(): string[] {
    return Array.from(this.pluginsByExtension.keys());
  }

  canProcess(file: KimiFileInfo): boolean {
    return this.getPluginForFile(file) !== null;
  }

  /**
   * Get the best plugin for a set of files
   * Returns the plugin that can handle the most files, or null if no common plugin exists
   */
  getPluginForFiles(files: KimiFileInfo[]): KimiPlugin | null {
    if (files.length === 0) return null;

    // Count which plugins can handle each file
    const pluginCounts = new Map<KimiPlugin, number>();

    for (const file of files) {
      const plugin = this.getPluginForFile(file);
      if (plugin) {
        pluginCounts.set(plugin, (pluginCounts.get(plugin) ?? 0) + 1);
      }
    }

    // Find the plugin that handles the most files
    let bestPlugin: KimiPlugin | null = null;
    let bestCount = 0;

    for (const [plugin, count] of pluginCounts) {
      if (count > bestCount) {
        bestPlugin = plugin;
        bestCount = count;
      }
    }

    // Only return if the plugin can handle ALL files
    return bestCount === files.length ? bestPlugin : null;
  }
}
