import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { formatComponentCount } from "../format";
import { getComponentDir } from "../paths";
import { getInstalledPlugin, loadRegistry, saveRegistry } from "../registry";
import type { ComponentType, Scope } from "../types";

export interface UninstallOptions {
  scope: "user" | "project";
  verbose?: boolean;
}

interface DeletionResult {
  deleted: string[];
  alreadyMissing: string[];
}

export async function uninstall(name: string, options: UninstallOptions) {
  const { scope, verbose } = options;

  try {
    // Step 1: Look up plugin in registry
    const plugin = await getInstalledPlugin(name, scope);

    if (!plugin) {
      throw new Error(`Plugin "${name}" is not installed in ${scope} scope.

Run 'opencode-marketplace list --scope ${scope}' to see installed plugins.`);
    }

    if (verbose) {
      console.log(`[VERBOSE] Found plugin "${name}" with hash ${plugin.hash}`);
      console.log(
        `[VERBOSE] Plugin has ${
          plugin.components.commands.length +
          plugin.components.agents.length +
          plugin.components.skills.length
        } components to remove`,
      );
    }

    // Step 2: Display uninstall message with hash
    console.log(`Uninstalling ${name} [${plugin.hash.substring(0, 8)}]...`);

    // Step 3: Delete all component files/directories
    const deletionResults: DeletionResult = {
      deleted: [],
      alreadyMissing: [],
    };

    // Delete commands
    for (const command of plugin.components.commands) {
      await deleteComponent("command", command, scope, verbose ?? false, deletionResults);
    }

    // Delete agents
    for (const agent of plugin.components.agents) {
      await deleteComponent("agent", agent, scope, verbose ?? false, deletionResults);
    }

    // Delete skills
    for (const skill of plugin.components.skills) {
      await deleteComponent("skill", skill, scope, verbose ?? false, deletionResults);
    }

    // Step 4: Update registry (remove plugin entry)
    if (verbose) {
      console.log(`[VERBOSE] Updating registry to remove plugin "${name}"`);
    }

    const registry = await loadRegistry(scope);
    delete registry.plugins[name];
    await saveRegistry(registry, scope);

    if (verbose) {
      console.log("[VERBOSE] Registry updated successfully");
    }

    // Step 5: Display success message with breakdown
    const componentCounts = formatComponentCount(plugin.components);
    console.log(`\nUninstalled ${name} (${componentCounts}) from ${scope} scope.`);

    // Step 6: Always show warning if files were missing
    if (deletionResults.alreadyMissing.length > 0) {
      console.warn(
        `\nWarning: ${deletionResults.alreadyMissing.length} component(s) were already deleted.`,
      );

      if (verbose) {
        for (const component of deletionResults.alreadyMissing) {
          console.warn(`  ${component}`);
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\nError: ${error.message}`);
    } else {
      console.error("\nUnknown error occurred during uninstallation");
    }
    process.exit(1);
  }
}

/**
 * Deletes a component file or directory and tracks deletion status.
 */
async function deleteComponent(
  type: ComponentType,
  componentName: string,
  scope: Scope,
  verbose: boolean,
  results: DeletionResult,
): Promise<void> {
  const baseDir = getComponentDir(type, scope);
  const fullPath = join(baseDir, componentName);

  // Remove trailing slash for consistency
  const normalizedPath = fullPath.endsWith("/") ? fullPath.slice(0, -1) : fullPath;

  if (verbose) {
    console.log(`[VERBOSE] Deleting ${type}/${componentName} from ${normalizedPath}`);
  }

  try {
    if (existsSync(normalizedPath)) {
      await rm(normalizedPath, { recursive: true, force: true });

      if (!verbose) {
        console.log(`  ✗ ${type}/${componentName}`);
      }

      results.deleted.push(`${type}/${componentName}`);
    } else {
      // File already deleted - not an error, but track it
      if (!verbose) {
        console.log(`  ⚠ ${type}/${componentName} (already deleted)`);
      }

      results.alreadyMissing.push(`${type}/${componentName}`);
    }
  } catch (error) {
    // Permission denied or other filesystem error
    throw new Error(
      `Failed to delete ${type}/${componentName}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
