# agent-skills

Curated skill distribution for coding agents. This repository hosts original and intentionally maintained skills, recommends third-party skills without casually vendoring them, and provides a CLI that installs the same canonical skill into agent-specific layouts.

**Chinese guide:** [docs/zh/guide.md](docs/zh/guide.md)

## Install

One-command usage (after publish):

```bash
npx @mournerliao/agent-skills list --catalog
```

Or install globally:

```bash
npm install -g @mournerliao/agent-skills
agent-skills list --catalog
```

From a clone of this repository:

```bash
npm ci
npm run build
node dist/cli.js list --catalog
```

Requires Node.js 20+.

## Supported platforms

| Agent | Status |
|-------|--------|
| Codex | Supported |
| Claude Code | Supported |
| Cursor | Future target |
| WorkBuddy | Future target |

Only Codex and Claude Code are advertised as supported in the first release.

## Quick start (Codex, project scope)

After installing the package, the CLI ships with a bundled catalog and maintained skills. From any project directory:

```bash
# Browse the curated catalog (bundled with the package)
agent-skills list --catalog

# Interactive install: pick a maintained skill, agent=codex, scope=project
agent-skills add
```

Non-interactive install from a local canonical skill directory (clone or unpacked package path):

```bash
agent-skills add /path/to/skill --agent codex --scope project
```

Project scope is the default. Global scope is available with `--scope global` (Claude Code installs commonly use the global home layout).

## Commands

| Command | Purpose |
|---------|---------|
| `add` | Install a skill (interactive catalog flow or non-interactive local source) |
| `list` | List installed managed skills, or `list --catalog` for curated entries |
| `update` | Explicitly update a managed skill (`--dry-run`, `--force`) |
| `remove` | Remove installer-owned files and lock state for a managed skill |
| `validate` | Validate a local skill directory or `validate --catalog` |

### Interactive vs non-interactive

- **Interactive:** `agent-skills add` (optional `--catalog <path>`) prompts for skill, agent, and scope.
- **Non-interactive:** `agent-skills add <local-source> --agent <codex\|claude-code> [--scope <project\|global>] [--dry-run] [--accept-permissions]`

### Dry-run, lock state, and permissions

- `--dry-run` previews planned writes and permission requirements without changing the filesystem.
- Successful installs record source, skill version, agent, scope, and owned files in `agent-skills.lock.json`.
- Skills that declare sensitive capabilities (commands, network, secrets, write locations, or bundled scripts) require confirmation interactively, or `--accept-permissions` for non-interactive installs.

## Catalog trust boundary

| Kind | Meaning |
|------|---------|
| `maintained` | Installable source hosted in this repository (original or maintained fork) |
| `catalog-only` | Upstream recommendation / link only — not copied or installed by default |

Maintained forks declare provenance (upstream, baseline, reason, changes, attribution). Repository-level licensing does not override third-party licenses.

## Maintained skills in this release

| Skill | Notes |
|-------|-------|
| `summarize` | Concise conversation/selection summaries (Codex) |
| `find-skills-lite` | Discover skills through this catalog without third-party marketplace CLIs |
| `example` | Minimal reference skill for contributors and adapter smoke checks |

## Versioning

CLI releases and skill versions are independent. See [docs/versioning.md](docs/versioning.md) and the root [CHANGELOG.md](CHANGELOG.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Pull requests are welcome; the maintainer retains final curation authority.

## Known limitations

- No silent or background skill updates.
- No model behavior scoring or prompt-quality rankings.
- Catalog-only third-party compatibility is not guaranteed.
- Cursor and WorkBuddy adapters are not part of this release.

Full release notes: [CHANGELOG.md](CHANGELOG.md).

## License

MIT for original repository content and the CLI. Third-party and forked skill content retains its own license and attribution.
