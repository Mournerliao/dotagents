---
status: superseded by ADR-0005
---

# Pi extensions live in `pi/`, installed with `pi install`

Original pi-coding-agent extensions are a sibling package at `pi/`, published as `@mournerliao/pi-cursor-provider` (named for the only extension so far). They are a pi package: conventional `extensions/` plus a `package.json` `pi` manifest. Machines load them with `pi install` (local path, npm, or `-e` for a one-shot run). They are **not** catalog entries and are **not** installed by `@mournerliao/agent-skills`.

The skills CLI remains the sync surface for skills. Pi has its own package loader; wrapping that loader in the catalog would duplicate `pi install` and mix two install roots.

Superseded: `pi/` is the store; each extension subdirectory is the published package. See [0005](0005-pi-extension-packages.md).

## Considered options

- Add a `capabilityKind: "pi-extension"` to the skills catalog — rejected; pi already discovers and updates packages through `settings.json`.
- Put extensions under `cli/` next to skills — rejected; that package is the skills CLI and would ship unrelated runtime into `@mournerliao/agent-skills`.
- Copy into `~/.pi/agent/extensions/` as the source of truth — rejected; generated files already live there (Otty, Kooky). Authored extensions belong in git.
