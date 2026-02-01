import { KimiPluginRegistry } from "./registry/KimiPluginRegistry.js";
import { ExcelPlugin } from "./plugins/ExcelPlugin.js";
// Import future plugins here:
// import { PdfPlugin } from "./plugins/PdfPlugin.js";
// import { ImagePlugin } from "./plugins/ImagePlugin.js";

/**
 * Bootstrap and configure all Kimi plugins
 *
 * To add a new plugin:
 * 1. Create the plugin class implementing KimiPlugin interface
 * 2. Import it here
 * 3. Register it with the registry
 */
export function bootstrapPlugins(): KimiPluginRegistry {
  const registry = new KimiPluginRegistry();

  // Register Excel/CSV plugin (primary)
  registry.register(new ExcelPlugin());

  // Register future plugins here:
  // registry.register(new PdfPlugin());
  // registry.register(new ImagePlugin());
  // registry.register(new CodePlugin());

  return registry;
}

// Singleton instance for the application
let pluginRegistryInstance: KimiPluginRegistry | null = null;

/**
 * Get the singleton plugin registry instance
 */
export function getPluginRegistry(): KimiPluginRegistry {
  if (!pluginRegistryInstance) {
    pluginRegistryInstance = bootstrapPlugins();
  }
  return pluginRegistryInstance;
}
