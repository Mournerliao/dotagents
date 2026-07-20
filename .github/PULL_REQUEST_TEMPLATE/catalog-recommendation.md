## Contribution type

- [ ] Catalog recommendation (`catalog-only`)

## Checklist

- [ ] Entry is recorded in `catalog/catalog.json` with `kind: "catalog-only"`.
- [ ] `upstream` is an https URL to the source (no source copied into this repo).
- [ ] `author`, `license` (or `unknown`), `compatibility`, `recommendation`, and `description` are filled in.
- [ ] Optional `compatibilityNotes` explain agent limits when needed.
- [ ] Recommendation context explains why this belongs in the curated catalog.
- [ ] `npm run ci` passes locally.

## Notes for reviewers

Describe why this recommendation is useful and any license or compatibility caveats.
