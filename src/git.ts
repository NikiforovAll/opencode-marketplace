/**
 * Git operations for cloning remote repositories
 */

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface CloneResult {
  tempDir: string; // temp clone location
  pluginPath: string; // actual plugin directory (tempDir + subpath)
}

/**
 * Clones a Git repository to a temporary directory.
 *
 * @param url - Git repository URL
 * @param ref - Optional branch, tag, or commit to checkout
 * @param subpath - Optional subfolder path within the repository
 * @returns Clone result with temp directory and plugin path
 * @throws Error if clone fails
 */
export async function cloneToTemp(
  url: string,
  ref?: string,
  subpath?: string,
): Promise<CloneResult> {
  // Generate unique temp directory
  const tempDir = join(tmpdir(), `opencode-plugin-${randomUUID()}`);

  // Build git clone command
  const args = ["clone", "--depth", "1"];

  if (ref) {
    args.push("--branch", ref);
  }

  args.push(url, tempDir);

  // Execute git clone
  const result = spawnSync("git", args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
  });

  if (result.error) {
    throw new Error(`Git command failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const errorMessage = result.stderr || result.stdout || "Unknown error";
    throw new Error(`Failed to clone repository: ${errorMessage.trim()}`);
  }

  // Determine actual plugin path
  const pluginPath = subpath ? join(tempDir, subpath) : tempDir;

  return { tempDir, pluginPath };
}

/**
 * Removes a temporary directory.
 *
 * @param tempDir - Path to temporary directory to remove
 */
export async function cleanup(tempDir: string): Promise<void> {
  try {
    await rm(tempDir, { recursive: true, force: true });
  } catch (_error) {
    // Ignore cleanup errors (temp dir will be cleaned eventually by OS)
    console.warn(`Warning: Failed to cleanup temp directory ${tempDir}`);
  }
}
