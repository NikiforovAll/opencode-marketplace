import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { isGitHubUrl } from "./github";
import type { ImportConfig } from "./types";

/**
 * Returns the default import config path: ~/.config/opencode/ocm-import.json
 */
export function getDefaultImportConfigPath(): string {
  return join(homedir(), ".config", "opencode", "ocm-import.json");
}

/**
 * Loads and validates the import configuration file.
 *
 * @param configPath Path to the config file
 * @returns Parsed and validated ImportConfig
 * @throws Error if file not found, invalid JSON, or invalid schema
 */
export async function loadImportConfig(configPath: string): Promise<ImportConfig> {
  const absolutePath = resolve(configPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Import configuration file not found: ${configPath}`);
  }

  const content = await readFile(absolutePath, "utf-8");
  let config: unknown;

  try {
    config = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to parse import configuration (invalid JSON): ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Validation
  if (!config || typeof config !== "object") {
    throw new Error("Invalid import configuration: expected an object");
  }

  if (!Array.isArray(config.plugins)) {
    throw new Error("Invalid import configuration: 'plugins' must be an array");
  }

  // Resolve relative paths
  const configDir = dirname(absolutePath);
  const plugins: string[] = [];

  for (let i = 0; i < config.plugins.length; i++) {
    const source = config.plugins[i];
    if (typeof source !== "string" || source.trim() === "") {
      throw new Error(`Invalid import configuration: 'plugins[${i}]' must be a non-empty string`);
    }

    const trimmedSource = source.trim();

    // Resolve relative paths for local sources (not GitHub URLs and not absolute paths)
    if (!isGitHubUrl(trimmedSource) && !isAbsolute(trimmedSource)) {
      plugins.push(resolve(configDir, trimmedSource));
    } else {
      plugins.push(trimmedSource);
    }
  }

  return { plugins };
}
