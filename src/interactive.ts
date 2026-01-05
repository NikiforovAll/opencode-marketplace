import { checkbox, Separator } from "@inquirer/prompts";
import type { DiscoveredComponent } from "./types";

export interface SelectionResult {
  selected: DiscoveredComponent[];
  cancelled: boolean;
}

/**
 * Presents an interactive multi-select UI for choosing components to install
 * @param pluginName - Name of the plugin being installed
 * @param components - All discovered components
 * @returns Selected components or empty array if cancelled/nothing selected
 * @throws Error if not running in a TTY
 */
export async function selectComponents(
  pluginName: string,
  components: DiscoveredComponent[],
): Promise<SelectionResult> {
  // Check TTY
  if (!process.stdin.isTTY) {
    throw new Error("Interactive mode requires a terminal");
  }

  // Group by type
  const grouped = groupByType(components);

  // Build choices with separators
  const choices = buildChoices(grouped);

  if (choices.length === 0) {
    return { selected: [], cancelled: false };
  }

  try {
    const selected = await checkbox({
      message: `Select components to install from "${pluginName}":`,
      choices,
      pageSize: 15,
    });

    return { selected, cancelled: false };
  } catch (error) {
    // Handle Ctrl+C gracefully
    if (error instanceof Error && error.message.includes("User force closed")) {
      return { selected: [], cancelled: true };
    }
    throw error;
  }
}

interface GroupedComponents {
  commands: DiscoveredComponent[];
  agents: DiscoveredComponent[];
  skills: DiscoveredComponent[];
}

/**
 * Groups components by their type
 */
function groupByType(components: DiscoveredComponent[]): GroupedComponents {
  return {
    commands: components.filter((c) => c.type === "command"),
    agents: components.filter((c) => c.type === "agent"),
    skills: components.filter((c) => c.type === "skill"),
  };
}

/**
 * Builds inquirer choices with separators and proper formatting
 */
function buildChoices(
  grouped: GroupedComponents,
): Array<Separator | { name: string; value: DiscoveredComponent }> {
  const choices: Array<Separator | { name: string; value: DiscoveredComponent }> = [];

  if (grouped.commands.length > 0) {
    if (choices.length > 0) choices.push(new Separator(""));
    choices.push(new Separator(`\x1b[1m📋 Commands (${grouped.commands.length})\x1b[0m`));
    choices.push(new Separator("─".repeat(50)));
    for (const c of grouped.commands) {
      choices.push({ name: `  ${c.name}`, value: c });
    }
  }

  if (grouped.agents.length > 0) {
    if (choices.length > 0) choices.push(new Separator(""));
    choices.push(new Separator(`\x1b[1m🤖 Agents (${grouped.agents.length})\x1b[0m`));
    choices.push(new Separator("─".repeat(50)));
    for (const c of grouped.agents) {
      choices.push({ name: `  ${c.name}`, value: c });
    }
  }

  if (grouped.skills.length > 0) {
    if (choices.length > 0) choices.push(new Separator(""));
    choices.push(new Separator(`\x1b[1m🎯 Skills (${grouped.skills.length})\x1b[0m`));
    choices.push(new Separator("─".repeat(50)));
    for (const c of grouped.skills) {
      choices.push({ name: `  ${c.name}/`, value: c });
    }
  }

  return choices;
}
