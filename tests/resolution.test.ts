import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { computePluginHash, resolvePluginName } from "../src/resolution";
import type { DiscoveredComponent } from "../src/types";

describe("Resolution", () => {
  describe("resolvePluginName", () => {
    test("should extract and normalize name from path", () => {
      expect(resolvePluginName("/path/to/my-plugin")).toBe("my-plugin");
      expect(resolvePluginName("C:\\Users\\dev\\My-Plugin")).toBe("my-plugin");
    });

    test("should strip leading dots from directory names", () => {
      expect(resolvePluginName("/path/to/.claude-plugin")).toBe("claude-plugin");
      expect(resolvePluginName("/path/to/.hidden-dir")).toBe("hidden-dir");
      expect(resolvePluginName("/path/to/..multiple-dots")).toBe("multiple-dots");
    });

    test("should throw on invalid names", () => {
      expect(() => resolvePluginName("/path/to/Invalid_Name")).toThrow();
      expect(() => resolvePluginName("/path/to/Plugin With Spaces")).toThrow();
    });
  });

  describe("computePluginHash", () => {
    const tmpDir = join(process.cwd(), "tests", "tmp-identity");

    beforeAll(async () => {
      await mkdir(tmpDir, { recursive: true });
    });

    afterAll(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    test("should compute stable hash for components", async () => {
      // Setup files
      const cmdPath = join(tmpDir, "cmd.ts");
      await writeFile(cmdPath, "console.log('hello')");

      const skillDir = join(tmpDir, "myskill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), "# My Skill");

      const components: DiscoveredComponent[] = [
        {
          type: "command",
          sourcePath: cmdPath,
          name: "cmd.ts",
          targetName: "plugin--cmd.ts",
        },
        {
          type: "skill",
          sourcePath: skillDir,
          name: "myskill",
          targetName: "plugin--myskill",
        },
      ];

      const hash1 = await computePluginHash(components);

      // Shuffle components
      const hash2 = await computePluginHash([components[1], components[0]]);

      expect(hash1).toBe(hash2);
      expect(hash1).toBeString();
      expect(hash1.length).toBeGreaterThan(0);
    });

    test("should change hash when content changes", async () => {
      const cmdPath = join(tmpDir, "cmd-v2.ts");
      await writeFile(cmdPath, "original content");

      const component: DiscoveredComponent = {
        type: "command",
        sourcePath: cmdPath,
        name: "cmd",
        targetName: "p--cmd",
      };

      const hash1 = await computePluginHash([component]);

      await writeFile(cmdPath, "modified content");
      const hash2 = await computePluginHash([component]);

      expect(hash1).not.toBe(hash2);
    });

    test("should throw if SKILL.md is missing", async () => {
      const skillDir = join(tmpDir, "broken-skill");
      await mkdir(skillDir, { recursive: true });
      // No SKILL.md created

      const component: DiscoveredComponent = {
        type: "skill",
        sourcePath: skillDir,
        name: "broken",
        targetName: "p--broken",
      };

      expect(computePluginHash([component])).rejects.toThrow();
    });
  });
});
