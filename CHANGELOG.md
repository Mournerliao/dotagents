# Changelog

All notable changes to the `@mournerliao/agent-skills` CLI are documented here.

Skill behavior changes are tracked in each skill's own `CHANGELOG.md` under `skills/`. See [Versioning](docs/versioning.md).

## Unreleased

### Changed

- Delegated recipes no longer copy into Cursor (`-a cursor` / Cursor providers removed). Cursor consumes `~/.agents/skills`.
- Documented the shared install root, `compatibility` as consume-not-copy, and that personal git-symlink layouts are out of band.
- `commit` 1.0.1: drop the "copy into Cursor skills" instruction; this package is the published snapshot.
- Replaced maintained skill `find-skills-lite` with `agent-skills` (CLI operate + catalog discovery).

### Added

- ADR 0002: shared agents install root.

## 0.2.1 — 2026-07-23

### Changed

- Reformatted human-readable `list` output into labeled, wrapped entry blocks; `--json` remains unchanged.

### Fixed

- Check sensitive-capability permission acceptance before probing maintained-skill dependencies.
- Use the platform-native dependency locator on Windows and make package tests independent of inherited npm prefixes.

## 0.2.0 — 2026-07-21

### Changed

- Repositioned as a **personal capability library**: catalog is the sync set; CLI parity for humans and agents (`--json`).
- **Removed** per-machine `agent-skills.lock.json` managed installs. Install/update/remove no longer persist an install inventory.
- `list` always lists the catalog (sync set), not local lock state.
- Catalog entry kinds: `maintained`, `delegated` (install recipes), `link-only` (legacy `catalog-only` still accepted when reading).
- Primary install command is `install` (`add` remains an alias). Added `record --entry-json` to upsert catalog entries without installing.
- Delegated installs embed and run upstream argv recipes; `--dry-run` prints them; non-interactive runs require `--accept-permissions`.

### Added

- Maintained skill `commit`.
- Delegated catalog entries: `mattpocock-skills`, `impeccable`.
- ADR: personal capability library with delegated recipes.

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
