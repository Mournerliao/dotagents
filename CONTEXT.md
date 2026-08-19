# Domain context

This glossary describes the **skills** capability library (`cli/`, published as `@mournerliao/agent-skills`). The repository around it is a personal collection of AI and agent resources; other kinds may appear as sibling directories (`pi/` for original pi-coding-agent extensions).

Personal tool library for syncing a curated set of agent capabilities (skills first; other capability kinds later) across machines, with one-shot install, update, and remove.

## Glossary

| Term | Meaning |
|------|---------|
| Personal tool library | This project's purpose: a personal, curated sync surface for capabilities the owner uses across machines — not a public skills marketplace. |
| Pi package | An installable bundle of original pi-coding-agent extensions in `pi/`, published as `@mournerliao/pi-cursor-provider`. Machines load it with `pi install`, not the skills CLI. |
| Cursor provider | A pi custom provider that uses the owner's Cursor subscription as the model backend by spawning Cursor Agent CLI. |
| Capability kind | The type of a sync-set entry (e.g. `skill` now; `mcp` and others later). The catalog and CLI are shaped to allow new kinds without redesigning the library model; only `skill` is implemented in the near term. |
| Sync set | The owner's curated library of capabilities recorded in this project — what exists and how it can be obtained. It does **not** record which entries a given machine has installed, nor which agent or scope was chosen. |
| Sync channel | How a machine obtains the current sync set and CLI: **npm package** is the primary consumer path; **git** is the authoring/development path. |
| Sync | On a machine, install or update chosen entries from the sync set. The operator (human or agent) picks which entries, which agents, and which scope (`project` \| `global`) at run time. Uninstall is a separate explicit action. |
| Record | Add or refresh an entry in the sync set only (maintained path or delegated install recipe). Does not install onto the current machine; install/update/remove are separate commands. |
| CLI parity | Every capability exposed for humans via the CLI is also usable by agents, and vice versa — same commands and flags; no agent-only or human-only power. The CLI is built for both operators. Default output is human-readable; `--json` selects machine-readable output for the same commands. |
| Inclusion mode | How a catalog entry joins the sync set: `maintained` (canonical source hosted here) or `delegated` (an install recipe that invokes an upstream installer). Chosen per entry; prefer `delegated` when a reliable upstream installer exists. Symlinking a personal git checkout from another repo is out of band — not an inclusion mode. |
| Maintained skill | An original or intentionally maintained skill hosted in this repository as installable canonical source (`inclusion mode: maintained`). |
| Original skill | A maintained skill authored in this repository (`provenance.kind: "original"`), with no upstream fork fields. |
| Maintained fork | A maintained skill adapted from an upstream source, with declared baseline, reason, local change history, and attribution. |
| Install recipe | Declared upstream install/update/remove commands for a delegated entry. The CLI embeds and runs them for real installs; dry-run prints the same commands without executing. Humans and agents can both inspect the recipe so upstream install steps stay visible. |
| Delegated entry | A sync-set entry that is not vendored here; lifecycle actions run through its install recipe against an upstream installer. |
| Provenance | Metadata that distinguishes original, maintained-fork, and external/delegated records and records ownership lineage. |
| Attribution | Credit and license notice preserved for upstream authors when cataloging or forking third-party work. |
| Catalog-only entry | Legacy name for an upstream link recorded without an install recipe; not installable through this library until it becomes a delegated entry or a maintained skill. Prefer **Delegated entry** for actionable sync-set items. |
| Catalog | The curated list that is the sync set: maintained and delegated entries (plus any legacy non-actionable links still kept for reference). |
| Support status | Whether an entry is actionable as `maintained`, actionable as `delegated`, or non-actionable `link-only` (legacy catalog-only). |
| Compatibility | Which agents can **consume** an entry after it is installed. Not a list of directories to copy into. Cursor can consume skills from the shared install root without a Cursor write adapter. |
| Install root | Where files land. Maintained `--agent codex` writes `.agents/skills`; `--agent claude-code` writes `.claude/skills`. The **global** shared root is `~/.agents/skills`. Cursor reads that directory; this library does not copy into `~/.cursor/skills`. |
| List | Show entries recorded in the sync set / catalog. Does not inventory what is installed on the current machine. |
| Managed installation | Legacy concept: a local lock record of installer-owned files. **Not part of the intended personal-library model** — this library does not persist per-machine install inventories; operators (human or agent) discover current installs from the **install root** when needed. Environment discovery only works if that root is unique per scope. |
| Explicit update | A non-silent `update` that runs only after an explicit command (optional dry-run / force). For maintained entries it refreshes from canonical source; for delegated entries it runs the update recipe. No local install inventory is required first. |
| Bundled resources | Optional skill package paths declared under `resources` (`scripts`, `references`, `templates`, `assets`) and listed in `files`. |
| Sensitive capabilities | Declared needs that require review before install: commands, dependencies, network, secrets, permissions, write locations, and non-empty `resources.scripts`. |
| Permission review | Concise pre-install summary of declared capabilities, bundled resources, or upstream install-recipe effects. Interactive flows prompt for acceptance; non-interactive installs require an explicit accept flag (dry-run may preview without accepting). |
