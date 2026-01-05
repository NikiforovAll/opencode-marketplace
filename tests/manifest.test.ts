import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readPluginManifest } from "../src/manifest";

describe("Manifest", () => {
  const tmpDir = join(process.cwd(), "tests", "tmp-manifest");

  beforeAll(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("readPluginManifest", () => {
    test("should return null if plugin.json doesn't exist", async () => {
      const emptyDir = join(tmpDir, "empty");
      await mkdir(emptyDir, { recursive: true });

      const result = await readPluginManifest(emptyDir);
      expect(result).toBeNull();
    });

    test("should extract name from plugin.json with other fields", async () => {
      const validDir = join(tmpDir, "valid");
      await mkdir(validDir, { recursive: true });
      await writeFile(
        join(validDir, "plugin.json"),
        JSON.stringify({
          name: "test-plugin",
          description: "A test plugin",
          version: "1.0.0",
        }),
      );

      const result = await readPluginManifest(validDir);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("test-plugin");
    });

    test("should parse plugin.json with only name field", async () => {
      const minimalDir = join(tmpDir, "minimal");
      await mkdir(minimalDir, { recursive: true });
      await writeFile(
        join(minimalDir, "plugin.json"),
        JSON.stringify({
          name: "minimal-plugin",
        }),
      );

      const result = await readPluginManifest(minimalDir);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("minimal-plugin");
    });

    test("should return null if plugin.json has no name field", async () => {
      const noNameDir = join(tmpDir, "no-name");
      await mkdir(noNameDir, { recursive: true });
      await writeFile(
        join(noNameDir, "plugin.json"),
        JSON.stringify({
          description: "Missing name",
        }),
      );

      const result = await readPluginManifest(noNameDir);
      expect(result).toBeNull();
    });

    test("should return null if plugin.json has invalid JSON", async () => {
      const invalidDir = join(tmpDir, "invalid");
      await mkdir(invalidDir, { recursive: true });
      await writeFile(join(invalidDir, "plugin.json"), "{ invalid json }");

      const result = await readPluginManifest(invalidDir);
      expect(result).toBeNull();
    });

    test("should extract only name field ignoring other fields", async () => {
      const fullDir = join(tmpDir, "full");
      await mkdir(fullDir, { recursive: true });
      await writeFile(
        join(fullDir, "plugin.json"),
        JSON.stringify({
          name: "full-plugin",
          description: "Full featured plugin",
          version: "2.0.0",
          author: {
            name: "Test Author",
            email: "test@example.com",
          },
          hooks: "./hooks/hooks.json",
          skills: ["./skills/skill1", "./skills/skill2"],
          commands: ["./commands/cmd1.md"],
          agents: ["./agents/agent1.md"],
        }),
      );

      const result = await readPluginManifest(fullDir);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("full-plugin");
      // Only name field is extracted, other fields are ignored
      expect(Object.keys(result || {})).toEqual(["name"]);
    });
  });
});
