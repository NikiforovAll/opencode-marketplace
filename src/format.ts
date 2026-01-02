/**
 * Formats component counts into a human-readable string.
 * Example: "1 command, 2 agents, 1 skill"
 */
export function formatComponentCount(components: {
  commands: string[];
  agents: string[];
  skills: string[];
}): string {
  const parts: string[] = [];

  if (components.commands.length > 0) {
    parts.push(
      `${components.commands.length} command${components.commands.length === 1 ? "" : "s"}`,
    );
  }

  if (components.agents.length > 0) {
    parts.push(`${components.agents.length} agent${components.agents.length === 1 ? "" : "s"}`);
  }

  if (components.skills.length > 0) {
    parts.push(`${components.skills.length} skill${components.skills.length === 1 ? "" : "s"}`);
  }

  return parts.join(", ");
}
