# OpenCode Marketplace - Specification

## Problem Statement

OpenCode's current plugin system is npm-centric (JS/TS modules with programmatic hooks). We want to bring a **declarative, file-based plugin distribution model** (inspired by Claude Code) to OpenCode — where you point to a directory and it auto-discovers components from well-known locations.

## Key Insight

OpenCode already uses file-based discovery for commands, agents, and skills:
- Commands: `~/.config/opencode/command/*.md` (global)
- Agents: `~/.config/opencode/agent/*.md` (global)
- Skills: `~/.config/opencode/skill/*/SKILL.md` (global)

**Our tool copies files and folders to these locations with namespaced prefixes, enabling clean install/uninstall workflows.**

---

## Goals (v1)

1. Install plugins from **local directories**
2. Support **commands**, **agents**, and **skills** as component types
3. Track installed plugins with **scope support** (user-global vs project-local)
4. Provide clean install/uninstall/list/scan workflow
5. **No Manifests**: Fully convention-based discovery (directory name = plugin name)
6. **Change Detection**: Content-based hashing instead of version numbers

---

## Installation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Source: /path/to/my-plugin/                                    │
│  ├── command/                                                   │
│  │   └── reflect.md                                             │
│  ├── agent/                                                     │
│  │   └── reviewer.md                                            │
│  └── skill/                                                     │
│      └── code-review/                                           │
│          ├── SKILL.md                                           │
│          └── data.json                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ copy with prefix
┌─────────────────────────────────────────────────────────────────┐
│  Target: ~/.config/opencode/                                    │
│  ├── command/                                                   │
│  │   └── my-plugin--reflect.md                                  │
│  ├── agent/                                                     │
│  │   └── my-plugin--reviewer.md                                 │
│  ├── skill/                                                     │
│  │   └── my-plugin--code-review/                                │
│  │       ├── SKILL.md                                           │
│  │       └── data.json                                          │
│  └── plugins/                                                   │
│      └── installed.json  ← registry                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Plugin Source Structure & Discovery

A plugin is simply a directory. Components are discovered by checking locations in a strict **priority order** (first match wins per component type).

### Discovery Priority

| Component | Priority 1 | Priority 2 | Priority 3 | Priority 4 |
|-----------|------------|------------|------------|------------|
| **Commands** | `.opencode/command/` | `.claude/commands/` | `./command/` | `./commands/` |
| **Agents** | `.opencode/agent/` | `.claude/agents/` | `./agent/` | `./agents/` |
| **Skills** | `.opencode/skill/` | `.claude/skills/` | `./skill/` | `./skills/` |

### Component Rules

- **Commands/Agents**: All `*.md` files in the discovered directory are copied.
- **Skills**: All **subdirectories** in the discovered directory that contain a `SKILL.md` file are copied recursively.

### Identity & Versioning

- **Name**: Derived from the plugin directory name (normalized to lowercase kebab-case).
- **Version**: Replaced by **Content Hash** (8-char hex SHA256).
- **Hash Input**: Concatenated content of all commands, agents, and `SKILL.md` files (sorted alphabetically).

---

## Installation Mechanics

### Scopes

| Scope | Commands Target | Agents Target | Skills Target | Registry Location |
|-------|-----------------|---------------|---------------|-------------------|
| `user` (default) | `~/.config/opencode/command/` | `~/.config/opencode/agent/` | `~/.config/opencode/skill/` | `~/.config/opencode/plugins/installed.json` |
| `project` | `.opencode/command/` | `.opencode/agent/` | `.opencode/skill/` | `.opencode/plugins/installed.json` |

### File Naming Convention

Files and folders are copied with a **prefix** to namespace them:
`{plugin-name}--{original-name}`

Example:
- Source: `my-plugin/skill/review/`
- Target: `~/.config/opencode/skill/my-plugin--review/`

### Conflict Handling

- If target exists and belongs to **same plugin** → overwrite (reinstall/update)
- If target exists and belongs to **different plugin** → error
- If target exists and is **untracked** → error (use `--force` to override)

---

## Registry

Track installed plugins in `installed.json`:

```json
{
  "version": 1,
  "plugins": {
    "my-plugin": {
      "scope": "user",
      "sourcePath": "/absolute/path/to/my-plugin",
      "hash": "a1b2c3d4",
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

---

## CLI Interface

### Commands

```bash
# Install from local path
opencode-marketplace install /path/to/my-plugin

# List installed plugins
opencode-marketplace list

# Uninstall a plugin
opencode-marketplace uninstall my-plugin

# Scan a directory (dry-run)
opencode-marketplace scan /path/to/my-plugin
```

### Example Output

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
    
  uspp [f7e8d9c0] (4 commands)
    Source: /home/user/plugins/uspp
```

---

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Dependencies**: Minimal (Bun built-ins preferred)

---

## Deferred / Out of Scope (v1)

- Remote installation (GitHub URLs)
- Plugin dependencies
- Marketplace browsing
