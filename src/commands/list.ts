import { formatComponentCount } from "../format";
import { getAllInstalledPlugins } from "../registry";
import type { InstalledPlugin, Scope } from "../types";

export interface ListOptions {
  scope?: Scope;
  verbose?: boolean;
}

export async function list(options: ListOptions) {
  if (options.verbose) {
    console.log("[VERBOSE] Listing plugins with options:", options);
  }

  const plugins = await getAllInstalledPlugins(options.scope);

  // Filter by scope if specified
  const filteredPlugins = options.scope
    ? plugins.filter((plugin) => plugin.scope === options.scope)
    : plugins;

  if (filteredPlugins.length === 0) {
    const scopeText = options.scope ? `${options.scope} scope` : "any scope";
    console.log(`No plugins installed in ${scopeText}.`);
    return;
  }

  // Sort alphabetically by plugin name
  filteredPlugins.sort((a, b) => a.name.localeCompare(b.name));

  // Group by scope for display
  const userPlugins = filteredPlugins.filter((p) => p.scope === "user");
  const projectPlugins = filteredPlugins.filter((p) => p.scope === "project");

  // Display user scope plugins
  if (userPlugins.length > 0) {
    console.log("User scope:");
    for (const plugin of userPlugins) {
      displayPlugin(plugin, options.verbose);
    }
    if (projectPlugins.length > 0) {
      console.log(""); // Add spacing between scopes
    }
  }

  // Display project scope plugins
  if (projectPlugins.length > 0) {
    console.log("Project scope:");
    for (const plugin of projectPlugins) {
      displayPlugin(plugin, options.verbose);
    }
  }
}

function displayPlugin(plugin: InstalledPlugin, verbose = false) {
  const componentCount = formatComponentCount(plugin.components);
  const shortHash = plugin.hash.substring(0, 8);

  console.log(`  ${plugin.name} [${shortHash}] (${componentCount})`);

  // Display source based on type
  const sourceText = plugin.source.type === "remote" ? plugin.source.url : plugin.source.path;
  console.log(`    Source: ${sourceText}`);

  if (verbose) {
    console.log(`    Installed: ${plugin.installedAt}`);
    console.log(`    Scope: ${plugin.scope}`);

    if (plugin.components.commands.length > 0) {
      console.log(`    Commands: ${plugin.components.commands.join(", ")}`);
    }
    if (plugin.components.agents.length > 0) {
      console.log(`    Agents: ${plugin.components.agents.join(", ")}`);
    }
    if (plugin.components.skills.length > 0) {
      console.log(`    Skills: ${plugin.components.skills.join(", ")}`);
    }
  }
}
