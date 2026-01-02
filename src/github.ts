/**
 * GitHub URL parsing utilities
 */

export interface GitHubSource {
  owner: string;
  repo: string;
  ref?: string; // branch, tag, or commit
  subpath?: string; // subfolder path
}

/**
 * Parses a GitHub URL into structured components.
 *
 * Supported formats:
 * - https://github.com/user/repo
 * - https://github.com/user/repo/tree/main
 * - https://github.com/user/repo/tree/main/plugins/foo
 * - https://github.com/user/repo/tree/v1.0.0/src
 *
 * @param url - GitHub URL to parse
 * @returns Parsed GitHub source or null if invalid
 */
export function parseGitHubUrl(url: string): GitHubSource | null {
  try {
    const parsed = new URL(url);

    // Validate it's a GitHub URL
    if (parsed.hostname !== "github.com") {
      return null;
    }

    // Extract path segments (remove leading slash)
    const pathSegments = parsed.pathname.slice(1).split("/").filter(Boolean);

    // Need at least owner/repo
    if (pathSegments.length < 2) {
      return null;
    }

    const [owner, repo, ...rest] = pathSegments;

    // Basic case: https://github.com/owner/repo
    if (rest.length === 0) {
      return { owner, repo };
    }

    // Check for /tree/ or /blob/ segment
    const treeOrBlobIndex =
      rest.indexOf("tree") !== -1 ? rest.indexOf("tree") : rest.indexOf("blob");

    if (treeOrBlobIndex === -1) {
      // No tree/blob segment, treat rest as invalid
      return null;
    }

    // Format: /tree/<ref>/subpath or /tree/<ref>
    const ref = rest[treeOrBlobIndex + 1];
    const subpathSegments = rest.slice(treeOrBlobIndex + 2);

    if (!ref) {
      return null;
    }

    const result: GitHubSource = { owner, repo, ref };

    if (subpathSegments.length > 0) {
      result.subpath = subpathSegments.join("/");
    }

    return result;
  } catch {
    // Invalid URL
    return null;
  }
}

/**
 * Checks if a string is a GitHub URL
 */
export function isGitHubUrl(input: string): boolean {
  return input.startsWith("https://github.com/");
}

/**
 * Reconstructs a full GitHub URL from parsed components
 */
export function buildGitHubUrl(source: GitHubSource): string {
  let url = `https://github.com/${source.owner}/${source.repo}`;

  if (source.ref) {
    url += `/tree/${source.ref}`;

    if (source.subpath) {
      url += `/${source.subpath}`;
    }
  }

  return url;
}
