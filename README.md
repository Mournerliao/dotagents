# dotagents

Personal collection of AI and agent resources. Not a marketplace.

| Path | What |
|------|------|
| [`cli/`](cli/) | [`@mournerliao/agent-skills`](https://www.npmjs.com/package/@mournerliao/agent-skills) — catalog and CLI for agent skills |
| [`pi/`](pi/) | [`@mournerliao/pi-extensions`](pi/) — original [pi](https://pi.dev) extensions (`pi install`) |
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
pi install "$(pwd)/pi"
```

The first extension is a Cursor Agent CLI provider. See [pi/README.md](pi/README.md).

## Layout

Documentation stays at the repository root. Each installable package lives in its own subdirectory.
