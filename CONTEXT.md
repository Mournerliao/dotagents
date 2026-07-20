# Domain context

## Glossary

| Term | Meaning |
|------|---------|
| Maintained skill | An original or intentionally maintained skill hosted in this repository as installable canonical source. |
| Catalog-only entry | An external recommendation recorded as a link to its upstream source; not copied or installed by this repository. |
| Catalog | The curated list that mixes maintained skills and catalog-only recommendations with an explicit support status for each entry. |
| Support status | Either `maintained` (installable from this repository) or `catalog-only` (upstream link only). |
| Interactive add | CLI flow that prompts for a maintained skill, target agent, and installation scope, then installs without a positional source path. |
| Managed installation | A skill install recorded in `agent-skills.lock.json` with source, version, agent, scope, and installer-owned files. |
| Explicit update | A non-silent `update` that revises managed files and lock state only after an explicit command (optional `--dry-run` / `--force`). |
| Update status | List column for a managed installation: `up-to-date`, `update-available:<version>`, `source-version:<version>`, or `source-unavailable`. |
