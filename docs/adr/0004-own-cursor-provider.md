# Own the Cursor provider so consent stays in Pi

Pi can use a Cursor subscription only by spawning Cursor Agent CLI. Upstream `@netandreus/pi-cursor-provider` does that, but tool execution stays inside `agent --print`, so Pi's `tool_call` gate never sees deletes and Cursor's approval card never appears. Widening `~/.cursor/cli-config.json` would make the process able to delete; it would not ask in Pi.

This package therefore ships its own Cursor provider. The CLI remains the backend. When a tool is rejected, Pi asks and may retry **that turn** with `--force`. That is not a lasting Cursor allowlist entry, and it is not a generic Pi `tool_call` extension pretending to wrap Cursor.

## Considered options

- Keep `npm:@netandreus/pi-cursor-provider` and add a Pi permission-gate — rejected; the gate never sees Cursor CLI tools.
- Put `Delete(**)` / `Shell(rm)` on the Cursor allowlist — rejected; that is process permission, not consent.
- Spawn every Cursor turn with `--force` — rejected; that is session-wide auto-approve, not a confirmation.
