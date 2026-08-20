# Own the Cursor provider so consent stays in Pi

Pi can use a Cursor subscription only by spawning Cursor Agent CLI. Upstream
`@netandreus/pi-cursor-provider` does that through `agent --print`, so tool execution
stays inside Cursor and Pi never sees a permission card. Widening
`~/.cursor/cli-config.json` would make the process able to delete; it would not ask in Pi.
`pi-cursor-sdk` uses `@cursor/sdk` instead of the CLI: it needs a Dashboard API key rather
than CLI login, and headless SDK runs have no human-in-the-loop approval (a blocked
Auto-review call is denied, not escalated).

This package therefore ships its own Cursor provider over `agent acp`. The CLI remains the
backend and keeps Cursor's allowlist / Auto-review policy. When that policy would ask a
human, the CLI sends `session/request_permission` and Pi shows the CLI's options.

## Considered options

- Keep `npm:@netandreus/pi-cursor-provider` and add a Pi permission-gate — rejected; the gate never sees Cursor CLI tools.
- Put `Delete(**)` / `Shell(rm)` on the Cursor allowlist — rejected; that is process permission, not consent.
- Spawn every Cursor turn with `--force` — rejected; that is session-wide auto-approve, not a confirmation.
- Retry a blocked `--print` turn with `--force` after one Pi confirm — rejected; that is after-the-fact, all-or-nothing, and re-runs side effects.
- Switch to `npm:pi-cursor-sdk` — rejected; it does not reuse Cursor CLI/subscription login, and the SDK has no interactive approval callback.
