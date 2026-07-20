## Contribution type

- [ ] Original maintained skill
- [ ] Maintained fork

## Checklist

- [ ] Skill lives under `skills/<name>/` with `skill.json` and `SKILL.md`.
- [ ] Catalog entry uses `kind: "maintained"` and a resolving relative `path`.
- [ ] `provenance.kind` is `original` or `maintained-fork`.
- [ ] For forks: `upstream`, `baseline`, `reason`, `changes`, and `attribution` are complete.
- [ ] Independent `version` and `license` are declared; third-party attribution is preserved.
- [ ] Compatibility and sensitive capabilities are declared when applicable.
- [ ] `npm run ci` passes locally.

## Notes for reviewers

Summarize the skill purpose, fork rationale (if any), and security-sensitive behavior.
