import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverComponents } from "../src/discovery";

describe("Discovery", () => {
  const tmpDir = join(process.cwd(), "tests", "tmp-discovery");
  const pluginName = "test-plugin";

  beforeAll(async () => {
    // Clean up if exists
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("should discover commands from .opencode/commands", async () => {
    const root = join(tmpDir, "p1");
    await mkdir(join(root, ".opencode/commands"), { recursive: true });
    await writeFile(join(root, ".opencode/commands/cmd1.md"), "content");

    const components = await discoverComponents(root, pluginName);
    const commands = components.filter((c) => c.type === "command");

    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe("cmd1.md");
    expect(commands[0].targetName).toBe("test-plugin--cmd1.md");
  });

  test("should fallback to .claude/commands if .opencode missing", async () => {
    const root = join(tmpDir, "p2");
    await mkdir(join(root, ".claude/commands"), { recursive: true });
    await writeFile(join(root, ".claude/commands/cmd2.md"), "content");

    const components = await discoverComponents(root, pluginName);
    const commands = components.filter((c) => c.type === "command");

    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe("cmd2.md");
  });

  test("should prioritize .opencode over .claude", async () => {
    const root = join(tmpDir, "p3");
    await mkdir(join(root, ".opencode/commands"), { recursive: true });
    await mkdir(join(root, ".claude/commands"), { recursive: true });

    await writeFile(join(root, ".opencode/commands/primary.md"), "content");
    await writeFile(join(root, ".claude/commands/secondary.md"), "content");

    const components = await discoverComponents(root, pluginName);
    const commands = components.filter((c) => c.type === "command");

    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe("primary.md");
  });

  test("should discover agents from valid paths", async () => {
    const root = join(tmpDir, "p4");
    await mkdir(join(root, "agent"), { recursive: true });
    await writeFile(join(root, "agent/agent1.md"), "content");

    const components = await discoverComponents(root, pluginName);
    const agents = components.filter((c) => c.type === "agent");

    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe("agent1.md");
  });

  test("should discover skills only if SKILL.md exists", async () => {
    const root = join(tmpDir, "p5");
    const skillBase = join(root, "skill");
    await mkdir(skillBase, { recursive: true });

    // Valid skill
    await mkdir(join(skillBase, "valid-skill"));
    await writeFile(join(skillBase, "valid-skill/SKILL.md"), "# Skill");

    // Invalid skill (no SKILL.md)
    await mkdir(join(skillBase, "invalid-skill"));
    await writeFile(join(skillBase, "invalid-skill/readme.md"), "# Not a skill");

    const components = await discoverComponents(root, pluginName);
    const skills = components.filter((c) => c.type === "skill");

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("valid-skill");
  });

  test("should ignore non-md files for commands/agents", async () => {
    const root = join(tmpDir, "p6");
    await mkdir(join(root, "command"), { recursive: true });
    await writeFile(join(root, "command/cmd.md"), "valid");
    await writeFile(join(root, "command/cmd.js"), "invalid");

    const components = await discoverComponents(root, pluginName);
    const commands = components.filter((c) => c.type === "command");

    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe("cmd.md");
  });
});
