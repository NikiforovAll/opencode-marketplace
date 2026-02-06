import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, normalize } from "node:path";
import { resolveUserSkillsPath } from "./config";
import type { ComponentType, Scope } from "./types";
import { getComponentTargetName } from "./types";

function pluralizeType(type: ComponentType): string {
  return `${type}s`;
}

/**
 * Returns the base directory for a component type with trailing slash.
 * Examples:
 *   - User scope: "~/.config/opencode/commands/", "~/.agents/skills/"
 *   - Project scope: ".opencode/commands/"
 */
export function getComponentDir(type: ComponentType, scope: Scope, targetDir?: string): string {
  if (scope === "user") {
    if (targetDir) {
      return `${normalize(join(targetDir, pluralizeType(type)))}/`;
    }
    if (type === "skill") {
      return `${normalize(resolveUserSkillsPath())}/`;
    }
    return `${normalize(join(homedir(), ".config", "opencode", pluralizeType(type)))}/`;
  }

  return `${normalize(join(process.cwd(), ".opencode", pluralizeType(type)))}/`;
}

/**
 * Returns the full target path for a component with plugin prefix.
 * Handles both files (commands/agents) and directories (skills).
 *
 * Examples:
 *   - Command: "~/.config/opencode/commands/myplugin--reflect.md"
 *   - Skill: "~/.agents/skills/myplugin--code-review/"
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
 * Ensures all component directories (commands, agents, skills) exist for the given scope.
 * Idempotent - safe to call multiple times.
 */
export async function ensureComponentDirsExist(scope: Scope, targetDir?: string): Promise<void> {
  const dirs: ComponentType[] = ["command", "agent", "skill"];

  await Promise.all(
    dirs.map((type) => mkdir(getComponentDir(type, scope, targetDir), { recursive: true })),
  );
}
