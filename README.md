# dotagents

Personal collection of AI and agent resources. Not a marketplace.

| Path | What |
|------|------|
| [`cli/`](cli/) | [`@mournerliao/agent-skills`](https://www.npmjs.com/package/@mournerliao/agent-skills) — catalog and CLI for agent skills |
| [`docs/`](docs/) | Guides, ADRs, and agent-facing domain docs |

## Skills

Same CLI for humans and agents:

```bash
npx @mournerliao/agent-skills list
```

The global binary is `agent-skills`.

- English guide: [docs/guide.md](docs/guide.md)
- 中文指南: [docs/zh/guide.md](docs/zh/guide.md)
- Domain language: [CONTEXT.md](CONTEXT.md)
- CLI changelog: [cli/CHANGELOG.md](cli/CHANGELOG.md)

## Layout

Documentation stays at the repository root. Each installable package lives in its own subdirectory.
