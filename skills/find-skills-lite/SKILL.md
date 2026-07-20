---
name: find-skills-lite
description: Helps users discover skills curated by this repository when they ask how to find a skill, extend agent capabilities, or browse recommended upstream skills.
---

# Find Skills (Lite)

This maintained fork helps agents discover skills through this repository's curated catalog.

## When to use

Use this skill when the user:

- Asks "how do I do X" where X might already have a curated skill
- Says "find a skill for X" or "is there a skill for X"
- Wants to browse what this repository maintains versus what it only recommends

## How to help

1. List curated entries with `agent-skills list --catalog`.
2. Prefer `maintained` entries when the user wants an installable skill from this repository.
3. For `catalog-only` entries, show the upstream URL and explain that this repository does not copy or install that source by default.
4. Install only maintained skills through `agent-skills add`, never by silently vendoring a catalog-only upstream.

## Trust boundary

Catalog-only recommendations remain upstream links. This skill intentionally omits third-party marketplace install commands so discovery stays inside the repository's review boundary.
