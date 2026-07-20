# Contributing

This repository is a personal-first curated skill distribution. Contributions
are welcome through pull requests, but the maintainer retains final curation
authority. Acceptance is not automatic.

## What we accept

1. **Catalog recommendation** — a `catalog-only` entry that links to an upstream
   skill without copying its source.
2. **Maintained skill** — an original skill or an intentionally maintained fork
   hosted under `skills/` with canonical metadata.
3. **CLI / adapter / docs fixes** — changes that improve installation, validation,
   or the documented trust boundary.

We do **not** accept unreviewed marketplace dumps, silent vendoring of third-party
skills, or contributions that blur catalog-only recommendations with installable
repository source.

## Curation criteria

- Clear usefulness for Codex and/or Claude Code users.
- Honest support status: `maintained` vs `catalog-only`.
- Compatible license and attribution that can be preserved.
- Declared compatibility, and sensitive capabilities when scripts or elevated
  permissions are involved.
- Provenance that makes ownership and divergence reviewable.

## Provenance

- **Original** skills declare `provenance.kind: "original"`.
- **Maintained forks** declare `provenance.kind: "maintained-fork"` with
  `upstream`, `baseline`, `reason`, `changes`, and `attribution`, plus an
  independent skill `version` and `license`.
- **Catalog-only** entries declare `upstream`, `author`, `license` (use
  `unknown` when not known), `compatibility`, optional `compatibilityNotes`,
  `recommendation`, and `description`. Do not copy upstream source into this
  repository for catalog-only entries.

## Licensing

Repository-level licensing does not override third-party licenses. Preserve
upstream license and attribution. Ambiguous ownership or missing licenses are
rejected.

## Compatibility and security review

- List supported agents under `compatibility`.
- Declare runtime, commands, dependencies, network, secrets, permissions,
  write locations, and bundled `resources` when relevant.
- Sensitive capabilities require permission review before install; keep
  declarations accurate so users can make an informed decision.

## Validation

Before opening a pull request:

```bash
npm run ci
```

CI rejects missing provenance, ambiguous ownership fields, missing licenses,
malformed https upstream URLs, and maintained catalog paths that do not resolve
locally. Tests use fixtures and do not depend on third-party network access.

## Pull request templates

Use the catalog recommendation template or the maintained skill template under
`.github/PULL_REQUEST_TEMPLATE/` so reviewers can see which contribution form
you intend.
