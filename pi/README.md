# @mournerliao/pi-extensions

Personal [pi](https://pi.dev) extensions. This package is the `pi/` directory of [dotagents](https://github.com/Mournerliao/dotagents). It is not part of the skills catalog; install it with `pi install`, not `agent-skills`.

Put original extensions in `extensions/`. Extract testable logic into `src/` when it needs unit tests.

## Install

From a git checkout of this repo:

```bash
pi install "$(pwd)/pi"
```

After publish:

```bash
pi install npm:@mournerliao/pi-extensions
```

Try once without writing settings:

```bash
pi -e "$(pwd)/pi"
```

If `@netandreus/pi-cursor-provider` is already installed, remove it first so both packages do not register the `cursor` provider:

```bash
pi remove npm:@netandreus/pi-cursor-provider
```

Filter to one extension in `~/.pi/agent/settings.json` (path is whatever `pi install` wrote):

```json
{
  "packages": [
    {
      "source": "/absolute/path/to/dotagents/pi",
      "extensions": ["extensions/cursor-provider.ts"]
    }
  ]
}
```

## Extensions

### cursor-provider

Routes Pi model requests through the Cursor Agent CLI (`agent`) so a Cursor subscription can be used from Pi. Select a model with `/model cursor/<id>`, for example `/model cursor/auto`.

Authentication is the CLI's job: `agent login`, or `CURSOR_API_KEY`. Inside Pi: `/cursor-login`, `/cursor-status`, `/cursor-logout`.

Cursor CLI executes tools itself. Pi only observes the stream. `--print` has no approval card, so this extension does **not** write `Delete(**)` into `~/.cursor/cli-config.json`.

When a tool is rejected (Auto-review, allowlist, and similar), the TUI asks whether to retry **this turn** with `--force`. That is one spawn. It is not a lasting Cursor permission. Without a UI, the stream records the rejection and tells you to run `/cursor-allow`.

| Command | Effect |
|---------|--------|
| `/cursor-allow` | Next turn spawns with `--force` |
| `/cursor-allow session` | This Pi session spawns with `--force` |
| `/cursor-allow off` | Stop adding `--force` |

`--force` auto-approves Cursor tools for that spawn, including ones Auto-review would block. Already-applied edits may run again on a retry.

Environment: `CURSOR_AGENT_PATH` (or `AGENT_PATH`), `CURSOR_API_KEY`.

Adapted from [`@netandreus/pi-cursor-provider`](https://github.com/netandreus/pi-cursor-provider) (MIT).

## Develop

```bash
npm test --prefix pi
npm run typecheck --prefix pi
```

Requires Node.js 20+. Tests use Node's type stripping (CI uses Node 22).
