import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { install } from "../../src/commands/install";
import { loadRegistry } from "../../src/registry";

describe("Install Command", () => {
  const tmpDir = join(process.cwd(), "tests", "tmp-install-cmd");
  const pluginsDir = join(tmpDir, "plugins");
  const installDir = join(tmpDir, "install-target");

  beforeAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(tmpDir, { recursive: true });
    await mkdir(pluginsDir, { recursive: true });
    await mkdir(installDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Mock process.cwd() to use our test install directory for project scope
    const originalCwd = process.cwd;
    process.cwd = () => installDir;

    return () => {
      process.cwd = originalCwd;
    };
  });

  test("should install plugin with commands, agents, and skills to project scope", async () => {
    const pluginDir = join(pluginsDir, "test-plugin");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await mkdir(join(pluginDir, "agent"), { recursive: true });
    await mkdir(join(pluginDir, "skill", "review"), { recursive: true });

    await writeFile(join(pluginDir, "command/cmd1.md"), "# Command 1");
    await writeFile(join(pluginDir, "agent/helper.md"), "# Agent Helper");
    await writeFile(join(pluginDir, "skill/review/SKILL.md"), "# Review Skill");
    await writeFile(join(pluginDir, "skill/review/data.json"), '{"test": true}');

    const consoleSpy = spyOn(console, "log");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await install(pluginDir, { scope: "project", force: false, verbose: false });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");

    // Verify output
    expect(output).toContain("Installing test-plugin");
    expect(output).toContain("→ command/test-plugin--cmd1.md");
    expect(output).toContain("→ agent/test-plugin--helper.md");
    expect(output).toContain("→ skill/test-plugin--review");
    expect(output).toContain("Installed test-plugin");
    expect(output).toContain("1 command, 1 agent, 1 skill");

    // Verify files were copied
    expect(existsSync(join(installDir, ".opencode/command/test-plugin--cmd1.md"))).toBe(true);
    expect(existsSync(join(installDir, ".opencode/agent/test-plugin--helper.md"))).toBe(true);
    expect(existsSync(join(installDir, ".opencode/skill/test-plugin--review/SKILL.md"))).toBe(true);
    expect(existsSync(join(installDir, ".opencode/skill/test-plugin--review/data.json"))).toBe(
      true,
    );

    // Verify registry was updated
    const registry = await loadRegistry("project");
    expect(registry.plugins["test-plugin"]).toBeDefined();
    expect(registry.plugins["test-plugin"].components.commands).toEqual(["test-plugin--cmd1.md"]);
    expect(registry.plugins["test-plugin"].components.agents).toEqual(["test-plugin--helper.md"]);
    expect(registry.plugins["test-plugin"].components.skills).toEqual(["test-plugin--review"]);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();

    // Cleanup
    await rm(join(installDir, ".opencode"), { recursive: true, force: true });
  });

  test("should reinstall plugin with same hash", async () => {
    const pluginDir = join(pluginsDir, "reinstall-test");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await writeFile(join(pluginDir, "command/test.md"), "# Test Command");

    const consoleSpy = spyOn(console, "log");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    // First install
    await install(pluginDir, { scope: "project", force: false, verbose: false });

    consoleSpy.mockClear();

    // Second install (should succeed)
    await install(pluginDir, { scope: "project", force: false, verbose: false });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain("Installing reinstall-test");
    expect(output).toContain("Installed reinstall-test");

    consoleSpy.mockRestore();
    exitSpy.mockRestore();

    // Cleanup
    await rm(join(installDir, ".opencode"), { recursive: true, force: true });
  });

  test("should update plugin with different hash", async () => {
    const pluginDir = join(pluginsDir, "update-test");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await writeFile(join(pluginDir, "command/test.md"), "# Version 1");

    const consoleSpy = spyOn(console, "log");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    // First install
    await install(pluginDir, { scope: "project", force: false, verbose: false });

    // Modify plugin content
    await writeFile(join(pluginDir, "command/test.md"), "# Version 2 - Updated");

    consoleSpy.mockClear();

    // Second install with updated content
    await install(pluginDir, { scope: "project", force: false, verbose: true });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain("[VERBOSE] Updating plugin from");

    consoleSpy.mockRestore();
    exitSpy.mockRestore();

    // Cleanup
    await rm(join(installDir, ".opencode"), { recursive: true, force: true });
  });

  test("should detect conflict from different plugin without force", async () => {
    const plugin1Dir = join(pluginsDir, "plugin-one");
    const plugin2Dir = join(pluginsDir, "plugin-two");

    await mkdir(join(plugin1Dir, "command"), { recursive: true });
    await mkdir(join(plugin2Dir, "command"), { recursive: true });

    await writeFile(join(plugin1Dir, "command/shared.md"), "# Plugin One");
    await writeFile(join(plugin2Dir, "command/shared.md"), "# Plugin Two");

    const consoleSpy = spyOn(console, "log");
    const errorSpy = spyOn(console, "error");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    // Install plugin-one first
    await install(plugin1Dir, { scope: "project", force: false, verbose: false });

    // Manually create conflicting file from plugin-two to simulate conflict
    // (We need to manually create because same component name won't conflict with same plugin)
    await writeFile(
      join(installDir, ".opencode/command/plugin-two--shared.md"),
      "# Conflicting file",
    );

    // Rename plugin-two directory to cause actual conflict
    // Actually, let's create a proper conflict by having different plugins with overlapping component names
    // But since our prefixing prevents this, we need to test untracked file conflict

    consoleSpy.mockClear();
    errorSpy.mockClear();

    // Create untracked file that will conflict
    await writeFile(join(installDir, ".opencode/command/conflict-plugin--test.md"), "# Untracked");

    const conflictPlugin = join(pluginsDir, "conflict-plugin");
    await mkdir(join(conflictPlugin, "command"), { recursive: true });
    await writeFile(join(conflictPlugin, "command/test.md"), "# Test");

    try {
      await install(conflictPlugin, { scope: "project", force: false, verbose: false });
    } catch (_error) {
      // Expected to throw
    }

    const errorOutput = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(errorOutput).toContain("Conflict detected");
    expect(errorOutput).toContain("exists but is untracked");
    expect(errorOutput).toContain("--force");

    consoleSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();

    // Cleanup
    await rm(join(installDir, ".opencode"), { recursive: true, force: true });
  });

  test("should override conflict with force flag", async () => {
    const pluginDir = join(pluginsDir, "force-test");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await writeFile(join(pluginDir, "command/test.md"), "# Test");

    // Create untracked conflicting file
    await mkdir(join(installDir, ".opencode/command"), { recursive: true });
    await writeFile(join(installDir, ".opencode/command/force-test--test.md"), "# Old content");

    const consoleSpy = spyOn(console, "log");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await install(pluginDir, { scope: "project", force: true, verbose: false });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain("Installed force-test");

    // Verify file was overwritten
    const content = await readFile(
      join(installDir, ".opencode/command/force-test--test.md"),
      "utf-8",
    );
    expect(content).toBe("# Test");

    consoleSpy.mockRestore();
    exitSpy.mockRestore();

    // Cleanup
    await rm(join(installDir, ".opencode"), { recursive: true, force: true });
  });

  test("should error on non-existent plugin directory", async () => {
    const consoleSpy = spyOn(console, "log");
    const errorSpy = spyOn(console, "error");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await install(join(pluginsDir, "non-existent"), {
        scope: "project",
        force: false,
        verbose: false,
      });
    } catch (_error) {
      // Expected to throw
    }

    const errorOutput = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(errorOutput).toContain("Plugin directory not found");

    consoleSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("should error on plugin with no components", async () => {
    const emptyPlugin = join(pluginsDir, "empty-plugin");
    await mkdir(emptyPlugin, { recursive: true });

    const consoleSpy = spyOn(console, "log");
    const errorSpy = spyOn(console, "error");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await install(emptyPlugin, { scope: "project", force: false, verbose: false });
    } catch (_error) {
      // Expected to throw
    }

    const errorOutput = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(errorOutput).toContain("No components found");

    consoleSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("should handle verbose mode correctly", async () => {
    const pluginDir = join(pluginsDir, "verbose-plugin");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await writeFile(join(pluginDir, "command/test.md"), "# Test");

    const consoleSpy = spyOn(console, "log");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await install(pluginDir, { scope: "project", force: false, verbose: true });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain("[VERBOSE] Resolved plugin name: verbose-plugin");
    expect(output).toContain("[VERBOSE] Plugin hash:");
    expect(output).toContain("[VERBOSE] Found 1 component(s)");

    consoleSpy.mockRestore();
    exitSpy.mockRestore();

    // Cleanup
    await rm(join(installDir, ".opencode"), { recursive: true, force: true });
  });

  test("should install plugin with only skills", async () => {
    const pluginDir = join(pluginsDir, "skills-only");
    await mkdir(join(pluginDir, "skill/task1"), { recursive: true });
    await mkdir(join(pluginDir, "skill/task2"), { recursive: true });

    await writeFile(join(pluginDir, "skill/task1/SKILL.md"), "# Task 1");
    await writeFile(join(pluginDir, "skill/task2/SKILL.md"), "# Task 2");
    await writeFile(join(pluginDir, "skill/task2/helper.js"), "// Helper");

    const consoleSpy = spyOn(console, "log");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await install(pluginDir, { scope: "project", force: false, verbose: false });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain("Installed skills-only");
    expect(output).toContain("2 skills");

    // Verify nested files were copied
    expect(existsSync(join(installDir, ".opencode/skill/skills-only--task2/helper.js"))).toBe(true);

    const registry = await loadRegistry("project");
    expect(registry.plugins["skills-only"].components.skills).toEqual([
      "skills-only--task1",
      "skills-only--task2",
    ]);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();

    // Cleanup
    await rm(join(installDir, ".opencode"), { recursive: true, force: true });
  });

  test("should error on invalid plugin name", async () => {
    const pluginDir = join(pluginsDir, "Invalid_Name!");
    await mkdir(pluginDir, { recursive: true });
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await writeFile(join(pluginDir, "command/test.md"), "# Test");

    const consoleSpy = spyOn(console, "log");
    const errorSpy = spyOn(console, "error");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await install(pluginDir, { scope: "project", force: false, verbose: false });
    } catch (_error) {
      // Expected to throw
    }

    const errorOutput = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(errorOutput).toContain("Invalid plugin name");

    consoleSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
