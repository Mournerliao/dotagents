# Each Pi extension is its own package under `pi/`

`pi/` is the authoring folder for original pi-coding-agent extensions, not an npm package. Each subdirectory is one pi package: conventional `extensions/` plus a `package.json` `pi` manifest, published under its own npm name. Machines load that package with `pi install` (subdirectory path, npm, or `-e`). They are not catalog entries and are not installed by `@mournerliao/agent-skills`.

This supersedes ADR-0003's decision to publish the whole `pi/` tree as `@mournerliao/pi-cursor-provider`.

The skills CLI remains the sync surface for skills. Pi has its own package loader; wrapping that loader in the catalog would duplicate `pi install` and mix two install roots.

## Considered options

- Publish `pi/` as one collection npm package — rejected; `pi/` is a store, and a collection name would hide that each extension is independently installable.
- Nested `pi/packages/<name>/` — rejected; an extra directory with one package.
- Put extensions under `cli/` next to skills — still rejected; that package is the skills CLI.
