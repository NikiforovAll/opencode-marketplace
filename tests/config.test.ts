import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfigPath, loadConfig, resetConfigCache, resolveUserSkillsPath } from "../src/config";

const testTmpDir = join(process.cwd(), "tests", "tmp-config");

mock.module("node:os", () => ({
  homedir: () => testTmpDir,
}));

describe("Config", () => {
  beforeAll(async () => {
    await mkdir(testTmpDir, { recursive: true });
  });

  afterEach(() => {
    resetConfigCache();
  });

  afterAll(async () => {
    await rm(testTmpDir, { recursive: true, force: true });
  });

  describe("getConfigPath", () => {
    test("should return path under ~/.config/opencode/", () => {
      const path = getConfigPath();
      expect(path).toContain(".config");
      expect(path).toContain("opencode");
      expect(path).toContain("ocm-config.json");
    });
  });

  describe("loadConfig", () => {
    test("should return empty config when file does not exist", () => {
      const config = loadConfig();
      expect(config).toEqual({});
    });

    test("should parse skillsPath from config file", async () => {
      const configDir = join(testTmpDir, ".config", "opencode");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "ocm-config.json"),
        JSON.stringify({ skillsPath: "/custom/agents" }),
      );

      const config = loadConfig();
      expect(config.skillsPath).toContain("custom");
      expect(config.skillsPath).toContain("agents");
    });

    test("should expand tilde in skillsPath", async () => {
      const configDir = join(testTmpDir, ".config", "opencode");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "ocm-config.json"),
        JSON.stringify({ skillsPath: "~/my-agents" }),
      );

      const config = loadConfig();
      expect(config.skillsPath).toContain(testTmpDir);
      expect(config.skillsPath).toContain("my-agents");
      expect(config.skillsPath).not.toContain("~");
    });

    test("should return empty config on invalid JSON", async () => {
      const configDir = join(testTmpDir, ".config", "opencode");
      await mkdir(configDir, { recursive: true });
      await writeFile(join(configDir, "ocm-config.json"), "not json{{{");

      const config = loadConfig();
      expect(config).toEqual({});
    });

    test("should cache config after first load", async () => {
      const config1 = loadConfig();
      const config2 = loadConfig();
      expect(config1).toBe(config2);
    });
  });

  describe("resolveUserSkillsPath", () => {
    test("should return default ~/.agents/skills when no config", async () => {
      // Ensure no config file
      await rm(join(testTmpDir, ".config", "opencode", "ocm-config.json"), { force: true });

      const path = resolveUserSkillsPath();
      expect(path).toContain(".agents");
      expect(path).toContain("skills");
    });

    test("should return configured base + /skills when config set", async () => {
      const configDir = join(testTmpDir, ".config", "opencode");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "ocm-config.json"),
        JSON.stringify({ skillsPath: "/custom/base" }),
      );

      const path = resolveUserSkillsPath();
      expect(path).toContain("custom");
      expect(path).toContain("base");
      expect(path).toContain("skills");
    });
  });
});
