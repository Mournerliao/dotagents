# Personal capability library with delegated recipes

This project is a personal tool library: the catalog is a sync set of capabilities (skills first), not a marketplace and not a per-machine install inventory. Entries are either **maintained** (canonical source in-repo) or **delegated** (install recipes that run upstream CLIs). Prefer delegated when a reliable upstream installer exists. The CLI serves humans and agents with the same commands (`CLI parity`); default output is human-readable and `--json` is machine-readable. Lifecycle commands do not write a lockfile—operators discover what is installed from the **install root** (`~/.agents/skills` globally) when needed. Recording only mutates the catalog; install/update/remove are separate. Cursor consumes that shared root; it is not a copy target. See [0002-shared-agents-install-root.md](0002-shared-agents-install-root.md).

## Considered options

- Stay a maintained-only distributor with lock-managed installs — rejected; blocks personal sync of upstream tools like Matt Pocock skills / Impeccable without vendoring.
- Become a full GitHub skills marketplace client — rejected; duplicates `npx skills` and blurs curation.
- Catalog links only (no executable recipes) — rejected; agents cannot one-shot install through this CLI.
