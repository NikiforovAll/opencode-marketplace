import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ComponentType, DiscoveredComponent } from "./types";
import { getComponentTargetName } from "./types";

const SEARCH_PATHS: Record<ComponentType, string[]> = {
  command: [".opencode/commands", ".claude/commands", "commands", "command"],
  agent: [".opencode/agents", ".claude/agents", "agents", "agent"],
  skill: [".opencode/skills", ".claude/skills", "skills", "skill"],
};

/**
 * Discovers components in a plugin directory based on priority paths.
 * Returns a flattened list of all found components.
 */
export async function discoverComponents(
  pluginRoot: string,
  pluginName: string,
): Promise<DiscoveredComponent[]> {
  const components: DiscoveredComponent[] = [];

  // Parallelize discovery for each type
  await Promise.all([
    discoverType(pluginRoot, pluginName, "command", components),
    discoverType(pluginRoot, pluginName, "agent", components),
    discoverType(pluginRoot, pluginName, "skill", components),
  ]);

  return components;
}

async function discoverType(
  root: string,
  pluginName: string,
  type: ComponentType,
  results: DiscoveredComponent[],
) {
  const paths = SEARCH_PATHS[type];

  // Find the first path that exists
  for (const relativePath of paths) {
    const fullPath = join(root, relativePath);

    if (existsSync(fullPath)) {
      await scanDirectory(fullPath, pluginName, type, results);
      return; // Stop after first match (priority wins)
    }
  }
}

async function scanDirectory(
  dirPath: string,
  pluginName: string,
  type: ComponentType,
  results: DiscoveredComponent[],
) {
  try {
    const entries = await readdir(dirPath);

    for (const entry of entries) {
      const entryPath = join(dirPath, entry);
      const stats = await stat(entryPath);

      if (type === "skill") {
        // Skills must be directories containing SKILL.md
        if (stats.isDirectory()) {
          const skillMdPath = join(entryPath, "SKILL.md");
          if (existsSync(skillMdPath)) {
            results.push({
              type,
              sourcePath: entryPath,
              name: entry,
              targetName: getComponentTargetName(pluginName, entry),
            });
          }
        }
      } else {
        // Commands and Agents must be .md files
        if (stats.isFile() && entry.endsWith(".md")) {
          results.push({
            type,
            sourcePath: entryPath,
            name: entry,
            targetName: getComponentTargetName(pluginName, entry),
          });
        }
      }
    }
  } catch (_error) {
    // Ignore errors (e.g. permission denied) to be robust
    // In a real app we might want to log this in verbose mode
  }
}
