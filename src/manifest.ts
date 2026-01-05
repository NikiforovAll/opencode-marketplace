import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Reads the plugin name from plugin.json if it exists.
 * Returns null if plugin.json doesn't exist, is invalid, or missing name field.
 *
 * @param pluginPath - Absolute path to plugin directory
 * @returns Plugin name from manifest or null
 */
export async function readPluginManifest(pluginPath: string): Promise<{ name: string } | null> {
  const manifestPath = join(pluginPath, "plugin.json");

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = await readFile(manifestPath, "utf-8");
    const json = JSON.parse(content);

    // Only extract name field
    if (json.name && typeof json.name === "string") {
      return { name: json.name };
    }

    return null;
  } catch {
    // Invalid JSON or read error
    return null;
  }
}
