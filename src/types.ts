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

export interface InstalledPlugin {
  name: string;
  hash: string;
  scope: Scope;
  sourcePath: string;
  installedAt: string; // ISO 8601 timestamp
  components: {
    commands: string[]; // list of installed filenames (prefixed)
    agents: string[]; // list of installed filenames (prefixed)
    skills: string[]; // list of installed folder names (prefixed)
  };
}

export interface PluginRegistry {
  version: 1;
  plugins: Record<string, InstalledPlugin>;
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
