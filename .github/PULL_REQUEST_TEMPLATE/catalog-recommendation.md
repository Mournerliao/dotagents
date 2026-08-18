## Contribution type

- [ ] Catalog recommendation (`link-only`)

## Checklist

- [ ] Entry is recorded in `cli/catalog/catalog.json` with `kind: "link-only"`.
- [ ] `upstream` is an https URL to the source (no source copied into this repo).
- [ ] `author`, `license` (or `unknown`), `compatibility`, `recommendation`, and `description` are filled in.
- [ ] Optional `compatibilityNotes` explain agent limits when needed.
- [ ] Recommendation context explains why this belongs in the curated catalog.
- [ ] `npm run ci --prefix cli` passes locally.

## Notes for reviewers

Describe why this recommendation is useful and any license or compatibility caveats.
