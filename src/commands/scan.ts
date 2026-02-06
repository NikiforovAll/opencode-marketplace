import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { discoverComponents } from "../discovery";
import { cleanup, cloneToTemp } from "../git";
import { isGitHubUrl, parseGitHubUrl } from "../github";
import { computePluginHash, inferPluginName } from "../resolution";
import type { DiscoveredComponent } from "../types";

export interface ScanOptions {
  verbose?: boolean;
}

/**
 * Scans a plugin directory and displays what components would be installed.
 * This is a dry-run operation that doesn't modify any files.
 */
export async function scan(path: string, options: ScanOptions): Promise<void> {
  let tempDir: string | null = null;

  try {
    // 1. Detect if path is a GitHub URL or local path
    let absolutePath: string;

    if (isGitHubUrl(path)) {
      // Remote scan
      const parsed = parseGitHubUrl(path);
      if (!parsed) {
        console.error(`Error: Invalid GitHub URL: ${path}`);
        process.exit(1);
      }

      if (options.verbose) {
        console.log(
          `[VERBOSE] Cloning from GitHub: ${parsed.owner}/${parsed.repo}${parsed.ref ? `@${parsed.ref}` : ""}`,
        );
      }

      // Clone repository - use base URL without /tree/ path
      const repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`;
      const cloneResult = await cloneToTemp(repoUrl, parsed.ref, parsed.subpath);
      tempDir = cloneResult.tempDir;
      absolutePath = cloneResult.pluginPath;
    } else {
      // Local scan
      absolutePath = resolve(path);

      if (options.verbose) {
        console.log(`[VERBOSE] Scanning path ${absolutePath}`);
      }

      if (!existsSync(absolutePath)) {
        console.error(`Error: Directory not found: ${path}`);
        process.exit(1);
      }
    }

    // 2. Resolve plugin identity using unified logic
    let pluginName: string;
    try {
      pluginName = await inferPluginName(absolutePath, isGitHubUrl(path) ? path : undefined);

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
      console.log("  - .opencode/commands/, .claude/commands/, commands/, or command/");
      console.log("  - .opencode/agents/, .claude/agents/, agents/, or agent/");
      console.log("  - .opencode/skills/, .claude/skills/, skills/, or skill/");
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
  } finally {
    // Cleanup temp directory if remote scan
    if (tempDir) {
      await cleanup(tempDir);
    }
  }
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
