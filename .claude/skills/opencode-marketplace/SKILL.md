---
name: opencode-marketplace
description: Reference guide for the opencode-marketplace CLI tool. Use this skill when users want to install, uninstall, update, list, or scan OpenCode plugins; manage plugin components (commands, agents, skills); work with plugin scopes (user/project); handle GitHub-based plugins; or need guidance on plugin structure and conventions.
---

# OpenCode Marketplace CLI Skill

Use this skill to manage OpenCode plugins through the opencode-marketplace CLI tool.

## Overview

The OpenCode Marketplace CLI provides a convention-based plugin system for OpenCode. Plugins are simply directories containing commands, agents, and skills that get auto-discovered and installed to standard OpenCode locations.

**Key Capabilities:**
- Install plugins from local directories
- List installed plugins with metadata
- Scan plugins before installing (dry-run)
- Uninstall plugins cleanly
- Support for user-global and project-local scopes
- Content-hash based change detection (no versions needed)

## Quick Reference

| Command | Syntax | Purpose |
|---------|--------|---------|
| **install** | `install <path> [options]` | Install plugin from local path or GitHub URL |
| **uninstall** | `uninstall <name> [options]` | Remove installed plugin |
| **list** | `list [options]` | Show installed plugins |
| **scan** | `scan <path>` | Preview plugin contents (dry-run) |
| **update** | `update <name> [options]` | Update remote plugin to latest |

**Common Options:**
- `--scope <user|project>` - Target scope (default: user)
- `--force` - Force overwrite conflicts (install only)
- `--verbose` - Detailed output

**Path Types:**
- **Local**: `/path/to/plugin` or `./relative/path`
- **GitHub**: `https://github.com/owner/repo[/tree/ref][/subfolder]`

## Installation

The CLI can be run without installation using bunx:

```bash
bunx opencode-marketplace <command>
```

Or install globally for faster access:

```bash
bun install -g opencode-marketplace
```

## Commands

### 1. Install a Plugin

Install a plugin from a local directory or GitHub URL:

```bash
bunx opencode-marketplace install <path> [options]
```

**Options:**
- `--scope <user|project>` - Installation scope (default: user)
  - `user`: Installs to `~/.config/opencode/` (global)
  - `project`: Installs to `.opencode/` (local to current directory)
- `--force` - Overwrite existing untracked files
- `--verbose` - Show detailed installation progress

**Path Types:**
- **Local directory**: `/absolute/path/to/plugin` or `./relative/path`
- **GitHub URL**: `https://github.com/owner/repo[/tree/branch][/subfolder]`

**Examples:**

```bash
# Local installation
bunx opencode-marketplace install ~/plugins/my-plugin
bunx opencode-marketplace install ./vendor/custom-plugin --scope project

# GitHub installation
bunx opencode-marketplace install https://github.com/user/opencode-plugins
bunx opencode-marketplace install https://github.com/org/repo/tree/main/plugins/tools

# Force overwrite
bunx opencode-marketplace install ~/plugins/my-plugin --force

# Verbose output
bunx opencode-marketplace install https://github.com/user/tools --verbose
```

**Output Example:**
```
Installing my-plugin [a1b2c3d4]...
  → command/my-plugin--reflect.md
  → agent/my-plugin--reviewer.md
  → skill/my-plugin--code-review

Installed my-plugin (1 command, 1 agent, 1 skill) to user scope.
```

### 2. List Installed Plugins

Display all installed plugins with metadata:

```bash
bunx opencode-marketplace list [options]
```

**Options:**
- `--scope <user|project>` - Filter by scope (optional)
- `--verbose` - Show detailed component information

**Examples:**

```bash
# List all plugins (both scopes)
bunx opencode-marketplace list

# List only user-global plugins
bunx opencode-marketplace list --scope user

# List with verbose details
bunx opencode-marketplace list --verbose
```

### 3. Scan a Plugin (Dry-Run)

Preview what would be installed without making changes:

```bash
bunx opencode-marketplace scan <path> [options]
```

**Options:**
- `--verbose` - Show detailed component discovery

**Examples:**

```bash
# Scan a plugin directory
bunx opencode-marketplace scan ~/plugins/my-plugin

# Verbose scan
bunx opencode-marketplace scan ~/plugins/my-plugin --verbose
```

### 4. Uninstall a Plugin

Remove an installed plugin:

```bash
bunx opencode-marketplace uninstall <name> [options]
```

**Options:**
- `--scope <user|project>` - Scope to uninstall from (default: user)
- `--verbose` - Show detailed deletion progress

**Examples:**

```bash
# Uninstall from user scope
bunx opencode-marketplace uninstall my-plugin

# Uninstall from project scope
bunx opencode-marketplace uninstall custom-tools --scope project

# Verbose uninstall
bunx opencode-marketplace uninstall my-plugin --verbose
```

### 5. Update a Plugin

Update a plugin from its remote source (GitHub):

```bash
bunx opencode-marketplace update <name> [options]
```

**Options:**
- `--scope <user|project>` - Scope to update from (default: user)
- `--verbose` - Show detailed update progress

**How It Works:**
1. Fetches latest from the original GitHub URL stored in registry
2. Compares content hash to detect changes
3. If unchanged: "Plugin is already up to date"
4. If changed: Automatically reinstalls with new content

**Examples:**

```bash
# Update user-scope plugin
bunx opencode-marketplace update my-plugin

# Update project-scope plugin
bunx opencode-marketplace update custom-tools --scope project

# Check current version before updating
bunx opencode-marketplace list --verbose

# Update with verbose output
bunx opencode-marketplace update my-plugin --verbose
```

**Important Notes:**
- Only works for **remote (GitHub) plugins**, not local installations
- For local plugins, edit at source and reinstall: `install ~/path/to/plugin`
- Preserves original scope and component selection from installation

## Plugin Structure

A valid plugin directory must follow this structure:

```
my-plugin/
├── command/           # Commands (*.md files)
│   └── reflect.md
├── agent/            # Agents (*.md files)
│   └── reviewer.md
└── skill/            # Skills (directories with SKILL.md)
    └── code-review/
        ├── SKILL.md
        └── data.json
```

### Discovery Priority

The CLI searches for components in this order (first match wins):

| Component | Priority 1 | Priority 2 | Priority 3 | Priority 4 |
|-----------|------------|------------|------------|------------|
| Commands | `.opencode/command/` | `.claude/commands/` | `./command/` | `./commands/` |
| Agents | `.opencode/agent/` | `.claude/agents/` | `./agent/` | `./agents/` |
| Skills | `.opencode/skill/` | `.claude/skills/` | `./skill/` | `./skills/` |

**Component Rules:**
- **Commands/Agents**: All `*.md` files in the discovered directory
- **Skills**: All subdirectories containing a `SKILL.md` file (copied recursively)

### Plugin Naming Rules

- Plugin name is derived from the directory name
- Must be lowercase alphanumeric with hyphens only
- Examples: `my-plugin`, `code-tools`, `git-helpers`
- Invalid: `MyPlugin`, `my_plugin`, `my plugin!`

## Working with GitHub Plugins

### Supported URL Formats

The CLI supports direct GitHub URLs for installation:

**Basic repository**:
```bash
https://github.com/owner/repo
```

**Specific branch or tag**:
```bash
https://github.com/owner/repo/tree/main
https://github.com/owner/repo/tree/v1.0.0
https://github.com/owner/repo/tree/develop
```

**Subfolder (monorepo plugins)**:
```bash
https://github.com/owner/repo/tree/main/plugins/my-plugin
https://github.com/owner/repo/tree/v2.0/packages/tools
```

### Installation from GitHub

```bash
# Install from main branch
bunx opencode-marketplace install https://github.com/user/opencode-plugins

# Install from specific branch
bunx opencode-marketplace install https://github.com/user/plugins/tree/develop

# Install from subfolder
bunx opencode-marketplace install https://github.com/user/monorepo/tree/main/plugins/cli-tools

# Interactive install from GitHub
bunx opencode-marketplace install https://github.com/user/plugins --interactive

# Scan before installing
bunx opencode-marketplace scan https://github.com/user/plugins
```

### How GitHub Installation Works

1. **Clone**: Repository is cloned to a temporary directory
2. **Navigate**: If subpath specified, CLI navigates to that folder
3. **Discover**: Components discovered using standard priority rules
4. **Install**: Files copied with namespacing to target scope
5. **Cleanup**: Temporary directory is automatically removed

### Updating Remote Plugins

```bash
# Update to latest from tracked branch/tag
bunx opencode-marketplace update my-plugin

# View current version before updating
bunx opencode-marketplace list --verbose
```

**Update Behavior**:
- Fetches latest from the original GitHub URL stored in registry
- Compares content hash to detect changes
- If unchanged: "Plugin is already up to date"
- If changed: Automatically reinstalls with new content
- Preserves original scope and component selection

### GitHub URL Best Practices

1. **Pin to branches/tags** for stability:
   ```bash
   # ✓ Good: Pinned to v1.x branch
   https://github.com/user/plugins/tree/v1.x

   # ⚠ Caution: Tracks main (may change frequently)
   https://github.com/user/plugins
   ```

2. **Use subfolders for monorepos**:
   ```bash
   # Each plugin in separate subfolder
   https://github.com/company/opencode-tools/tree/main/plugins/git-helpers
   https://github.com/company/opencode-tools/tree/main/plugins/docker-utils
   ```

3. **Scan before installing**:
   ```bash
   bunx opencode-marketplace scan <github-url>
   ```

### Troubleshooting GitHub Plugins

**Authentication Issues**:
If the repository is private, ensure git has access:
```bash
# Configure git credentials
git config --global credential.helper store

# Or use SSH URLs (not currently supported - use HTTPS)
```

**Large Repositories**:
For very large repos, cloning may take time. Consider:
- Using subfolders to target specific plugins
- Asking maintainers to split into smaller repos
- Using `--verbose` to see progress

**Network Issues**:
```bash
# If clone fails, check network/proxy
git clone <repo-url>  # Test git connectivity

# Retry with verbose output
bunx opencode-marketplace install <github-url> --verbose
```

## How It Works

### 1. Component Discovery
The CLI scans your plugin directory using the priority chain above.

### 2. Namespacing
Files are copied with a prefix to avoid conflicts:
- Source: `my-plugin/command/reflect.md`
- Target: `~/.config/opencode/command/my-plugin--reflect.md`

### 3. Registry Tracking
Installed plugins are tracked in JSON registries:
- User scope: `~/.config/opencode/plugins/installed.json`
- Project scope: `.opencode/plugins/installed.json`

Registry entry includes:
- Plugin name and content hash
- Source path
- Installation timestamp
- List of installed components

### 4. Change Detection
Content hashing ensures you only reinstall when files actually change. The hash is computed from:
- All command file contents
- All agent file contents
- All `SKILL.md` file contents (other skill files ignored for hashing)

## Common Workflows

### Developing a New Plugin

```bash
# 1. Create plugin structure
mkdir -p ~/my-plugins/awesome-tools/command
echo "# My Command" > ~/my-plugins/awesome-tools/command/do-thing.md

# 2. Scan to verify structure
bunx opencode-marketplace scan ~/my-plugins/awesome-tools

# 3. Install to user scope
bunx opencode-marketplace install ~/my-plugins/awesome-tools

# 4. Verify installation
bunx opencode-marketplace list
```

### Updating a Plugin

```bash
# 1. Edit plugin files
vim ~/my-plugins/awesome-tools/command/do-thing.md

# 2. Reinstall (will show hash change)
bunx opencode-marketplace install ~/my-plugins/awesome-tools

# The CLI will detect the content change and update
```

### Project-Local Plugins

```bash
# 1. Create project plugin directory
mkdir -p ./.opencode-plugins/project-helpers/command

# 2. Add components
echo "# Project Command" > ./.opencode-plugins/project-helpers/command/helper.md

# 3. Install to project scope
bunx opencode-marketplace install ./.opencode-plugins/project-helpers --scope project

# 4. Verify (only in this project)
bunx opencode-marketplace list --scope project
```

### Sharing Plugins

```bash
# 1. Create a plugin repository
git init ~/my-plugins/shared-tools
# ... add components ...

# 2. Team members can clone and install
git clone https://github.com/user/shared-tools ~/plugins/shared-tools
bunx opencode-marketplace install ~/plugins/shared-tools
```

### Installing from GitHub

```bash
# 1. Scan repository to preview contents
bunx opencode-marketplace scan https://github.com/awesome-org/opencode-plugins

# 2. Install directly
bunx opencode-marketplace install https://github.com/awesome-org/opencode-plugins

# 3. Verify installation
bunx opencode-marketplace list
```

### Updating Remote Plugins

```bash
# 1. List installed plugins to find remote ones
bunx opencode-marketplace list

# Example output:
# User scope:
#   awesome-tools [a1b2c3d4] (2 commands, 1 skill)
#     Source: https://github.com/user/awesome-tools

# 2. Update to latest
bunx opencode-marketplace update awesome-tools

# 3. Check new hash
bunx opencode-marketplace list
```

### Monorepo Plugin Management

```bash
# Install specific plugins from a monorepo
bunx opencode-marketplace install https://github.com/company/tools/tree/main/plugins/git-helpers
bunx opencode-marketplace install https://github.com/company/tools/tree/main/plugins/docker-utils

# Each gets tracked separately
bunx opencode-marketplace list
# Output:
#   git-helpers [abc123] (3 commands)
#   docker-utils [def456] (2 commands, 1 agent)
```

## Best Practices

1. **Use Descriptive Names**: Name plugins clearly (`git-helpers` not `gh`)
2. **Scan Before Installing**: Always run `scan` first to verify structure
3. **Use Project Scope for Project-Specific Tools**: Keep global scope clean
4. **Version with Content Hashing**: Trust the hash - no manual versions needed
5. **Document Your Plugins**: Add clear comments in your command/agent files
6. **Test Skills Thoroughly**: Ensure `SKILL.md` is complete before installing
7. **Organize Plugin Sources**: Keep a dedicated directory for your plugin collection
8. **Pin GitHub Plugins**: Use specific branches/tags for stability (`/tree/v1.x` not `/tree/main`)
9. **Scan Remote Plugins First**: Run `scan <github-url>` before installing from GitHub
10. **Update Remote Plugins Regularly**: Run `update <name>` to get latest fixes and improvements
11. **Leverage Scopes Strategically**: User scope for tools across projects, project scope for team-specific plugins

## Integration with OpenCode

Once installed, components are immediately available to OpenCode:

**Commands:**
- Location: `~/.config/opencode/command/my-plugin--*.md` (user)
- Location: `.opencode/command/my-plugin--*.md` (project)
- Usage: Invoked via OpenCode's command system

**Agents:**
- Location: `~/.config/opencode/agent/my-plugin--*.md` (user)
- Location: `.opencode/agent/my-plugin--*.md` (project)
- Usage: Available in OpenCode's agent selection

**Skills:**
- Location: `~/.config/opencode/skill/my-plugin--*/` (user)
- Location: `.opencode/skill/my-plugin--*/` (project)
- Usage: Discoverable via OpenCode's skill system

## Reference

### Component File Formats

**Command Format** (`*.md`):
```markdown
# Command Name

Description of what this command does.

## Usage
...
```

**Agent Format** (`*.md`):
```markdown
# Agent Name

Agent purpose and capabilities.

## Behavior
...
```

**Skill Format** (`SKILL.md`):
```markdown
# Skill Name

Skill description and usage instructions.

## Tools Available
...
```

### Registry Schema

```json
{
  "version": 1,
  "plugins": {
    "my-plugin": {
      "name": "my-plugin",
      "hash": "a1b2c3d4e5f6g7h8",
      "scope": "user",
      "sourcePath": "/absolute/path/to/my-plugin",
      "installedAt": "2026-01-02T10:30:00.000Z",
      "components": {
        "commands": ["my-plugin--reflect.md"],
        "agents": ["my-plugin--reviewer.md"],
        "skills": ["my-plugin--code-review"]
      }
    }
  }
}
```

## Examples Gallery

### Minimal Command-Only Plugin

```bash
# Structure
simple-cmd/
└── command/
    └── hello.md

# Install
bunx opencode-marketplace install ./simple-cmd
```

### Multi-Component Plugin

```bash
# Structure
multi-tool/
├── command/
│   ├── lint.md
│   └── format.md
├── agent/
│   └── code-reviewer.md
└── skill/
    └── testing/
        └── SKILL.md

# Install
bunx opencode-marketplace install ./multi-tool --verbose
```

### Skills-Only Plugin

```bash
# Structure
skill-pack/
└── skill/
    ├── git-workflow/
    │   └── SKILL.md
    └── docker-helper/
        ├── SKILL.md
        └── templates/
            └── Dockerfile

# Install
bunx opencode-marketplace install ./skill-pack
```

## Additional Resources

- **Repository**: https://github.com/NikiforovAll/opencode-marketplace
- **Issues**: Report bugs or request features on GitHub
- **OpenCode Docs**: https://opencode.ai/docs (for component format details)

---

**Pro Tip:** Use `bunx opencode-marketplace scan <path> --verbose` before installing to see exactly what components will be discovered and where they'll be installed!
