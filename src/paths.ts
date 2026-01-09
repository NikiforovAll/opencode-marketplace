import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, normalize } from "node:path";
import type { ComponentType, Scope } from "./types";
import { getComponentTargetName } from "./types";

/**
 * Returns the base directory for a component type with trailing slash.
 * Examples:
 *   - User scope: "~/.config/opencode/command/"
 *   - Project scope: ".opencode/command/"
 */
export function getComponentDir(type: ComponentType, scope: Scope, targetDir?: string): string {
  const basePath =
    scope === "user"
      ? join(targetDir || join(homedir(), ".config", "opencode"), type)
      : join(process.cwd(), ".opencode", type);

  return `${normalize(basePath)}/`;
}

/**
 * Returns the full target path for a component with plugin prefix.
 * Handles both files (commands/agents) and directories (skills).
 *
 * Examples:
 *   - Command: "~/.config/opencode/command/myplugin--reflect.md"
 *   - Skill: "~/.config/opencode/skill/myplugin--code-review/"
 */
export function getComponentTargetPath(
  pluginName: string,
  componentName: string,
  type: ComponentType,
  scope: Scope,
  targetDir?: string,
): string {
  const baseDir = getComponentDir(type, scope, targetDir);
  const targetName = getComponentTargetName(pluginName, componentName);
  const fullPath = join(baseDir, targetName);

  // For skills (directories), ensure trailing slash; for files, no trailing slash
  if (type === "skill") {
    return `${normalize(fullPath)}/`;
  }

  return normalize(fullPath);
}

/**
 * Ensures all component directories (command, agent, skill) exist for the given scope.
 * Idempotent - safe to call multiple times.
 */
export async function ensureComponentDirsExist(scope: Scope, targetDir?: string): Promise<void> {
  const dirs: ComponentType[] = ["command", "agent", "skill"];

  await Promise.all(
    dirs.map((type) => mkdir(getComponentDir(type, scope, targetDir), { recursive: true })),
  );
}
