import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, normalize } from "node:path";
import type { OcmConfig } from "./types";

function getDefaultSkillsBase(): string {
  return join(homedir(), ".agents");
}

let cachedConfig: OcmConfig | null = null;
let agentsOverride = false;

export function setAgentsOverride(): void {
  agentsOverride = true;
}

export function getConfigPath(): string {
  return join(homedir(), ".config", "opencode", "ocm-config.json");
}

export function loadConfig(): OcmConfig {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    cachedConfig = {};
    return cachedConfig;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);
    cachedConfig = {};

    if (parsed && typeof parsed === "object" && typeof parsed.skillsPath === "string") {
      let skillsPath = parsed.skillsPath;
      if (skillsPath.startsWith("~/") || skillsPath === "~") {
        skillsPath = join(homedir(), skillsPath.slice(2));
      }
      cachedConfig.skillsPath = normalize(skillsPath);
    }

    return cachedConfig;
  } catch {
    cachedConfig = {};
    return cachedConfig;
  }
}

export function resolveUserSkillsPath(): string {
  if (agentsOverride) {
    return join(getDefaultSkillsBase(), "skills");
  }
  const config = loadConfig();
  const base = config.skillsPath || getDefaultSkillsBase();
  return join(base, "skills");
}

export function resetConfigCache(): void {
  cachedConfig = null;
  agentsOverride = false;
}
