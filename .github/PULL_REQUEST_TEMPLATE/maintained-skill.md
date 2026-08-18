## Contribution type

- [ ] Original maintained skill
- [ ] Maintained fork

## Checklist

- [ ] Skill lives under `cli/skills/<name>/` with `skill.json` and `SKILL.md`.
- [ ] Catalog entry in `cli/catalog/catalog.json` uses `kind: "maintained"` and a resolving relative `path`.
- [ ] `provenance.kind` is `original` or `maintained-fork`.
- [ ] For forks: `upstream`, `baseline`, `reason`, `changes`, and `attribution` are complete.
- [ ] Independent `version` and `license` are declared; third-party attribution is preserved.
- [ ] Compatibility and sensitive capabilities are declared when applicable.
- [ ] `npm run ci --prefix cli` passes locally.

## Notes for reviewers

Summarize the skill purpose, fork rationale (if any), and security-sensitive behavior.
