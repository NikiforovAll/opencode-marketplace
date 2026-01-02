import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { ensureComponentDirsExist, getComponentDir, getComponentTargetPath } from "../src/paths";

// Setup a temp directory for tests
const testTmpDir = join(process.cwd(), "tests", "tmp-paths");

// Mock homedir to point to our test directory
mock.module("node:os", () => ({
  homedir: () => testTmpDir,
}));

describe("Paths", () => {
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

  describe("getComponentDir", () => {
    test("should return user scope paths with trailing slash", () => {
      const cmdDir = getComponentDir("command", "user");
      expect(cmdDir).toContain(testTmpDir);
      expect(cmdDir).toContain(".config");
      expect(cmdDir).toContain("command");
      expect(cmdDir).toEndWith("/");

      const agentDir = getComponentDir("agent", "user");
      expect(agentDir).toContain("agent");
      expect(agentDir).toEndWith("/");

      const skillDir = getComponentDir("skill", "user");
      expect(skillDir).toContain("skill");
      expect(skillDir).toEndWith("/");
    });

    test("should return project scope paths with trailing slash", () => {
      const cmdDir = getComponentDir("command", "project");
      expect(cmdDir).toContain(".opencode");
      expect(cmdDir).toContain("command");
      expect(cmdDir).toEndWith("/");

      const agentDir = getComponentDir("agent", "project");
      expect(agentDir).toContain("agent");
      expect(agentDir).toEndWith("/");

      const skillDir = getComponentDir("skill", "project");
      expect(skillDir).toContain("skill");
      expect(skillDir).toEndWith("/");
    });
  });

  describe("getComponentTargetPath", () => {
    test("should return correct path for commands (files)", () => {
      const path = getComponentTargetPath("myplugin", "reflect.md", "command", "user");
      expect(path).toContain("myplugin--reflect.md");
      expect(path).not.toEndWith("/");
    });

    test("should return correct path for agents (files)", () => {
      const path = getComponentTargetPath("myplugin", "reviewer.md", "agent", "user");
      expect(path).toContain("myplugin--reviewer.md");
      expect(path).not.toEndWith("/");
    });

    test("should return correct path for skills (directories) with trailing slash", () => {
      const path = getComponentTargetPath("myplugin", "code-review", "skill", "user");
      expect(path).toContain("myplugin--code-review");
      expect(path).toEndWith("/");
    });

    test("should use plugin prefix format {plugin}--{name}", () => {
      const path = getComponentTargetPath("my-awesome-plugin", "cmd.md", "command", "user");
      expect(path).toContain("my-awesome-plugin--cmd.md");
    });

    test("should work with project scope", () => {
      const path = getComponentTargetPath("plugin", "skill-folder", "skill", "project");
      expect(path).toContain(".opencode");
      expect(path).toContain("plugin--skill-folder");
      expect(path).toEndWith("/");
    });
  });

  describe("ensureComponentDirsExist", () => {
    test("should create all component directories for user scope", async () => {
      await ensureComponentDirsExist("user");

      const cmdDir = join(testTmpDir, ".config", "opencode", "command");
      const agentDir = join(testTmpDir, ".config", "opencode", "agent");
      const skillDir = join(testTmpDir, ".config", "opencode", "skill");

      expect(existsSync(cmdDir)).toBe(true);
      expect(existsSync(agentDir)).toBe(true);
      expect(existsSync(skillDir)).toBe(true);
    });

    test("should create all component directories for project scope", async () => {
      await ensureComponentDirsExist("project");

      const cmdDir = join(process.cwd(), ".opencode", "command");
      const agentDir = join(process.cwd(), ".opencode", "agent");
      const skillDir = join(process.cwd(), ".opencode", "skill");

      expect(existsSync(cmdDir)).toBe(true);
      expect(existsSync(agentDir)).toBe(true);
      expect(existsSync(skillDir)).toBe(true);
    });

    test("should be idempotent (safe to call multiple times)", async () => {
      await ensureComponentDirsExist("user");
      await ensureComponentDirsExist("user");
      // Should not throw

      const cmdDir = join(testTmpDir, ".config", "opencode", "command");
      expect(existsSync(cmdDir)).toBe(true);
    });
  });
});
