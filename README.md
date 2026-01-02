# OpenCode Marketplace

CLI for installing OpenCode plugins from local directories or GitHub repositories.

## Features

- 📦 Install from **local directories** or **GitHub URLs**
- 🔄 **Update** remote plugins with one command
- 🎯 **Zero-config** convention-based discovery
- 🔐 **Content-hash** based change detection
- 🎭 Support for **commands**, **agents**, and **skills**
- 🌍 **User-global** or **project-local** scope

## Installation

```bash
bunx opencode-marketplace <command>
```

Or install globally:

```bash
bun install -g opencode-marketplace
```

## Quick Start

```bash
# Install from local directory
opencode-marketplace install /path/to/my-plugin

# Install from GitHub
opencode-marketplace install https://github.com/user/repo

# Install from subfolder
opencode-marketplace install https://github.com/user/repo/tree/main/plugins/foo

# Update a remote plugin
opencode-marketplace update my-plugin

# List installed plugins
opencode-marketplace list

# Scan before installing (dry-run)
opencode-marketplace scan https://github.com/user/repo

# Uninstall
opencode-marketplace uninstall my-plugin
```

## Plugin Structure

A plugin is a directory with components in well-known locations:

```
my-plugin/
├── command/         # or .opencode/command/, .claude/commands/
│   └── reflect.md
├── agent/          # or .opencode/agent/, .claude/agents/
│   └── reviewer.md
└── skill/          # or .opencode/skill/, .claude/skills/
    └── code-review/
        ├── SKILL.md
        └── reference.md
```

**Discovery Priority:** `.opencode/*` → `.claude/*` → `./command/` → `./commands/`

## How It Works

1. **Discovery** - Scans for components using convention-based paths
2. **Namespacing** - Copies files with prefixes: `my-plugin--reflect.md`
3. **Registry** - Tracks installations in `~/.config/opencode/plugins/installed.json`
4. **Change Detection** - Content hashing detects actual changes

## Scopes

| Scope | Target | Registry |
|-------|--------|----------|
| `user` (default) | `~/.config/opencode/` | `~/.config/opencode/plugins/installed.json` |
| `project` | `.opencode/` | `.opencode/plugins/installed.json` |

Use `--scope project` for project-local installations.

## Example Output

```bash
$ opencode-marketplace install https://github.com/user/awesome-plugins/tree/main/misc

Installing misc [a1b2c3d4]...
  → command/misc--reflect.md
  → skill/misc--review/

Installed misc (1 command, 1 skill) to user scope.
```

```bash
$ opencode-marketplace list

User scope:
  misc [a1b2c3d4] (1 command, 1 skill)
    Source: https://github.com/user/awesome-plugins/tree/main/misc
```

## Development

```bash
bun install          # Install dependencies
bun run dev          # Run locally
bun test             # Run tests
bun run lint         # Lint code
```

## License

MIT
