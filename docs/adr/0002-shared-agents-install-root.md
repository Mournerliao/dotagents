# Shared agents install root; Cursor is a consumer

Global skills install to `~/.agents/skills` (Codex layout). Cursor reads that directory. This library does not copy into `~/.cursor/skills`, does not add a Cursor write adapter, and delegated recipes must not pass `-a cursor` or a Cursor provider. `compatibility` means which agents can consume an entry, not which directories to duplicate into.

Personal layouts that symlink another git checkout into the install root stay out of band. They are not a catalog inclusion mode.

Maintained skills in this package (for example `commit`) are published snapshots of personal authoring. Sync them into this package's `skills/` directory on release; do not treat a live checkout and this package as two install sources.

## Considered options

- Add a Cursor adapter that copies into `~/.cursor/skills` — rejected; Cursor already consumes `~/.agents/skills`, and a second root makes same-name files diverge.
- Keep `-a cursor` / Cursor providers on delegated recipes — rejected; that is how the second root gets recreated.
- Add a catalog kind for git-symlink installs — rejected; a personal special case, not part of the library model.
