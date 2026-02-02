import { KimiPluginRegistry } from "./registry/KimiPluginRegistry.js";
import { KimiUtilityPluginRegistry } from "./registry/UtilityPluginRegistry.js";
import { ExcelPlugin } from "./plugins/ExcelPlugin.js";
import { TimezonePlugin } from "./plugins/TimezonePlugin.js";
import { GitHubPlugin } from "./plugins/GitHubPlugin.js";
import { LinearPlugin } from "./plugins/LinearPlugin.js";
import { ExcelExportPlugin } from "./plugins/ExcelExportPlugin.js";
// Import future plugins here:
// import { PdfPlugin } from "./plugins/PdfPlugin.js";
// import { ImagePlugin } from "./plugins/ImagePlugin.js";

/**
 * Bootstrap and configure all Kimi file plugins
 *
 * To add a new file plugin:
 * 1. Create the plugin class implementing KimiPlugin interface
 * 2. Import it here
 * 3. Register it with the registry
 */
export function bootstrapPlugins(): KimiPluginRegistry {
  const registry = new KimiPluginRegistry();

  // Register Excel/CSV plugin (primary)
  registry.register(new ExcelPlugin());

  // Register future file plugins here:
  // registry.register(new PdfPlugin());
  // registry.register(new ImagePlugin());
  // registry.register(new CodePlugin());

  return registry;
}

/**
 * Bootstrap and configure all Kimi utility plugins
 *
 * To add a new utility plugin:
 * 1. Create the plugin class implementing KimiUtilityPlugin interface
 * 2. Import it here
 * 3. Register it with the utility registry
 */
export function bootstrapUtilityPlugins(): KimiUtilityPluginRegistry {
  const registry = new KimiUtilityPluginRegistry();

  // Register Timezone plugin
  registry.register(new TimezonePlugin());

  // Register GitHub plugin
  registry.register(new GitHubPlugin());

  // Register Linear plugin
  registry.register(new LinearPlugin());

  // Register Excel Export plugin
  registry.register(new ExcelExportPlugin());

  // Register future utility plugins here:
  // registry.register(new CalculatorPlugin());
  // registry.register(new WeatherPlugin());

  return registry;
}

// Singleton instances for the application
let pluginRegistryInstance: KimiPluginRegistry | null = null;
let utilityPluginRegistryInstance: KimiUtilityPluginRegistry | null = null;

/**
 * Get the singleton file plugin registry instance
 */
export function getPluginRegistry(): KimiPluginRegistry {
  if (!pluginRegistryInstance) {
    pluginRegistryInstance = bootstrapPlugins();
  }
  return pluginRegistryInstance;
}

/**
 * Get the singleton utility plugin registry instance
 */
export function getUtilityPluginRegistry(): KimiUtilityPluginRegistry {
  if (!utilityPluginRegistryInstance) {
    utilityPluginRegistryInstance = bootstrapUtilityPlugins();
  }
  return utilityPluginRegistryInstance;
}
