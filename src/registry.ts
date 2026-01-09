import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { InstalledPlugin, PluginRegistry, Scope } from "./types";

/**
 * Returns the path to the registry file for the given scope.
 */
export function getRegistryPath(scope: Scope, targetDir?: string): string {
  if (scope === "user") {
    const base = targetDir || join(homedir(), ".config", "opencode");
    return join(base, "plugins", "installed.json");
  }
  // project scope
  return join(process.cwd(), ".opencode", "plugins", "installed.json");
}

/**
 * Loads the plugin registry for the given scope.
 * Returns an empty registry if the file does not exist.
 */
export async function loadRegistry(scope: Scope, targetDir?: string): Promise<PluginRegistry> {
  const path = getRegistryPath(scope, targetDir);

  if (!existsSync(path)) {
    return { version: 2, plugins: {} };
  }

  try {
    const content = await readFile(path, "utf-8");
    const registry = JSON.parse(content);

    // If old v1 registry, warn and return empty
    if (registry.version === 1) {
      console.warn("Warning: Registry v1 detected. Please reinstall plugins for v2 compatibility.");
      return { version: 2, plugins: {} };
    }

    return registry;
  } catch (error) {
    console.error(`Error loading registry from ${path}:`, error);
    return { version: 2, plugins: {} };
  }
}

/**
 * Saves the plugin registry for the given scope.
 * Uses atomic write pattern.
 */
export async function saveRegistry(
  registry: PluginRegistry,
  scope: Scope,
  targetDir?: string,
): Promise<void> {
  const path = getRegistryPath(scope, targetDir);
  const dir = join(path, "..");

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, JSON.stringify(registry, null, 2), "utf-8");
  await rename(tmpPath, path);
}

/**
 * Gets an installed plugin by name from the specified scope.
 */
export async function getInstalledPlugin(
  name: string,
  scope: Scope,
  targetDir?: string,
): Promise<InstalledPlugin | null> {
  const registry = await loadRegistry(scope, targetDir);
  return registry.plugins[name] || null;
}

/**
 * Gets all installed plugins. If scope is provided, only from that scope.
 * Otherwise, combines plugins from both scopes.
 */
export async function getAllInstalledPlugins(scope?: Scope): Promise<InstalledPlugin[]> {
  if (scope) {
    const registry = await loadRegistry(scope);
    return Object.values(registry.plugins);
  }

  // Combine user and project scopes
  const [userRegistry, projectRegistry] = await Promise.all([
    loadRegistry("user"),
    loadRegistry("project"),
  ]);

  // We use a Map to handle potential duplicates (though they should be rare)
  // preferring project scope if a plugin exists in both (unlikely but possible)
  const allPlugins = new Map<string, InstalledPlugin>();

  for (const plugin of Object.values(userRegistry.plugins)) {
    allPlugins.set(plugin.name, plugin);
  }

  for (const plugin of Object.values(projectRegistry.plugins)) {
    allPlugins.set(plugin.name, plugin);
  }

  return Array.from(allPlugins.values());
}
