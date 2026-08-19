# Versioning

CLI releases, skill releases, and the pi-extensions package are versioned independently.

## CLI (`@mournerliao/agent-skills`)

- Uses semantic versioning for installer and adapter behavior.
- Documented in [`cli/CHANGELOG.md`](../cli/CHANGELOG.md).
- A CLI bump does **not** imply that every skill changed.

## Pi extensions (`@mournerliao/pi-extensions`)

- Uses semantic versioning for the `pi/` package.
- Documented in [`pi/CHANGELOG.md`](../pi/CHANGELOG.md).
- Loaded with `pi install`; not versioned through the skills catalog.

## Skills

- Each maintained skill declares its own semantic `version` in `skill.json`.
- Skill behavior changes are recorded in `cli/skills/<name>/CHANGELOG.md`.
- There is no per-machine lockfile. Catalog and `skill.json` versions describe the sync set; what a machine has installed is discovered from the install root (`~/.agents/skills` globally).

## Update policy

- Installed skill files stay stable until the user runs an explicit `update`.
- The CLI may report available or source versions through `list`, but it never silently rewrites managed files.
- Use `--dry-run` to preview filesystem changes before applying them.
