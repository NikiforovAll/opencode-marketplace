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

Install a plugin from a local directory:

```bash
bunx opencode-marketplace install <path> [options]
```

**Options:**
- `--scope <user|project>` - Installation scope (default: user)
  - `user`: Installs to `~/.config/opencode/` (global)
  - `project`: Installs to `.opencode/` (local to current directory)
- `--force` - Overwrite existing untracked files
- `--verbose` - Show detailed installation progress

**Examples:**

```bash
# Install to user scope (global)
bunx opencode-marketplace install ~/plugins/my-plugin

# Install to project scope (local)
bunx opencode-marketplace install ./vendor/custom-plugin --scope project

# Force overwrite existing files
bunx opencode-marketplace install ~/plugins/my-plugin --force

# Verbose output
bunx opencode-marketplace install ~/plugins/my-plugin --verbose
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

## Troubleshooting

### Plugin Not Found
```
Error: Plugin directory not found: /path/to/plugin
```
**Solution:** Verify the path exists and is correct.

### No Components Found
```
Error: No components found in /path/to/plugin. Ensure plugin contains command/, agent/, or skill/ directories with valid components.
```
**Solution:** Check that you have at least one component directory (`command/`, `agent/`, or `skill/`) with valid content.

### Conflict Detected
```
Conflict detected:
  command/my-plugin--test.md exists but is untracked

Use --force to override existing files.
```
**Solution:** Either remove the conflicting file or use `--force` to override it:
```bash
bunx opencode-marketplace install /path/to/plugin --force
```

### Invalid Plugin Name
```
Error: Invalid plugin name "My_Plugin!". Plugin names must be lowercase alphanumeric with hyphens.
```
**Solution:** Rename your plugin directory to use only lowercase letters, numbers, and hyphens.

### Plugin Not Installed in Scope
```
Error: Plugin "my-plugin" is not installed in project scope.

Run 'opencode-marketplace list --scope project' to see installed plugins.
```
**Solution:** Check which scope the plugin is installed in:
```bash
bunx opencode-marketplace list
```

## Best Practices

1. **Use Descriptive Names**: Name plugins clearly (`git-helpers` not `gh`)
2. **Scan Before Installing**: Always run `scan` first to verify structure
3. **Use Project Scope for Project-Specific Tools**: Keep global scope clean
4. **Version with Content Hashing**: Trust the hash - no manual versions needed
5. **Document Your Plugins**: Add clear comments in your command/agent files
6. **Test Skills Thoroughly**: Ensure `SKILL.md` is complete before installing
7. **Organize Plugin Sources**: Keep a dedicated directory for your plugin collection

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
