---
name: find-skills-lite
description: Helps users discover skills curated by this repository when they ask how to find a skill, extend agent capabilities, or browse recommended upstream skills.
---

# Find Skills (Lite)

Discover capabilities through this repository's curated catalog (the sync set).

## When to use

Use this skill when the user:

- Asks "how do I do X" where X might already have a curated skill
- Says "find a skill for X" or "is there a skill for X"
- Wants to browse maintained vs delegated vs link-only entries

## How to help

1. List the sync set: `agent-skills list` or `agent-skills list --json`.
2. Prefer `maintained` when the user wants a skill hosted in this library.
3. For `delegated`, show the upstream URL and install with `agent-skills install <name> --dry-run` first, then `--accept-permissions` when they confirm.
4. For `link-only`, show the upstream URL only — do not pretend this CLI can install it until it is recorded as delegated or maintained.
5. To add something new to the library without installing: `agent-skills record --entry-json '...'`.

## Trust boundary

Delegated recipes run upstream installers. Link-only entries remain links. This skill stays inside this library's review boundary and does not invent marketplace install commands beyond the catalog recipes.
