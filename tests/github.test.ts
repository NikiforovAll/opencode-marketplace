import { describe, expect, test } from "bun:test";
import { buildGitHubUrl, isGitHubUrl, parseGitHubUrl } from "../src/github";

describe("GitHub URL parsing", () => {
  test("parseGitHubUrl should parse basic repo URL", () => {
    const result = parseGitHubUrl("https://github.com/user/repo");
    expect(result).toEqual({
      owner: "user",
      repo: "repo",
    });
  });

  test("parseGitHubUrl should parse URL with branch", () => {
    const result = parseGitHubUrl("https://github.com/user/repo/tree/main");
    expect(result).toEqual({
      owner: "user",
      repo: "repo",
      ref: "main",
    });
  });

  test("parseGitHubUrl should parse URL with branch and subpath", () => {
    const result = parseGitHubUrl("https://github.com/user/repo/tree/main/plugins/foo");
    expect(result).toEqual({
      owner: "user",
      repo: "repo",
      ref: "main",
      subpath: "plugins/foo",
    });
  });

  test("parseGitHubUrl should parse URL with tag", () => {
    const result = parseGitHubUrl("https://github.com/user/repo/tree/v1.0.0");
    expect(result).toEqual({
      owner: "user",
      repo: "repo",
      ref: "v1.0.0",
    });
  });

  test("parseGitHubUrl should parse URL with tag and subpath", () => {
    const result = parseGitHubUrl("https://github.com/user/repo/tree/v1.0.0/src/plugins");
    expect(result).toEqual({
      owner: "user",
      repo: "repo",
      ref: "v1.0.0",
      subpath: "src/plugins",
    });
  });

  test("parseGitHubUrl should parse URL with blob instead of tree", () => {
    const result = parseGitHubUrl("https://github.com/user/repo/blob/main/file.md");
    expect(result).toEqual({
      owner: "user",
      repo: "repo",
      ref: "main",
      subpath: "file.md",
    });
  });

  test("parseGitHubUrl should return null for invalid GitHub URL", () => {
    expect(parseGitHubUrl("https://gitlab.com/user/repo")).toBeNull();
    expect(parseGitHubUrl("not-a-url")).toBeNull();
    expect(parseGitHubUrl("https://github.com/user")).toBeNull();
    expect(parseGitHubUrl("https://github.com/")).toBeNull();
  });

  test("parseGitHubUrl should return null for URL with invalid structure", () => {
    // No ref after /tree/
    expect(parseGitHubUrl("https://github.com/user/repo/tree/")).toBeNull();
  });

  test("isGitHubUrl should detect GitHub URLs", () => {
    expect(isGitHubUrl("https://github.com/user/repo")).toBe(true);
    expect(isGitHubUrl("https://github.com/user/repo/tree/main")).toBe(true);
    expect(isGitHubUrl("/local/path")).toBe(false);
    expect(isGitHubUrl("https://gitlab.com/user/repo")).toBe(false);
  });

  test("buildGitHubUrl should reconstruct URL from parsed components", () => {
    expect(
      buildGitHubUrl({
        owner: "user",
        repo: "repo",
      }),
    ).toBe("https://github.com/user/repo");

    expect(
      buildGitHubUrl({
        owner: "user",
        repo: "repo",
        ref: "main",
      }),
    ).toBe("https://github.com/user/repo/tree/main");

    expect(
      buildGitHubUrl({
        owner: "user",
        repo: "repo",
        ref: "main",
        subpath: "plugins/foo",
      }),
    ).toBe("https://github.com/user/repo/tree/main/plugins/foo");
  });

  test("parseGitHubUrl and buildGitHubUrl should be reversible", () => {
    const urls = [
      "https://github.com/user/repo",
      "https://github.com/user/repo/tree/main",
      "https://github.com/user/repo/tree/v1.0.0/plugins/foo",
    ];

    for (const url of urls) {
      const parsed = parseGitHubUrl(url);
      expect(parsed).not.toBeNull();
      if (parsed) {
        const rebuilt = buildGitHubUrl(parsed);
        expect(rebuilt).toBe(url);
      }
    }
  });
});
