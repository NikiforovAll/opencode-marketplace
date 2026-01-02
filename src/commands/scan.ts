import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { discoverComponents } from "../discovery";
import { computePluginHash, resolvePluginName } from "../identity";
import type { DiscoveredComponent } from "../types";

export interface ScanOptions {
  verbose?: boolean;
}

/**
 * Scans a plugin directory and displays what components would be installed.
 * This is a dry-run operation that doesn't modify any files.
 */
export async function scan(path: string, options: ScanOptions): Promise<void> {
  // 1. Validate and resolve path
  const absolutePath = resolve(path);

  if (options.verbose) {
    console.log(`[VERBOSE] Scanning path ${absolutePath}`);
  }

  if (!existsSync(absolutePath)) {
    console.error(`Error: Directory not found: ${path}`);
    process.exit(1);
  }

  // 2. Resolve plugin identity
  let pluginName: string;
  try {
    pluginName = resolvePluginName(absolutePath);
    if (options.verbose) {
      console.log(`[VERBOSE] Resolved plugin name: ${pluginName}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // 3. Discover components
  const components = await discoverComponents(absolutePath, pluginName);

  // 4. Compute and shorten hash
  let hash = "";
  try {
    const fullHash = await computePluginHash(components);
    hash = shortenHash(fullHash);

    if (options.verbose) {
      console.log(`[VERBOSE] Computed hash: ${fullHash} (shortened to ${hash})`);
      console.log();
    }
  } catch (error) {
    // Partial results with warning (per design decision #3)
    console.warn(
      `Warning: Failed to compute hash: ${error instanceof Error ? error.message : String(error)}`,
    );
    hash = "????????"; // Placeholder for failed hash
  }

  // 5. Display results
  console.log(`Scanning ${pluginName} [${hash}]...`);

  if (components.length === 0) {
    console.log();
    console.log("No components found.");
    console.log();
    console.log("Expected directories:");
    console.log("  - .opencode/command/, .claude/commands/, command/, or commands/");
    console.log("  - .opencode/agent/, .claude/agents/, agent/, or agents/");
    console.log("  - .opencode/skill/, .claude/skills/, skill/, or skills/");
    return;
  }

  // Display components (matching install output format)
  for (const component of components) {
    const suffix = component.type === "skill" ? "/" : "";
    console.log(`  → ${component.type}/${component.targetName}${suffix}`);
  }

  console.log();

  // Display summary
  const counts = countComponentsByType(components);
  const summary = formatComponentCount(counts);
  console.log(`Found ${summary}`);
}

/**
 * Shortens a full hash to 8 characters (per SPEC).
 */
function shortenHash(fullHash: string): string {
  return fullHash.substring(0, 8);
}

/**
 * Counts components by type.
 */
function countComponentsByType(components: DiscoveredComponent[]): {
  commands: number;
  agents: number;
  skills: number;
} {
  return {
    commands: components.filter((c) => c.type === "command").length,
    agents: components.filter((c) => c.type === "agent").length,
    skills: components.filter((c) => c.type === "skill").length,
  };
}

/**
 * Formats component counts for display.
 * Example: "1 command, 2 agents, 3 skills"
 */
function formatComponentCount(counts: {
  commands: number;
  agents: number;
  skills: number;
}): string {
  const parts: string[] = [];

  if (counts.commands > 0) {
    parts.push(`${counts.commands} command${counts.commands > 1 ? "s" : ""}`);
  }
  if (counts.agents > 0) {
    parts.push(`${counts.agents} agent${counts.agents > 1 ? "s" : ""}`);
  }
  if (counts.skills > 0) {
    parts.push(`${counts.skills} skill${counts.skills > 1 ? "s" : ""}`);
  }

  return parts.join(", ");
}
