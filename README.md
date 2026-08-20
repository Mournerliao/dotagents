# dotagents

Personal collection of AI and agent resources. Not a marketplace.

| Path | What |
|------|------|
| [`cli/`](cli/) | [`@mournerliao/agent-skills`](https://www.npmjs.com/package/@mournerliao/agent-skills) — catalog and CLI for agent skills |
| [`pi/`](pi/) | Original [pi](https://pi.dev) extensions; each subdirectory is its own npm package. First: [`@mournerliao/pi-cursor-provider`](https://www.npmjs.com/package/@mournerliao/pi-cursor-provider) |
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

## Pi extensions

```bash
pi install "$(pwd)/pi/cursor-provider"
```

See [pi/README.md](pi/README.md).

## Layout

Documentation stays at the repository root. Each installable package lives in its own subdirectory.
