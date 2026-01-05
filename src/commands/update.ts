import { discoverComponents } from "../discovery";
import { cleanup, cloneToTemp } from "../git";
import { parseGitHubUrl } from "../github";
import { getInstalledPlugin } from "../registry";
import { computePluginHash } from "../resolution";
import { install } from "./install";

export interface UpdateOptions {
  scope: "user" | "project";
  verbose?: boolean;
}

export async function update(pluginName: string, options: UpdateOptions) {
  const { scope, verbose } = options;

  try {
    // Step 1: Look up plugin in registry
    const plugin = await getInstalledPlugin(pluginName, scope);

    if (!plugin) {
      throw new Error(
        `Plugin "${pluginName}" is not installed in ${scope} scope. Use 'list' to see installed plugins.`,
      );
    }

    // Step 2: Check if it's a remote plugin
    if (plugin.source.type === "local") {
      throw new Error(
        `Cannot update local plugin "${pluginName}". Local plugins must be updated at their source and reinstalled.`,
      );
    }

    // Step 3: Re-fetch from remote
    const { url, ref } = plugin.source;

    console.log(`Fetching ${url}...`);

    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      throw new Error(`Invalid GitHub URL in registry: ${url}`);
    }

    let tempDir: string | null = null;

    try {
      // Clone repository - use base URL without /tree/ path
      const repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`;
      const cloneResult = await cloneToTemp(repoUrl, parsed.ref || ref, parsed.subpath);
      tempDir = cloneResult.tempDir;

      if (verbose) {
        console.log(`[VERBOSE] Cloned to ${tempDir}`);
      }

      // Step 4: Compute new hash
      const components = await discoverComponents(cloneResult.pluginPath, pluginName);
      const newHash = await computePluginHash(components);

      // Step 5: Check if already up to date
      if (newHash === plugin.hash) {
        console.log(`\nPlugin ${pluginName} is already up to date [${newHash.substring(0, 8)}].`);
        return;
      }

      if (verbose) {
        console.log(
          `[VERBOSE] Hash changed: ${plugin.hash.substring(0, 8)} → ${newHash.substring(0, 8)}`,
        );
      }

      // Step 6: Run install flow (will overwrite existing)
      // Cleanup temp before install takes over
      const _pluginPath = cloneResult.pluginPath;
      const tmpToKeep = tempDir;
      tempDir = null; // Prevent cleanup in finally

      console.log(`\nUpdating ${pluginName}...`);

      // Use install command directly
      await install(url, { scope, force: true, verbose });

      // Cleanup after install
      await cleanup(tmpToKeep);
    } finally {
      if (tempDir) {
        await cleanup(tempDir);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\nError: ${error.message}`);
    } else {
      console.error("\nUnknown error occurred during update");
    }
    process.exit(1);
  }
}
