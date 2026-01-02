import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { type DiscoveredComponent, validatePluginName } from "./types";

/**
 * Resolves the plugin name from the directory path.
 * Normalizes the name to be lowercase and validates it.
 */
export function resolvePluginName(pluginPath: string): string {
  const name = basename(pluginPath).toLowerCase();

  if (!validatePluginName(name)) {
    throw new Error(
      `Invalid plugin name "${name}". Plugin names must be lowercase alphanumeric with hyphens.`,
    );
  }

  return name;
}

/**
 * Computes a unique hash for the plugin based on its components' content.
 * used for versioning and change detection.
 */
export async function computePluginHash(components: DiscoveredComponent[]): Promise<string> {
  const hash = createHash("sha256");

  // Sort components to ensure consistent hashing
  const sortedComponents = [...components].sort((a, b) => {
    // Sort by type first
    const typeCompare = a.type.localeCompare(b.type);
    if (typeCompare !== 0) return typeCompare;

    // Then by name
    return a.name.localeCompare(b.name);
  });

  for (const component of sortedComponents) {
    // Update hash with component identity to distinguish different components with same content
    hash.update(`${component.type}:${component.name}:`);

    try {
      let contentPath = component.sourcePath;

      if (component.type === "skill") {
        // For skills, we only hash the SKILL.md file
        contentPath = join(component.sourcePath, "SKILL.md");
      }

      const content = await readFile(contentPath);
      hash.update(content);
    } catch (error) {
      // If a file is missing during hashing (e.g. SKILL.md missing),
      // we throw to ensure we don't generate a valid hash for a broken plugin
      throw new Error(
        `Failed to read component content for hashing: ${component.sourcePath}. ${error}`,
      );
    }
  }

  return hash.digest("hex");
}
