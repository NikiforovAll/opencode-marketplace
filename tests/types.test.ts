import { describe, expect, test } from "bun:test";
import {
  getComponentTargetName,
  type InstalledPlugin,
  type PluginIdentity,
  type PluginRegistry,
  validatePluginName,
} from "../src/types";

describe("Types & Helpers", () => {
  describe("validatePluginName", () => {
    test("should accept valid lowercase alphanumeric names", () => {
      expect(validatePluginName("plugin1")).toBe(true);
      expect(validatePluginName("myplugin")).toBe(true);
    });

    test("should accept names with hyphens", () => {
      expect(validatePluginName("my-plugin")).toBe(true);
      expect(validatePluginName("plugin-1-2-3")).toBe(true);
    });

    test("should reject names with uppercase letters", () => {
      expect(validatePluginName("Plugin1")).toBe(false);
      expect(validatePluginName("MyPlugin")).toBe(false);
    });

    test("should reject names with special characters", () => {
      expect(validatePluginName("plugin!")).toBe(false);
      expect(validatePluginName("plugin_name")).toBe(false); // underscore not allowed based on regex
      expect(validatePluginName("plugin name")).toBe(false);
    });
  });

  describe("getComponentTargetName", () => {
    test("should format correctly with {plugin}--{name}", () => {
      expect(getComponentTargetName("my-plugin", "command.ts")).toBe("my-plugin--command.ts");
      expect(getComponentTargetName("plugin1", "agent.js")).toBe("plugin1--agent.js");
    });
  });

  describe("Type Definitions", () => {
    test("should allow creating objects matching interfaces", () => {
      const identity: PluginIdentity = {
        name: "test-plugin",
        hash: "abc123456",
      };
      expect(identity).toBeDefined();

      const plugin: InstalledPlugin = {
        name: "test-plugin",
        hash: "abc123456",
        scope: "user",
        sourcePath: "/tmp/source",
        installedAt: new Date().toISOString(),
        components: {
          commands: ["test-plugin--cmd1.ts"],
          agents: [],
          skills: ["test-plugin--skill1"],
        },
      };
      expect(plugin).toBeDefined();

      const registry: PluginRegistry = {
        version: 1,
        plugins: {
          "test-plugin": plugin,
        },
      };
      expect(registry).toBeDefined();
    });
  });
});
