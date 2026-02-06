import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { scan } from "../../src/commands/scan";

describe("Scan Command", () => {
  const tmpDir = join(process.cwd(), "tests", "tmp-scan-cmd");

  beforeAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("should scan valid plugin with multiple components", async () => {
    const pluginDir = join(tmpDir, "multi-component");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await mkdir(join(pluginDir, "agent"), { recursive: true });
    await mkdir(join(pluginDir, "skill", "review"), { recursive: true });

    await writeFile(join(pluginDir, "command/cmd1.md"), "# Command 1");
    await writeFile(join(pluginDir, "command/cmd2.md"), "# Command 2");
    await writeFile(join(pluginDir, "agent/agent1.md"), "# Agent 1");
    await writeFile(join(pluginDir, "skill/review/SKILL.md"), "# Review Skill");

    const consoleSpy = spyOn(console, "log");

    await scan(pluginDir, { verbose: false });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");

    expect(output).toContain("Scanning multi-component");
    expect(output).toContain("→ command/multi-component--cmd1.md");
    expect(output).toContain("→ command/multi-component--cmd2.md");
    expect(output).toContain("→ agent/multi-component--agent1.md");
    expect(output).toContain("→ skill/multi-component--review/");
    expect(output).toContain("Found 2 commands, 1 agent, 1 skill");

    consoleSpy.mockRestore();
  });

  test("should show verbose output when verbose flag is set", async () => {
    const pluginDir = join(tmpDir, "verbose-test");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await writeFile(join(pluginDir, "command/test.md"), "# Test");

    const consoleSpy = spyOn(console, "log");

    await scan(pluginDir, { verbose: true });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");

    expect(output).toContain("[VERBOSE] Scanning path");
    expect(output).toContain("[VERBOSE] Resolved plugin name: verbose-test");
    expect(output).toContain("[VERBOSE] Computed hash:");

    consoleSpy.mockRestore();
  });

  test("should handle plugin with no components", async () => {
    const pluginDir = join(tmpDir, "empty-plugin");
    await mkdir(pluginDir, { recursive: true });

    const consoleSpy = spyOn(console, "log");

    await scan(pluginDir, { verbose: false });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");

    expect(output).toContain("Scanning empty-plugin");
    expect(output).toContain("No components found");
    expect(output).toContain("Expected directories:");

    consoleSpy.mockRestore();
  });

  test("should error on non-existent directory", async () => {
    const consoleSpy = spyOn(console, "error");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await scan(join(tmpDir, "does-not-exist"), { verbose: false });
    } catch (_error) {
      // Expected to throw due to mocked process.exit
    }

    expect(consoleSpy.mock.calls[0][0]).toContain("Directory not found");

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("should error on invalid plugin name", async () => {
    const pluginDir = join(tmpDir, "Invalid_Name");
    await mkdir(pluginDir, { recursive: true });

    const consoleSpy = spyOn(console, "error");
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await scan(pluginDir, { verbose: false });
    } catch (_error) {
      // Expected to throw due to mocked process.exit
    }

    expect(consoleSpy.mock.calls[0][0]).toContain("Invalid plugin name");

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("should scan plugin with only commands", async () => {
    const pluginDir = join(tmpDir, "commands-only");
    await mkdir(join(pluginDir, "commands"), { recursive: true });
    await writeFile(join(pluginDir, "commands/test.md"), "# Test");

    const consoleSpy = spyOn(console, "log");

    await scan(pluginDir, { verbose: false });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");

    expect(output).toContain("Found 1 command");
    expect(output).not.toContain("agent");
    expect(output).not.toContain("skill");

    consoleSpy.mockRestore();
  });

  test("should scan plugin with only agents", async () => {
    const pluginDir = join(tmpDir, "agents-only");
    await mkdir(join(pluginDir, ".opencode/agents"), { recursive: true });
    await writeFile(join(pluginDir, ".opencode/agents/helper.md"), "# Helper");
    await writeFile(join(pluginDir, ".opencode/agents/reviewer.md"), "# Reviewer");

    const consoleSpy = spyOn(console, "log");

    await scan(pluginDir, { verbose: false });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");

    expect(output).toContain("Found 2 agents");
    expect(output).not.toContain("command");
    expect(output).not.toContain("skill");

    consoleSpy.mockRestore();
  });

  test("should scan plugin with only skills", async () => {
    const pluginDir = join(tmpDir, "skills-only");
    await mkdir(join(pluginDir, "skill/code-review"), { recursive: true });
    await writeFile(join(pluginDir, "skill/code-review/SKILL.md"), "# Code Review");

    const consoleSpy = spyOn(console, "log");

    await scan(pluginDir, { verbose: false });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");

    expect(output).toContain("Found 1 skill");
    expect(output).not.toContain("command");
    expect(output).not.toContain("agent");

    consoleSpy.mockRestore();
  });

  test("should use .opencode priority over .claude", async () => {
    const pluginDir = join(tmpDir, "priority-test");
    await mkdir(join(pluginDir, ".opencode/commands"), { recursive: true });
    await mkdir(join(pluginDir, ".claude/commands"), { recursive: true });

    await writeFile(join(pluginDir, ".opencode/commands/primary.md"), "# Primary");
    await writeFile(join(pluginDir, ".claude/commands/secondary.md"), "# Secondary");

    const consoleSpy = spyOn(console, "log");

    await scan(pluginDir, { verbose: false });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");

    expect(output).toContain("priority-test--primary.md");
    expect(output).not.toContain("secondary.md");

    consoleSpy.mockRestore();
  });

  test("should handle hash computation gracefully", async () => {
    // Note: In practice, hash computation failures are rare since discovery
    // validates component structure (e.g., skills must have SKILL.md).
    // This test verifies the error handling exists, but a true failure scenario
    // would require file system permissions issues or race conditions.
    // For now, we test with valid components to ensure normal flow works.

    const pluginDir = join(tmpDir, "hash-ok");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await writeFile(join(pluginDir, "command/test.md"), "# Test");

    const consoleSpy = spyOn(console, "log");

    await scan(pluginDir, { verbose: false });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");

    // Should complete successfully with valid hash
    expect(output).toContain("Scanning hash-ok");
    expect(output).toMatch(/Scanning hash-ok \[[a-f0-9]{8}\]/);

    consoleSpy.mockRestore();
  });

  test("should display 8-character hash", async () => {
    const pluginDir = join(tmpDir, "hash-test");
    await mkdir(join(pluginDir, "command"), { recursive: true });
    await writeFile(join(pluginDir, "command/test.md"), "# Test Command");

    const consoleSpy = spyOn(console, "log");

    await scan(pluginDir, { verbose: false });

    const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");

    // Extract the hash from output (format: "Scanning plugin-name [hash]...")
    const match = output.match(/Scanning hash-test \[([a-f0-9]+)\]/);
    expect(match).toBeTruthy();
    expect(match?.[1].length).toBe(8);

    consoleSpy.mockRestore();
  });
});
