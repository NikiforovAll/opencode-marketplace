import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdir } from "node:fs/promises";
import * as os from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ListOptions } from "../../src/commands/list";
import { list } from "../../src/commands/list";
import { saveRegistry } from "../../src/registry";
import type { Scope } from "../../src/types";

describe("list command", () => {
  let tempDir: string;
  let consoleSpy: ReturnType<typeof spyOn>;
  let originalCwdFunc = process.cwd;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = join(tmpdir(), `opencode-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });

    // Mock homedir to use our temp directory for user scope
    // Mock cwd to use our temp directory for project scope
    mock.module("node:os", () => ({
      ...os,
      homedir: () => tempDir,
    }));

    // We also need to mock process.cwd
    originalCwdFunc = process.cwd;
    process.cwd = () => tempDir;

    // Spy on console.log to capture output
    consoleSpy = spyOn(console, "log");
    consoleSpy.mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.log
    consoleSpy.mockRestore();
    mock.restore();
    process.cwd = originalCwdFunc;
  });

  it("should display no plugins message when registry is empty", async () => {
    const options: ListOptions = {};
    await list(options);

    expect(consoleSpy).toHaveBeenLastCalledWith("No plugins installed in any scope.");
  });

  it("should display single plugin in project scope", async () => {
    // Create test registry with one plugin
    const registry = {
      version: 1 as const,
      plugins: {
        "test-plugin": {
          name: "test-plugin",
          hash: "a1b2c3d4e5f6g7h8",
          scope: "project" as Scope,
          sourcePath: "/path/to/plugin",
          installedAt: "2024-01-01T00:00:00.000Z",
          components: {
            commands: ["test-plugin--command.md"],
            agents: [],
            skills: [],
          },
        },
      },
    };

    await saveRegistry(registry, "project");

    const options: ListOptions = {};
    await list(options);

    expect(consoleSpy.mock.calls).toEqual([
      ["Project scope:"],
      ["  test-plugin [a1b2c3d4] (1 command)"],
      ["    Source: /path/to/plugin"],
    ]);
  });

  it("should display multiple plugins sorted alphabetically", async () => {
    const registry = {
      version: 1 as const,
      plugins: {
        "zebra-plugin": {
          name: "zebra-plugin",
          hash: "z1b2c3d4e5f6g7h8",
          scope: "user" as Scope,
          sourcePath: "/path/to/zebra",
          installedAt: "2024-01-01T00:00:00.000Z",
          components: {
            commands: ["zebra-plugin--command.md"],
            agents: [],
            skills: [],
          },
        },
        "alpha-plugin": {
          name: "alpha-plugin",
          hash: "a1b2c3d4e5f6g7h8",
          scope: "user" as Scope,
          sourcePath: "/path/to/alpha",
          installedAt: "2024-01-02T00:00:00.000Z",
          components: {
            commands: [],
            agents: ["alpha-plugin--agent.md"],
            skills: [],
          },
        },
      },
    };

    await saveRegistry(registry, "user");

    const options: ListOptions = {};
    await list(options);

    expect(consoleSpy.mock.calls).toEqual([
      ["User scope:"],
      ["  alpha-plugin [a1b2c3d4] (1 agent)"],
      ["    Source: /path/to/alpha"],
      ["  zebra-plugin [z1b2c3d4] (1 command)"],
      ["    Source: /path/to/zebra"],
    ]);
  });

  it("should filter by user scope", async () => {
    const userRegistry = {
      version: 1 as const,
      plugins: {
        "user-plugin": {
          name: "user-plugin",
          hash: "u1b2c3d4e5f6g7h8",
          scope: "user" as Scope,
          sourcePath: "/path/to/user",
          installedAt: "2024-01-01T00:00:00.000Z",
          components: {
            commands: ["user-plugin--command.md"],
            agents: [],
            skills: [],
          },
        },
      },
    };

    const projectRegistry = {
      version: 1 as const,
      plugins: {
        "project-plugin": {
          name: "project-plugin",
          hash: "p1b2c3d4e5f6g7h8",
          scope: "project" as Scope,
          sourcePath: "/path/to/project",
          installedAt: "2024-01-01T00:00:00.000Z",
          components: {
            commands: ["project-plugin--command.md"],
            agents: [],
            skills: [],
          },
        },
      },
    };

    await saveRegistry(userRegistry, "user");
    await saveRegistry(projectRegistry, "project");

    const options: ListOptions = { scope: "user" };
    await list(options);

    expect(consoleSpy.mock.calls).toEqual([
      ["User scope:"],
      ["  user-plugin [u1b2c3d4] (1 command)"],
      ["    Source: /path/to/user"],
    ]);
  });

  it("should filter by project scope", async () => {
    const userRegistry = {
      version: 1 as const,
      plugins: {
        "user-plugin": {
          name: "user-plugin",
          hash: "u1b2c3d4e5f6g7h8",
          scope: "user" as Scope,
          sourcePath: "/path/to/user",
          installedAt: "2024-01-01T00:00:00.000Z",
          components: {
            commands: ["user-plugin--command.md"],
            agents: [],
            skills: [],
          },
        },
      },
    };

    const projectRegistry = {
      version: 1 as const,
      plugins: {
        "project-plugin": {
          name: "project-plugin",
          hash: "p1b2c3d4e5f6g7h8",
          scope: "project" as Scope,
          sourcePath: "/path/to/project",
          installedAt: "2024-01-01T00:00:00.000Z",
          components: {
            commands: ["project-plugin--command.md"],
            agents: [],
            skills: [],
          },
        },
      },
    };

    await saveRegistry(userRegistry, "user");
    await saveRegistry(projectRegistry, "project");

    const options: ListOptions = { scope: "project" };
    await list(options);

    expect(consoleSpy.mock.calls).toEqual([
      ["Project scope:"],
      ["  project-plugin [p1b2c3d4] (1 command)"],
      ["    Source: /path/to/project"],
    ]);
  });

  it("should display plugins with mixed component types", async () => {
    const registry = {
      version: 1 as const,
      plugins: {
        "mixed-plugin": {
          name: "mixed-plugin",
          hash: "m1b2c3d4e5f6g7h8",
          scope: "project" as Scope,
          sourcePath: "/path/to/mixed",
          installedAt: "2024-01-01T00:00:00.000Z",
          components: {
            commands: ["mixed-plugin--cmd1.md", "mixed-plugin--cmd2.md"],
            agents: ["mixed-plugin--agent.md"],
            skills: ["mixed-plugin--skill"],
          },
        },
      },
    };

    await saveRegistry(registry, "project");

    const options: ListOptions = {};
    await list(options);

    expect(consoleSpy.mock.calls).toEqual([
      ["Project scope:"],
      ["  mixed-plugin [m1b2c3d4] (2 commands, 1 agent, 1 skill)"],
      ["    Source: /path/to/mixed"],
    ]);
  });

  it("should show verbose output", async () => {
    const registry = {
      version: 1 as const,
      plugins: {
        "verbose-plugin": {
          name: "verbose-plugin",
          hash: "v1b2c3d4e5f6g7h8",
          scope: "user" as Scope,
          sourcePath: "/path/to/verbose",
          installedAt: "2024-01-01T12:30:45.000Z",
          components: {
            commands: ["verbose-plugin--cmd.md"],
            agents: ["verbose-plugin--agent.md"],
            skills: ["verbose-plugin--skill"],
          },
        },
      },
    };

    await saveRegistry(registry, "user");

    const options: ListOptions = { verbose: true };
    await list(options);

    expect(consoleSpy.mock.calls).toEqual([
      ["[VERBOSE] Listing plugins with options:", options],
      ["User scope:"],
      ["  verbose-plugin [v1b2c3d4] (1 command, 1 agent, 1 skill)"],
      ["    Source: /path/to/verbose"],
      ["    Installed: 2024-01-01T12:30:45.000Z"],
      ["    Scope: user"],
      ["    Commands: verbose-plugin--cmd.md"],
      ["    Agents: verbose-plugin--agent.md"],
      ["    Skills: verbose-plugin--skill"],
    ]);
  });

  it("should show both scopes with proper spacing", async () => {
    const userRegistry = {
      version: 1 as const,
      plugins: {
        "user-plugin": {
          name: "user-plugin",
          hash: "u1b2c3d4e5f6g7h8",
          scope: "user" as Scope,
          sourcePath: "/path/to/user",
          installedAt: "2024-01-01T00:00:00.000Z",
          components: {
            commands: ["user-plugin--command.md"],
            agents: [],
            skills: [],
          },
        },
      },
    };

    const projectRegistry = {
      version: 1 as const,
      plugins: {
        "project-plugin": {
          name: "project-plugin",
          hash: "p1b2c3d4e5f6g7h8",
          scope: "project" as Scope,
          sourcePath: "/path/to/project",
          installedAt: "2024-01-01T00:00:00.000Z",
          components: {
            commands: ["project-plugin--command.md"],
            agents: [],
            skills: [],
          },
        },
      },
    };

    await saveRegistry(userRegistry, "user");
    await saveRegistry(projectRegistry, "project");

    const options: ListOptions = {};
    await list(options);

    expect(consoleSpy.mock.calls).toEqual([
      ["User scope:"],
      ["  user-plugin [u1b2c3d4] (1 command)"],
      ["    Source: /path/to/user"],
      [""], // Empty line for spacing
      ["Project scope:"],
      ["  project-plugin [p1b2c3d4] (1 command)"],
      ["    Source: /path/to/project"],
    ]);
  });

  it("should handle empty scope gracefully", async () => {
    const options: ListOptions = { scope: "user" };
    await list(options);

    expect(consoleSpy).toHaveBeenLastCalledWith("No plugins installed in user scope.");
  });
});
