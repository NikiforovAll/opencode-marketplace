export type Scope = "user" | "project";
export type ComponentType = "command" | "agent" | "skill";

export interface PluginIdentity {
  name: string;
  hash: string;
}

/**
 * Represents a discovered component before installation
 */
export interface DiscoveredComponent {
  type: ComponentType;
  sourcePath: string; // absolute path
  name: string; // original name
  targetName: string; // prefixed name
}

/**
 * Source of a plugin - either local path or remote URL
 */
export type PluginSource =
  | { type: "local"; path: string }
  | { type: "remote"; url: string; ref?: string };

export interface InstalledPlugin {
  name: string;
  hash: string;
  scope: Scope;
  source: PluginSource;
  installedAt: string; // ISO 8601 timestamp
  components: {
    commands: string[]; // list of installed filenames (prefixed)
    agents: string[]; // list of installed filenames (prefixed)
    skills: string[]; // list of installed folder names (prefixed)
  };
}

export interface PluginRegistry {
  version: 1 | 2;
  plugins: Record<string, InstalledPlugin>;
}

/**
 * Configuration for importing multiple plugins at once
 */
export interface ImportConfig {
  plugins: string[];
}

export interface OcmConfig {
  skillsPath?: string;
}

// Validation & Helpers

/**
 * Validates plugin name (lowercase alphanumeric and hyphens only)
 */
export function validatePluginName(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name);
}

/**
 * Generates the prefixed name for a component
 * Format: {plugin-name}--{original-name}
 */
export function getComponentTargetName(pluginName: string, originalName: string): string {
  return `${pluginName}--${originalName}`;
}
