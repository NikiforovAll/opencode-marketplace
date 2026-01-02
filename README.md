# OpenCode Marketplace

CLI marketplace for OpenCode plugins - declarative, file-based plugin distribution for commands, agents, and skills.

## Overview

OpenCode Marketplace brings a convention-based plugin system to OpenCode. Instead of npm packages with programmatic hooks, plugins are simply directories with well-known folder structures that get auto-discovered and installed.

**Key Features:**
- 📦 Install plugins from local directories
- 🎯 Zero-config, convention-based discovery
- 🔄 Content-hash based change detection (no version numbers)
- 🎭 Support for commands, agents, and skills
- 🌍 User-global or project-local scope
- 🧹 Clean install/uninstall workflows

## Installation

```bash
bunx opencode-marketplace <command>
```

Or install globally:

```bash
bun install -g opencode-marketplace
```

## Quick Start

### Install a Plugin

```bash
opencode-marketplace install /path/to/my-plugin
```

### List Installed Plugins

```bash
opencode-marketplace list
```

### Scan a Plugin (Dry Run)

```bash
opencode-marketplace scan /path/to/my-plugin
```

### Uninstall a Plugin

```bash
opencode-marketplace uninstall my-plugin
```

## Plugin Structure

A plugin is a directory containing components in well-known locations:

```
my-plugin/
├── command/           # or .opencode/command/, .claude/commands/
│   └── reflect.md
├── agent/            # or .opencode/agent/, .claude/agents/
│   └── reviewer.md
└── skill/            # or .opencode/skill/, .claude/skills/
    └── code-review/
        ├── SKILL.md
        └── data.json
```

### Discovery Priority

The tool searches for components in this order (first match wins):

| Component | Priority 1 | Priority 2 | Priority 3 | Priority 4 |
|-----------|------------|------------|------------|------------|
| Commands | `.opencode/command/` | `.claude/commands/` | `./command/` | `./commands/` |
| Agents | `.opencode/agent/` | `.claude/agents/` | `./agent/` | `./agents/` |
| Skills | `.opencode/skill/` | `.claude/skills/` | `./skill/` | `./skills/` |

## How It Works

### 1. Discovery
The tool scans your plugin directory for components using convention-based paths.

### 2. Namespacing
Files are copied with a prefix to avoid conflicts:
- Source: `my-plugin/command/reflect.md`
- Target: `~/.config/opencode/command/my-plugin--reflect.md`

### 3. Registry
Installed plugins are tracked in `~/.config/opencode/plugins/installed.json` with:
- Content hash (instead of version)
- Source path
- Installed components
- Scope (user/project)

### 4. Change Detection
Content hashing ensures you only reinstall when files actually change.

## Scopes

| Scope | Target Location | Registry |
|-------|----------------|----------|
| `user` (default) | `~/.config/opencode/` | `~/.config/opencode/plugins/installed.json` |
| `project` | `.opencode/` | `.opencode/plugins/installed.json` |

## Example

```bash
$ opencode-marketplace install ~/plugins/misc

Installing misc [a1b2c3d4]...
  → command/misc--reflect.md
  → skill/misc--git-review/

Installed misc (1 command, 1 skill) to user scope.
```

```bash
$ opencode-marketplace list

Installed plugins (user scope):
  misc [a1b2c3d4] (1 command, 1 skill)
    Source: /home/user/plugins/misc
```

## Development

### Setup

```bash
bun install
```

### Run Locally

```bash
bun run dev
```

### Test

```bash
bun test
```

### Lint & Format

```bash
bun run lint
bun run format
```

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **CLI Framework**: CAC
- **Testing**: Bun's built-in test runner

## Roadmap

**v1** (Current):
- ✅ Local directory installation
- ✅ Commands, agents, and skills support
- ✅ User/project scope
- ✅ Content-hash based updates

**Future**:
- Remote installation (GitHub URLs)
- Plugin dependencies
- Marketplace browsing

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR on [GitHub](https://github.com/NikiforovAll/opencode-marketplace).
