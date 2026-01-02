import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { install } from "../../src/commands/install";
import { uninstall } from "../../src/commands/uninstall";
import { loadRegistry, saveRegistry } from "../../src/registry";

describe("Uninstall Command", () => {
  const tmpDir = join(process.cwd(), "tests", "tmp-uninstall-cmd");
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

  test("should uninstall existing plugin with all component types", async () => {
    // First, install a plugin
    const pluginDir = join(pluginsDir, "test-uninstall");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await mkdir(join(pluginDir, "agent"), { recursive: true });
    await mkdir(join(pluginDir, "skill", "review"), { recursive: true });

    await writeFile(join(pluginDir, "command/cmd1.md"), "# Command 1");
    await writeFile(join(pluginDir, "agent/helper.md"), "# Agent Helper");
    await writeFile(join(pluginDir, "skill/review/SKILL.md"), "# Review Skill");
    await writeFile(join(pluginDir, "skill/review/data.json"), '{"test": true}');

    const installSpy = spyOn(console, "log");
    const installExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await install(pluginDir, { scope: "project", force: false, verbose: false });

    installSpy.mockRestore();
    installExitSpy.mockRestore();

    // Verify plugin was installed
    expect(existsSync(join(installDir, ".opencode/command/test-uninstall--cmd1.md"))).toBe(true);
    expect(existsSync(join(installDir, ".opencode/agent/test-uninstall--helper.md"))).toBe(true);
    expect(existsSync(join(installDir, ".opencode/skill/test-uninstall--review/SKILL.md"))).toBe(
      true,
    );

    // Now uninstall it
    const uninstallSpy = spyOn(console, "log");
    const warnSpy = spyOn(console, "warn");
    const uninstallExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await uninstall("test-uninstall", { scope: "project", verbose: false });

    const output = uninstallSpy.mock.calls.map((call) => call[0]).join("\n");
    const warningOutput = warnSpy.mock.calls.map((call) => call.join(" ")).join("\n");

    // Verify output
    expect(output).toContain("Uninstalling test-uninstall");
    expect(output).toContain("✗ command/test-uninstall--cmd1.md");
    expect(output).toContain("✗ agent/test-uninstall--helper.md");
    expect(output).toContain("✗ skill/test-uninstall--review");
    expect(output).toContain(
      "Uninstalled test-uninstall (1 command, 1 agent, 1 skill) from project scope.",
    );

    // Verify no warnings (all files should exist)
    expect(warningOutput).toBe("");

    // Verify files were deleted
    expect(existsSync(join(installDir, ".opencode/command/test-uninstall--cmd1.md"))).toBe(false);
    expect(existsSync(join(installDir, ".opencode/agent/test-uninstall--helper.md"))).toBe(false);
    expect(existsSync(join(installDir, ".opencode/skill/test-uninstall--review"))).toBe(false);

    // Verify registry was updated
    const registry = await loadRegistry("project");
    expect(registry.plugins["test-uninstall"]).toBeUndefined();

    uninstallSpy.mockRestore();
    warnSpy.mockRestore();
    uninstallExitSpy.mockRestore();
  });

  test("should error on uninstalling non-existent plugin", async () => {
    const consoleSpy = spyOn(console, "log");
    const errorSpy = spyOn(console, "error");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await uninstall("nonexistent", { scope: "project", verbose: false });
    } catch (_error) {
      // Expected to throw
    }

    const output = consoleSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    const errorOutput = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");

    // Should show no uninstall output
    expect(output).toBe("");

    // Should show helpful error message
    expect(errorOutput).toContain('Plugin "nonexistent" is not installed in project scope.');
    expect(errorOutput).toContain(
      "Run 'opencode-marketplace list --scope project' to see installed plugins.",
    );

    consoleSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("should handle uninstall with some missing component files", async () => {
    // Install plugin first
    const pluginDir = join(pluginsDir, "partial-missing");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await mkdir(join(pluginDir, "agent"), { recursive: true });

    await writeFile(join(pluginDir, "command/test.md"), "# Test Command");
    await writeFile(join(pluginDir, "agent/helper.md"), "# Agent Helper");

    const installSpy = spyOn(console, "log");
    const installExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await install(pluginDir, { scope: "project", force: false, verbose: false });

    installSpy.mockRestore();
    installExitSpy.mockRestore();

    // Manually delete one component file
    await rm(join(installDir, ".opencode/agent/partial-missing--helper.md"));

    // Now uninstall
    const uninstallSpy = spyOn(console, "log");
    const warnSpy = spyOn(console, "warn");
    const uninstallExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await uninstall("partial-missing", { scope: "project", verbose: false });

    const output = uninstallSpy.mock.calls.map((call) => call[0]).join("\n");
    const warningOutput = warnSpy.mock.calls.map((call) => call.join(" ")).join("\n");

    // Verify output shows warning for missing file
    expect(output).toContain("✗ command/partial-missing--test.md");
    expect(output).toContain("⚠ agent/partial-missing--helper.md (already deleted)");
    expect(output).toContain(
      "Uninstalled partial-missing (1 command, 1 agent) from project scope.",
    );

    // Verify warning is shown
    expect(warningOutput).toContain("Warning: 1 component(s) were already deleted.");

    // Verify registry was cleaned up
    const registry = await loadRegistry("project");
    expect(registry.plugins["partial-missing"]).toBeUndefined();

    uninstallSpy.mockRestore();
    warnSpy.mockRestore();
    uninstallExitSpy.mockRestore();
  });

  test("should uninstall from correct scope only", async () => {
    // Install plugin in project scope
    const pluginDir = join(pluginsDir, "scope-test");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await writeFile(join(pluginDir, "command/test.md"), "# Test");

    const installSpy = spyOn(console, "log");
    const installExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await install(pluginDir, { scope: "project", force: false, verbose: false });

    installSpy.mockRestore();
    installExitSpy.mockRestore();

    // Try to uninstall from user scope (should fail)
    const consoleSpy = spyOn(console, "log");
    const errorSpy = spyOn(console, "error");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await uninstall("scope-test", { scope: "user", verbose: false });
    } catch (_error) {
      // Expected to throw
    }

    const output = consoleSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    const errorOutput = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");

    // Should show error
    expect(output).toBe("");
    expect(errorOutput).toContain('Plugin "scope-test" is not installed in user scope.');

    // But should be able to uninstall from project scope
    consoleSpy.mockClear();
    errorSpy.mockClear();

    await uninstall("scope-test", { scope: "project", verbose: false });

    const successOutput = consoleSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(successOutput).toContain("Uninstalled scope-test");

    // Verify file was deleted
    expect(existsSync(join(installDir, ".opencode/command/scope-test--test.md"))).toBe(false);

    consoleSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("should show verbose output", async () => {
    const pluginDir = join(pluginsDir, "verbose-test");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await writeFile(join(pluginDir, "command/test.md"), "# Test");

    const installSpy = spyOn(console, "log");
    const installExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await install(pluginDir, { scope: "project", force: false, verbose: false });

    installSpy.mockRestore();
    installExitSpy.mockRestore();

    const uninstallSpy = spyOn(console, "log");
    const warnSpy = spyOn(console, "warn");
    const uninstallExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await uninstall("verbose-test", { scope: "project", verbose: true });

    const output = uninstallSpy.mock.calls.map((call) => call[0]).join("\n");
    const warningOutput = warnSpy.mock.calls.map((call) => call.join(" ")).join("\n");

    // Verify verbose output
    expect(output).toContain('[VERBOSE] Found plugin "verbose-test" with hash');
    expect(output).toContain("[VERBOSE] Plugin has 1 components to remove");
    expect(output).toContain("[VERBOSE] Deleting command/verbose-test--test.md");
    expect(output).toContain('[VERBOSE] Updating registry to remove plugin "verbose-test"');
    expect(output).toContain("[VERBOSE] Registry updated successfully");
    expect(output).toContain("Uninstalled verbose-test (1 command) from project scope.");

    // Should not show warnings (no missing files)
    expect(warningOutput).toBe("");

    uninstallSpy.mockRestore();
    warnSpy.mockRestore();
    uninstallExitSpy.mockRestore();
  });

  test("should handle plugin with only skills", async () => {
    const pluginDir = join(pluginsDir, "skills-only-uninstall");
    await mkdir(join(pluginDir, "skill", "task1"), { recursive: true });
    await mkdir(join(pluginDir, "skill", "task2"), { recursive: true });

    await writeFile(join(pluginDir, "skill/task1/SKILL.md"), "# Task 1");
    await writeFile(join(pluginDir, "skill/task2/SKILL.md"), "# Task 2");
    await writeFile(join(pluginDir, "skill/task2/helper.js"), "// Helper");

    const installSpy = spyOn(console, "log");
    const installExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await install(pluginDir, { scope: "project", force: false, verbose: false });

    installSpy.mockRestore();
    installExitSpy.mockRestore();

    // Verify skill directories were created
    expect(existsSync(join(installDir, ".opencode/skill/skills-only-uninstall--task1"))).toBe(true);
    expect(existsSync(join(installDir, ".opencode/skill/skills-only-uninstall--task2"))).toBe(true);

    // Uninstall
    const uninstallSpy = spyOn(console, "log");
    const uninstallExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await uninstall("skills-only-uninstall", { scope: "project", verbose: false });

    const output = uninstallSpy.mock.calls.map((call) => call[0]).join("\n");

    // Verify output
    expect(output).toContain("✗ skill/skills-only-uninstall--task1");
    expect(output).toContain("✗ skill/skills-only-uninstall--task2");
    expect(output).toContain("Uninstalled skills-only-uninstall (2 skills) from project scope.");

    // Verify skill directories were deleted
    expect(existsSync(join(installDir, ".opencode/skill/skills-only-uninstall--task1"))).toBe(
      false,
    );
    expect(existsSync(join(installDir, ".opencode/skill/skills-only-uninstall--task2"))).toBe(
      false,
    );

    uninstallSpy.mockRestore();
    uninstallExitSpy.mockRestore();
  });

  test("should be idempotent (uninstall twice fails on second)", async () => {
    const pluginDir = join(pluginsDir, "idempotent-test");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await writeFile(join(pluginDir, "command/test.md"), "# Test");

    // Install once
    const installSpy = spyOn(console, "log");
    const installExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await install(pluginDir, { scope: "project", force: false, verbose: false });

    installSpy.mockRestore();
    installExitSpy.mockRestore();

    // First uninstall should succeed
    const uninstallSpy = spyOn(console, "log");
    const errorSpy = spyOn(console, "error");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await uninstall("idempotent-test", { scope: "project", verbose: false });

    const firstOutput = uninstallSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(firstOutput).toContain("Uninstalled idempotent-test");

    // Clear spies for second attempt
    uninstallSpy.mockClear();
    errorSpy.mockClear();

    // Second uninstall should fail
    try {
      await uninstall("idempotent-test", { scope: "project", verbose: false });
    } catch (_error) {
      // Expected to throw
    }

    const secondOutput = uninstallSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    const errorOutput = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");

    // Should show error, not uninstall output
    expect(secondOutput).toBe("");
    expect(errorOutput).toContain('Plugin "idempotent-test" is not installed in project scope.');

    uninstallSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("should preserve other plugins in registry", async () => {
    // Install two plugins
    const plugin1Dir = join(pluginsDir, "plugin-1");
    const plugin2Dir = join(pluginsDir, "plugin-2");

    await mkdir(join(plugin1Dir, "command"), { recursive: true });
    await mkdir(join(plugin2Dir, "agent"), { recursive: true });

    await writeFile(join(plugin1Dir, "command/test1.md"), "# Test 1");
    await writeFile(join(plugin2Dir, "agent/test2.md"), "# Test 2");

    const installSpy = spyOn(console, "log");
    const installExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await install(plugin1Dir, { scope: "project", force: false, verbose: false });
    await install(plugin2Dir, { scope: "project", force: false, verbose: false });

    installSpy.mockRestore();
    installExitSpy.mockRestore();

    // Verify both are installed
    const registry1 = await loadRegistry("project");
    expect(registry1.plugins["plugin-1"]).toBeDefined();
    expect(registry1.plugins["plugin-2"]).toBeDefined();

    // Uninstall only plugin-1
    const uninstallSpy = spyOn(console, "log");
    const uninstallExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await uninstall("plugin-1", { scope: "project", verbose: false });

    const output = uninstallSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain("Uninstalled plugin-1");

    // Verify only plugin-1 was removed from registry
    const registry2 = await loadRegistry("project");
    expect(registry2.plugins["plugin-1"]).toBeUndefined();
    expect(registry2.plugins["plugin-2"]).toBeDefined();

    // Verify only plugin-1 files were deleted
    expect(existsSync(join(installDir, ".opencode/command/plugin-1--test1.md"))).toBe(false);
    expect(existsSync(join(installDir, ".opencode/agent/plugin-2--test2.md"))).toBe(true);

    uninstallSpy.mockRestore();
    uninstallExitSpy.mockRestore();
  });

  test("should handle plugin with zero components gracefully", async () => {
    // Manually create registry entry with empty plugin
    const registry = await loadRegistry("project");
    registry.plugins["empty-plugin"] = {
      name: "empty-plugin",
      hash: "abcd1234",
      scope: "project",
      source: { type: "local", path: "/fake/path" },
      installedAt: new Date().toISOString(),
      components: {
        commands: [],
        agents: [],
        skills: [],
      },
    };
    await saveRegistry(registry, "project");

    // Uninstall the empty plugin
    const uninstallSpy = spyOn(console, "log");
    const warnSpy = spyOn(console, "warn");
    const uninstallExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await uninstall("empty-plugin", { scope: "project", verbose: false });

    const output = uninstallSpy.mock.calls.map((call) => call[0]).join("\n");
    const warningOutput = warnSpy.mock.calls.map((call) => call.join(" ")).join("\n");

    // Should show 0 components
    expect(output).toContain("Uninstalled empty-plugin () from project scope.");
    expect(warningOutput).toBe("");

    // Verify registry entry was removed
    const registry2 = await loadRegistry("project");
    expect(registry2.plugins["empty-plugin"]).toBeUndefined();

    uninstallSpy.mockRestore();
    warnSpy.mockRestore();
    uninstallExitSpy.mockRestore();
  });
});
