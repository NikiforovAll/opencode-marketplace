import { existsSync } from "node:fs";
import { copyFile, cp, mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { discoverComponents } from "../discovery";
import { formatComponentCount } from "../format";
import { cleanup, cloneToTemp } from "../git";
import { isGitHubUrl, parseGitHubUrl } from "../github";
import { ensureComponentDirsExist, getComponentTargetPath } from "../paths";
import { getInstalledPlugin, loadRegistry, saveRegistry } from "../registry";
import { computePluginHash, inferPluginName } from "../resolution";
import type {
  ComponentType,
  DiscoveredComponent,
  InstalledPlugin,
  PluginSource,
  Scope,
} from "../types";

export interface InstallOptions {
  scope: "user" | "project";
  force: boolean;
  verbose?: boolean;
  interactive?: boolean;
  skipIfSameHash?: boolean;
  targetDir?: string;
}

interface ConflictInfo {
  component: DiscoveredComponent;
  targetPath: string;
  conflictingPlugin: string | null; // null = untracked file
}

export interface InstallResult {
  status: "installed" | "updated" | "skipped";
  pluginName: string;
}

export async function install(path: string, options: InstallOptions): Promise<InstallResult> {
  const { scope, force, verbose, interactive, skipIfSameHash, targetDir } = options;

  let tempDir: string | null = null;

  let pluginSource: PluginSource;

  try {
    // Step 1: Detect if path is a GitHub URL or local path
    let pluginPath: string;

    if (isGitHubUrl(path)) {
      // Remote installation
      const parsed = parseGitHubUrl(path);
      if (!parsed) {
        throw new Error(`Invalid GitHub URL: ${path}`);
      }

      if (verbose) {
        console.log(
          `[VERBOSE] Cloning from GitHub: ${parsed.owner}/${parsed.repo}${parsed.ref ? `@${parsed.ref}` : ""}`,
        );
      }

      // Clone repository - use base URL without /tree/ path
      const repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`;
      const cloneResult = await cloneToTemp(repoUrl, parsed.ref, parsed.subpath);
      tempDir = cloneResult.tempDir;

      // Plugin path from clone result
      pluginPath = cloneResult.pluginPath;

      pluginSource = {
        type: "remote",
        url: path,
        ref: parsed.ref,
      };
    } else {
      // Local installation
      pluginPath = resolve(path);
      if (!existsSync(pluginPath)) {
        throw new Error(`Plugin directory not found: ${path}`);
      }

      pluginSource = {
        type: "local",
        path: pluginPath,
      };
    }

    // Step 2: Resolve plugin identity using unified logic
    const pluginName = await inferPluginName(
      pluginPath,
      pluginSource.type === "remote" ? path : undefined,
    );

    if (verbose) {
      console.log(`[VERBOSE] Resolved plugin name: ${pluginName}`);
    }

    // Step 3: Discover components
    const components = await discoverComponents(pluginPath, pluginName);
    if (components.length === 0) {
      throw new Error(
        `No components found in ${path}. Ensure plugin contains command/, agent/, or skill/ directories with valid components.`,
      );
    }

    // Step 3.5: Interactive selection (if enabled)
    let componentsToInstall = components;

    if (interactive) {
      const { selectComponents } = await import("../interactive");

      try {
        const result = await selectComponents(pluginName, components);

        if (result.cancelled) {
          console.log("\nInstallation cancelled.");
          if (tempDir) {
            await cleanup(tempDir);
          }
          return { status: "skipped", pluginName: "" };
        }

        if (result.selected.length === 0) {
          console.log("No components selected. Nothing installed.");
          if (tempDir) {
            await cleanup(tempDir);
          }
          return { status: "skipped", pluginName: "" };
        }

        componentsToInstall = result.selected;
      } catch (error) {
        if (error instanceof Error && error.message.includes("User force closed")) {
          console.log("\nInstallation cancelled.");
          if (tempDir) {
            await cleanup(tempDir);
          }
          return { status: "skipped", pluginName: "" };
        }
        throw error;
      }
    }

    // Step 4: Compute plugin hash
    const pluginHash = await computePluginHash(components);
    const shortHash = pluginHash.substring(0, 8);

    if (verbose) {
      console.log(`[VERBOSE] Plugin hash: ${pluginHash}`);
      console.log(`[VERBOSE] Found ${components.length} component(s)`);
      if (interactive && componentsToInstall.length < components.length) {
        console.log(
          `[VERBOSE] Selected ${componentsToInstall.length} component(s) for installation`,
        );
      }
    }

    console.log(`Installing ${pluginName} [${shortHash}]...`);

    // Step 5: Check for existing installation
    const existingPlugin = await getInstalledPlugin(pluginName, scope, targetDir);
    let installStatus: "installed" | "updated" | "skipped" = "installed";

    if (existingPlugin) {
      if (existingPlugin.hash === pluginHash) {
        if (skipIfSameHash) {
          if (verbose) {
            console.log(`[VERBOSE] Skipping ${pluginName} (already up to date)`);
          }
          if (tempDir) {
            await cleanup(tempDir);
          }
          return { status: "skipped", pluginName };
        }
        // Same plugin, same hash - reinstall
        if (verbose) {
          console.log(`[VERBOSE] Reinstalling existing plugin (same hash)`);
        }
        installStatus = "installed";
      } else {
        // Same plugin, different hash - update
        if (verbose) {
          console.log(
            `[VERBOSE] Updating plugin from [${existingPlugin.hash.substring(0, 8)}] to [${shortHash}]`,
          );
        }
        installStatus = "updated";
      }
    }

    // Step 6: Detect conflicts
    const conflicts = await detectConflicts(componentsToInstall, pluginName, scope, targetDir);

    if (conflicts.length > 0 && !force) {
      console.error("\nConflict detected:");
      for (const conflict of conflicts) {
        if (conflict.conflictingPlugin) {
          console.error(
            `  ${conflict.component.type}/${conflict.component.targetName} already installed by plugin "${conflict.conflictingPlugin}"`,
          );
        } else {
          console.error(
            `  ${conflict.component.type}/${conflict.component.targetName} exists but is untracked`,
          );
        }
      }
      console.error("\nUse --force to override existing files.");
      throw new Error("Installation aborted due to conflicts");
    }

    if (conflicts.length > 0 && force && verbose) {
      console.log(`[VERBOSE] Overriding ${conflicts.length} conflicting file(s) with --force`);
    }

    // Step 7: Ensure target directories exist
    await ensureComponentDirsExist(scope, targetDir);

    // Step 8: Copy components
    const installedComponents = {
      commands: [] as string[],
      agents: [] as string[],
      skills: [] as string[],
    };

    // Sort components by name to ensure deterministic installation order and registry entry
    const sortedComponents = [...componentsToInstall].sort((a, b) => a.name.localeCompare(b.name));

    for (const component of sortedComponents) {
      const targetPath = getComponentTargetPath(
        pluginName,
        component.name,
        component.type,
        scope,
        targetDir,
      );

      // Remove trailing slash for copying
      const normalizedTarget = targetPath.endsWith("/") ? targetPath.slice(0, -1) : targetPath;

      if (component.type === "skill") {
        // Recursive directory copy
        await mkdir(dirname(normalizedTarget), { recursive: true });
        await cp(component.sourcePath, normalizedTarget, { recursive: true });
        installedComponents.skills.push(basename(normalizedTarget));
      } else if (component.type === "command") {
        // Single file copy for commands
        await mkdir(dirname(normalizedTarget), { recursive: true });
        await copyFile(component.sourcePath, normalizedTarget);
        installedComponents.commands.push(basename(normalizedTarget));
      } else {
        // Single file copy for agents
        await mkdir(dirname(normalizedTarget), { recursive: true });
        await copyFile(component.sourcePath, normalizedTarget);
        installedComponents.agents.push(basename(normalizedTarget));
      }

      console.log(`  → ${component.type}/${component.targetName}`);
    }

    // Step 9: Update registry
    const registry = await loadRegistry(scope, targetDir);

    const newPlugin: InstalledPlugin = {
      name: pluginName,
      hash: pluginHash,
      scope,
      source: pluginSource,
      installedAt: new Date().toISOString(),
      components: installedComponents,
    };

    registry.plugins[pluginName] = newPlugin;
    await saveRegistry(registry, scope, targetDir);

    // Step 10: Cleanup temp directory if remote installation
    if (tempDir) {
      await cleanup(tempDir);
    }

    // Step 11: Print success message
    const componentCounts = formatComponentCount(installedComponents);
    console.log(`\nInstalled ${pluginName} (${componentCounts}) to ${scope} scope.`);

    return { status: installStatus, pluginName };
  } catch (error) {
    // Cleanup temp directory on error
    if (tempDir) {
      await cleanup(tempDir);
    }

    // Re-throw the error to let the caller handle it
    throw error;
  }
}

/**
 * Detects conflicts for components that would overwrite files from other plugins.
 * Returns conflicts where:
 * - File exists and belongs to a different plugin
 * - File exists but is untracked (not in registry)
 */
async function detectConflicts(
  components: DiscoveredComponent[],
  pluginName: string,
  scope: Scope,
  targetDir?: string,
): Promise<ConflictInfo[]> {
  const conflicts: ConflictInfo[] = [];
  const registry = await loadRegistry(scope, targetDir);

  for (const component of components) {
    const targetPath = getComponentTargetPath(
      pluginName,
      component.name,
      component.type,
      scope,
      targetDir,
    );

    // Remove trailing slash for existence check
    const normalizedTarget = targetPath.endsWith("/") ? targetPath.slice(0, -1) : targetPath;

    if (existsSync(normalizedTarget)) {
      // Find which plugin owns this component
      const owningPlugin = findOwningPlugin(registry, component.type, component.targetName);

      // Conflict if owned by different plugin OR untracked
      if (owningPlugin !== pluginName) {
        conflicts.push({
          component,
          targetPath: normalizedTarget,
          conflictingPlugin: owningPlugin,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Finds which plugin owns a specific component by searching the registry.
 * Returns null if the component is not tracked.
 */
function findOwningPlugin(
  registry: { plugins: Record<string, InstalledPlugin> },
  componentType: ComponentType,
  targetName: string,
): string | null {
  for (const [pluginName, plugin] of Object.entries(registry.plugins)) {
    const componentList = plugin.components[`${componentType}s` as keyof typeof plugin.components];
    if (componentList.includes(targetName)) {
      return pluginName;
    }
  }
  return null;
}
