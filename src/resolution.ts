import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseGitHubUrl } from "./github";
import { readPluginManifest } from "./manifest";
import { type DiscoveredComponent, validatePluginName } from "./types";

/**
 * Infers plugin name from multiple sources with priority:
 * 1. plugin.json name field if present
 * 2. Derived from GitHub URL (with dot-stripping)
 * 3. Local directory name (with dot-stripping)
 *
 * @param pluginPath - Absolute path to plugin directory
 * @param originalPath - Original path/URL provided by user (for remote sources)
 * @returns Validated plugin name
 */
export async function inferPluginName(pluginPath: string, originalPath?: string): Promise<string> {
  // Try reading plugin.json name field first
  const manifest = await readPluginManifest(pluginPath);

  if (manifest?.name) {
    const name = manifest.name.toLowerCase();
    if (!validatePluginName(name)) {
      throw new Error(
        `Invalid plugin name "${name}" in plugin.json. Plugin names must be lowercase alphanumeric with hyphens.`,
      );
    }
    return name;
  }

  // For remote URLs, derive from URL with dot-stripping
  if (originalPath?.startsWith("https://github.com/")) {
    const parsed = parseGitHubUrl(originalPath);
    if (parsed) {
      const lastPathPart = parsed.subpath?.split("/").filter(Boolean).pop();
      const name = (lastPathPart || parsed.repo).replace(/^\.+/, "").toLowerCase();

      if (!validatePluginName(name)) {
        throw new Error(
          `Invalid plugin name "${name}" derived from URL. Plugin names must be lowercase alphanumeric with hyphens.`,
        );
      }
      return name;
    }
  }

  // Fallback to directory name
  return resolvePluginName(pluginPath);
}

/**
 * Resolves the plugin name from the directory path.
 * Normalizes the name to be lowercase and validates it.
 */
export function resolvePluginName(pluginPath: string): string {
  // Extract the last part of the path, handling both Windows and POSIX separators
  const parts = pluginPath.split(/[\\/]/);
  const lastPart = parts.filter(Boolean).pop() || "";
  // Strip leading dots (e.g., .claude-plugin -> claude-plugin)
  const name = lastPart.replace(/^\.+/, "").toLowerCase();

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
