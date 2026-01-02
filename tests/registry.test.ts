import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getAllInstalledPlugins,
  getInstalledPlugin,
  getRegistryPath,
  loadRegistry,
  saveRegistry,
} from "../src/registry";
import type { InstalledPlugin, PluginRegistry } from "../src/types";

// Setup a unique temp directory for each test run to avoid interference
const testTmpDir = join(
  tmpdir(),
  `opencode-registry-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
);

// Mock homedir to point to our test directory
mock.module("node:os", () => ({
  homedir: () => testTmpDir,
}));

describe("Registry", () => {
  beforeAll(async () => {
    await mkdir(testTmpDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testTmpDir, { recursive: true, force: true });
    // Also clean up potential .opencode in current dir if any were created
    await rm(join(process.cwd(), ".opencode"), {
      recursive: true,
      force: true,
    });
  });

  test("getRegistryPath should return correct paths", () => {
    const userPath = getRegistryPath("user");
    expect(userPath).toContain(testTmpDir);
    expect(userPath).toContain(".config");

    const projectPath = getRegistryPath("project");
    expect(projectPath).toContain(".opencode");
  });

  test("loadRegistry should return empty registry if file missing", async () => {
    const registry = await loadRegistry("user");
    expect(registry.version).toBe(2);
    expect(registry.plugins).toEqual({});
  });

  test("saveRegistry and loadRegistry should work together", async () => {
    const mockPlugin: InstalledPlugin = {
      name: "test-plugin",
      hash: "123456",
      scope: "user",
      source: { type: "local", path: "/path/to/source" },
      installedAt: new Date().toISOString(),
      components: {
        commands: [],
        agents: [],
        skills: [],
      },
    };

    const registry: PluginRegistry = {
      version: 2,
      plugins: {
        "test-plugin": mockPlugin,
      },
    };

    await saveRegistry(registry, "user");
    const loaded = await loadRegistry("user");

    expect(loaded).toEqual(registry);
  });

  test("getInstalledPlugin should return specific plugin", async () => {
    const plugin = await getInstalledPlugin("test-plugin", "user");
    expect(plugin).not.toBeNull();
    expect(plugin?.name).toBe("test-plugin");

    const nonExistent = await getInstalledPlugin("nope", "user");
    expect(nonExistent).toBeNull();
  });

  test("getAllInstalledPlugins should combine scopes", async () => {
    // Already have one in user scope from previous test

    // Add one to project scope
    const projectPlugin: InstalledPlugin = {
      name: "project-plugin",
      hash: "abcdef",
      scope: "project",
      source: { type: "local", path: "/path/to/proj/source" },
      installedAt: new Date().toISOString(),
      components: {
        commands: [],
        agents: [],
        skills: [],
      },
    };

    const projectRegistry: PluginRegistry = {
      version: 2,
      plugins: {
        "project-plugin": projectPlugin,
      },
    };

    await saveRegistry(projectRegistry, "project");

    const allPlugins = await getAllInstalledPlugins();
    expect(allPlugins).toHaveLength(2);
    expect(allPlugins.map((p) => p.name)).toContain("test-plugin");
    expect(allPlugins.map((p) => p.name)).toContain("project-plugin");
  });
});
