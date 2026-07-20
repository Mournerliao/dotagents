# Changelog

All notable changes to the `@mournerliao/agent-skills` CLI are documented here.

Skill behavior changes are tracked in each skill's own `CHANGELOG.md` under `skills/`. See [Versioning](docs/versioning.md).

## 0.1.0 — 2026-07-20

### Added

- First public CLI release packaged as `@mournerliao/agent-skills`.
- Core commands: `add`, `list`, `update`, `remove`, and `validate`.
- Interactive catalog browsing and non-interactive local-source installs.
- Project (default) and global installation scopes for Codex and Claude Code.
- Lock manifest (`agent-skills.lock.json`) recording source, version, agent, scope, and owned files.
- Explicit updates only (`--dry-run` / `--force` supported); no silent updates.
- Permission review for declared sensitive capabilities (`--accept-permissions`).
- Curated catalog with maintained skills and catalog-only recommendations.
- Maintained skills shipped in this release: `example` (minimal reference), `summarize`, and `find-skills-lite`.

### Known limitations

- Supported agents in this release: **Codex** and **Claude Code** only. Cursor and WorkBuddy are named future targets and are not advertised as supported.
- Catalog-only entries are recommendations (upstream links). This CLI does not copy or install their source by default.
- This release does **not** perform silent or background skill updates.
- This release does **not** score model behavior, prompt quality, or agent output.
- Compatibility for catalog-only third-party skills is not guaranteed.
