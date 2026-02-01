import type { KimiFileInfo } from "@kimi-excel/shared";
import type { KimiPlugin } from "./KimiPlugin.js";

/**
 * Plugin Registry Interface - Factory Pattern
 *
 * Manages registration and lookup of Kimi plugins
 */
export interface PluginRegistry {
  /**
   * Register a plugin with the registry
   */
  register(plugin: KimiPlugin): void;

  /**
   * Get the appropriate plugin for a file
   * Returns null if no plugin can handle the file
   */
  getPluginForFile(file: KimiFileInfo): KimiPlugin | null;

  /**
   * Get plugin by file extension
   */
  getPluginByExtension(extension: string): KimiPlugin | null;

  /**
   * Get plugin by name
   */
  getPluginByName(name: string): KimiPlugin | null;

  /**
   * Get all registered plugins
   */
  getAllPlugins(): KimiPlugin[];

  /**
   * Get all supported file extensions across all plugins
   */
  getSupportedExtensions(): string[];

  /**
   * Check if any plugin can handle the given file
   */
  canProcess(file: KimiFileInfo): boolean;
}
