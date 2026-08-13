# Contributing

This repository is a personal-first capability library. Contributions
are welcome through pull requests, but the maintainer retains final curation
authority. Acceptance is not automatic.

## What we accept

1. **Delegated entry** — an install recipe that runs an upstream installer
   without copying its source into this repository.
2. **Maintained skill** — an original skill or an intentionally maintained fork
   hosted under `skills/` with canonical metadata.
3. **Link-only recommendation** — an upstream link without a recipe (rare;
   prefer delegated when an installer exists).
4. **CLI / docs fixes** — changes that improve the library model, validation,
   or documented trust boundary.

We do **not** accept unreviewed marketplace dumps, silent vendoring of third-party
skills, or contributions that blur link-only recommendations with installable
repository source.

## Curation criteria

- Clear usefulness for the maintainer's sync set (and compatible agents).
- Honest inclusion mode: `maintained` vs `delegated` vs `link-only`.
- Prefer **delegated** when a reliable upstream installer exists.
- Delegated recipes must not copy into `~/.cursor/skills` (`-a cursor`, `--providers=...cursor`, or an explicit Cursor skills path). Cursor consumes `~/.agents/skills`.
- Do not add an inclusion mode for symlinking another git checkout; that layout stays personal and out of band.
- Compatible license and attribution that can be preserved.
- Declared `capabilityKind` (`skill` now; `mcp` reserved).
- Provenance that makes ownership and divergence reviewable for maintained skills.

## Recording entries

Agents and humans use the same command:

```bash
agent-skills record --entry-json '<catalog-entry-object>'
```

## Validation

Before opening a pull request:

```bash
npm run ci
```

## Pull request templates

Use the templates under `.github/PULL_REQUEST_TEMPLATE/` when applicable.
