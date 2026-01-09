import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { importPlugins } from "../../src/commands/import";
import { loadRegistry } from "../../src/registry";

describe("Import Command", () => {
  const tmpDir = join(process.cwd(), "tests", "tmp-import-cmd");
  const pluginsDir = join(tmpDir, "plugins");
  const targetDir = join(tmpDir, "target");
  const configPath = join(tmpDir, "ocm-import.json");

  beforeAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(tmpDir, { recursive: true });
    await mkdir(pluginsDir, { recursive: true });
    await mkdir(targetDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("should import plugins from config file", async () => {
    // Setup plugin 1
    const plugin1Dir = join(pluginsDir, "plugin1");
    await mkdir(join(plugin1Dir, "command"), { recursive: true });
    await writeFile(join(plugin1Dir, "command/cmd1.md"), "# Cmd 1");

    // Setup plugin 2
    const plugin2Dir = join(pluginsDir, "plugin2");
    await mkdir(join(plugin2Dir, "agent"), { recursive: true });
    await writeFile(join(plugin2Dir, "agent/agent1.md"), "# Agent 1");

    // Create config file
    const config = {
      plugins: [plugin1Dir, plugin2Dir],
    };
    await writeFile(configPath, JSON.stringify(config));

    const consoleSpy = spyOn(console, "log");
    const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit called with ${code}`);
    });

    await importPlugins(configPath, {
      targetDir,
      force: false,
      verbose: false,
    });

    const output = consoleSpy.mock.calls.map((call) => String(call[0])).join("\n");

    expect(output).toContain("Import complete:");
    expect(output).toContain("Installed: 2");
    expect(output).toContain("Updated:   0");
    expect(output).toContain("Skipped:   0");

    // Verify files
    expect(existsSync(join(targetDir, "command/plugin1--cmd1.md"))).toBe(true);
    expect(existsSync(join(targetDir, "agent/plugin2--agent1.md"))).toBe(true);

    // Verify registry
    const registry = await loadRegistry("user", targetDir);
    expect(registry.plugins.plugin1).toBeDefined();
    expect(registry.plugins.plugin2).toBeDefined();

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("should skip already installed plugins with same hash", async () => {
    const consoleSpy = spyOn(console, "log");
    const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit called with ${code}`);
    });

    await importPlugins(configPath, {
      targetDir,
      force: false,
      verbose: false,
    });

    const output = consoleSpy.mock.calls.map((call) => String(call[0])).join("\n");

    expect(output).toContain("Import complete:");
    expect(output).toContain("Installed: 0");
    expect(output).toContain("Updated:   0");
    expect(output).toContain("Skipped:   2");

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("should update plugins when content changes", async () => {
    // Modify plugin 1
    const plugin1Dir = join(pluginsDir, "plugin1");
    await writeFile(join(plugin1Dir, "command/cmd1.md"), "# Cmd 1 updated");

    const consoleSpy = spyOn(console, "log");
    const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit called with ${code}`);
    });

    await importPlugins(configPath, {
      targetDir,
      force: false,
      verbose: false,
    });

    const output = consoleSpy.mock.calls.map((call) => String(call[0])).join("\n");

    expect(output).toContain("Import complete:");
    expect(output).toContain("Installed: 0");
    expect(output).toContain("Updated:   1");
    expect(output).toContain("Skipped:   1");

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("should resolve relative paths in config", async () => {
    const relConfigPath = join(tmpDir, "rel-config.json");
    // Plugin is in ./plugins/plugin1 relative to rel-config.json's dir (tmpDir)
    const config = {
      plugins: ["./plugins/plugin1"],
    };
    await writeFile(relConfigPath, JSON.stringify(config));

    const consoleSpy = spyOn(console, "log");
    const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit called with ${code}`);
    });

    await importPlugins(relConfigPath, {
      targetDir,
      force: true,
      verbose: false,
    });

    const output = consoleSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Import complete:");
    // Since we used force and the hash is different from the very first install (it was updated in previous test),
    // it will be "updated" or "installed".
    expect(output).toContain("Failed:    0");

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("should handle failed installations and continue", async () => {
    const configWithFail = {
      plugins: [join(pluginsDir, "non-existent"), join(pluginsDir, "plugin2")],
    };
    const failConfigPath = join(tmpDir, "fail-config.json");
    await writeFile(failConfigPath, JSON.stringify(configWithFail));

    const consoleSpy = spyOn(console, "log");
    const consoleErrorSpy = spyOn(console, "error");
    const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit called with ${code}`);
    });

    try {
      await importPlugins(failConfigPath, {
        targetDir,
        force: false,
        verbose: false,
      });
    } catch (e) {
      expect(e.message).toContain("process.exit called with 1");
    }

    const output = consoleSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Import complete:");
    expect(output).toContain("Failed:    1");
    expect(output).toContain("Skipped:   1"); // plugin2 was already installed

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
