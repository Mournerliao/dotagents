---
name: agent-skills
description: Operate @mournerliao/agent-skills: list, install, update, remove, or record the personal capability catalog. Use when the user mentions agent-skills, @mournerliao/agent-skills, syncing skills, installing a catalog skill, or asks if this library has a skill for X. Prefer this CLI over npx skills or npx impeccable when the catalog already has that entry.
---

# Agent skills

Personal capability library. Same CLI for humans and agents.

## CLI

```bash
npx --yes @mournerliao/agent-skills <command>
```

Use a PATH binary named `agent-skills` only when it already exists. Requires Node.js 20+.

## Discover

Run list, then name matching entries and their `kind`. Stop when the user can choose an entry or you can say the catalog has no match.

```bash
npx --yes @mournerliao/agent-skills list --json
```

| kind | Meaning |
|------|---------|
| `maintained` | Source in this package |
| `delegated` | Catalog recipe runs an upstream installer |
| `link-only` | URL only; this CLI cannot install it |

## Install maintained

`--agent` is `codex` or `claude-code`. `--scope` is `project` (default) or `global`.

Cursor reads the Codex global root. For a skill to show up in Cursor:

```bash
npx --yes @mournerliao/agent-skills install <name> --agent codex --scope global
```

That writes `~/.agents/skills/<name>`. Write there; do not write `~/.cursor/skills`.

Claude Code: `--agent claude-code` (`.claude/skills`).

Done when the CLI reports installed and the files exist under that install root.

## Install delegated

1. `install <name> --dry-run` and show the recipe.
2. After the user confirms: `install <name> --accept-permissions`.

When the catalog already has the recipe, run this CLI. Do not hand-run `npx skills` or `npx impeccable` for that entry. Recipes land in Claude Code and Codex/agents roots only.

Done when dry-run was shown, the user accepted, and the CLI reports completion.

## Update and remove

Use the same `--agent` / `--scope` that installed a maintained entry.

```bash
npx --yes @mournerliao/agent-skills update <name> --agent codex --scope global
npx --yes @mournerliao/agent-skills remove <name> --agent codex --scope global
```

Delegated update/remove run the catalog recipe when one exists.

## Record

Record writes a catalog file. It does not install.

To change the published library, point `--catalog` at this repository's `cli/catalog.json` in a git checkout, then commit. Do not record into an npx cache copy.

```bash
npx --yes @mournerliao/agent-skills record --catalog /path/to/dotagents/cli/catalog.json --entry-json '<catalog-entry-object>'
```

Done when the CLI reports the entry recorded and the checkout catalog contains it.
