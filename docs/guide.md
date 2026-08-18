# @mournerliao/agent-skills

Personal capability library for coding agents. Record the skills you care about, sync the catalog through npm, and install / update / remove on any machine — with the same CLI for humans and agents.

This CLI lives in [`cli/`](../cli/) of the [dotagents](https://github.com/Mournerliao/dotagents) repository.

**Chinese guide:** [zh/guide.md](zh/guide.md)

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

This CLI does **not** keep a per-machine lock of what you installed. Pick agent and scope when you install; discover current installs from the install root (`~/.agents/skills` globally).

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
npx @mournerliao/agent-skills list
npx @mournerliao/agent-skills list --json

# Install this CLI's operator skill globally (Cursor reads ~/.agents/skills)
npx @mournerliao/agent-skills install agent-skills --agent codex --scope global

# Install a maintained skill for Codex in the current project
npx @mournerliao/agent-skills install commit --agent codex --scope project

# Preview a delegated upstream install
npx @mournerliao/agent-skills install mattpocock-skills --dry-run

# Run the delegated recipe (requires explicit acceptance)
npx @mournerliao/agent-skills install impeccable --accept-permissions

# Record a new delegated entry (agent-friendly)
npx @mournerliao/agent-skills record --entry-json '{"kind":"delegated","name":"…", ...}'
```

To edit the published catalog from a git checkout, point `--catalog` at `cli/catalog/catalog.json`.

## Supported platforms (maintained installs)

| Agent | Status |
|-------|--------|
| Codex | Supported (`--agent codex` writes `.agents/skills`) |
| Claude Code | Supported (`--agent claude-code` writes `.claude/skills`) |
| Cursor | Consumes the Codex/agents root (`~/.agents/skills` globally). Not a copy target: do not install into `~/.cursor/skills`. |

`compatibility` lists which agents can **use** an entry after it is installed. It is not a list of directories to copy into. Global install root is `~/.agents/skills`; operators discover installs from that tree. This CLI does not add a Cursor copy adapter, and delegated recipes must not pass `-a cursor` or a Cursor provider.

## Catalog trust boundary

| Kind | Meaning |
|------|---------|
| `maintained` | Installable source in this package |
| `delegated` | Recipe runs an upstream installer; source is not vendored here |
| `link-only` | Recommendation link only |

Prefer **delegated** when a reliable upstream installer exists. Repository licensing does not override third-party licenses.

## Versioning

CLI releases and skill versions are independent. See [versioning.md](versioning.md) and [cli/CHANGELOG.md](../cli/CHANGELOG.md).

Domain language: [CONTEXT.md](../CONTEXT.md). Architecture decisions: [0001](adr/0001-personal-capability-library.md), [0002](adr/0002-shared-agents-install-root.md).

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md).

## License

MIT for original repository content and the CLI. Third-party and delegated upstream content retains its own license and attribution.
