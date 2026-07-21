# agent-skills

Personal capability library for coding agents. Record the skills (and later other capability kinds) you care about, sync the catalog through npm, and install / update / remove on any machine — with the same CLI for humans and agents.

**Chinese guide:** [docs/zh/guide.md](docs/zh/guide.md)

## Install

```bash
npx @mournerliao/agent-skills list
# or
npm install -g @mournerliao/agent-skills
agent-skills list
```

Requires Node.js 20+.

## What this is

| Concept | Meaning |
|---------|---------|
| Sync set / catalog | Your curated library: what exists and how to obtain it |
| Maintained | Canonical skill source hosted in this package |
| Delegated | Upstream install recipe (runs `npx skills`, `npx impeccable`, …) |
| Link-only | Upstream link without an install recipe |

This CLI does **not** keep a per-machine lock of what you installed. Pick agent and scope when you install.

## Commands

| Command | Purpose |
|---------|---------|
| `list` | Show the catalog (sync set) |
| `install` / `add` | Install a catalog entry |
| `update` | Update a catalog entry |
| `remove` | Remove a maintained install (or run a delegated remove recipe) |
| `record` | Add/refresh a catalog entry (`--entry-json`) — does not install |
| `validate` | Validate a skill directory or the catalog |

Common flags: `--agent`, `--scope`, `--catalog`, `--dry-run`, `--accept-permissions`, `--force`, `--json`.

### Examples

```bash
# Browse the library
agent-skills list
agent-skills list --json

# Install a maintained skill for Codex in the current project
agent-skills install commit --agent codex --scope project

# Preview a delegated upstream install
agent-skills install mattpocock-skills --dry-run

# Run the delegated recipe (requires explicit acceptance)
agent-skills install impeccable --accept-permissions

# Record a new delegated entry (agent-friendly)
agent-skills record --entry-json '{"kind":"delegated","name":"…", ...}'
```

## Supported platforms (maintained installs)

| Agent | Status |
|-------|--------|
| Codex | Supported |
| Claude Code | Supported |
| Cursor | Future target for maintained adapters; delegated recipes may still target Cursor via upstream CLIs |

## Catalog trust boundary

| Kind | Meaning |
|------|---------|
| `maintained` | Installable source in this package |
| `delegated` | Recipe runs an upstream installer; source is not vendored here |
| `link-only` | Recommendation link only |

Prefer **delegated** when a reliable upstream installer exists. Repository licensing does not override third-party licenses.

## Versioning

CLI releases and skill versions are independent. See [docs/versioning.md](docs/versioning.md) and [CHANGELOG.md](CHANGELOG.md).

Domain language: [CONTEXT.md](CONTEXT.md). Architecture decision: [docs/adr/0001-personal-capability-library.md](docs/adr/0001-personal-capability-library.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT for original repository content and the CLI. Third-party and delegated upstream content retains its own license and attribution.
