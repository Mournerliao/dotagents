---
name: commit
description: Writes git commit messages that follow the current repository's conventions, with an English subject line and Chinese body for detail. Use when the user asks to commit, stage changes, write a commit message, create a git commit, or summarize staged/unstaged changes into commits.
---

# Commit

Write commits that match the **current repository's** format conventions. The message must be specific enough that someone can later scan the git log and reconstruct what work was done.

## Language (default)

| Part | Language |
|------|----------|
| Subject (`type(scope): …`) | **English** — imperative, lowercase start |
| Body | **Chinese** — bullets or short lines with what / where / why |

Subject is for `git log --oneline` scanning; body is for later work summaries in Chinese.

Override only when the repo explicitly requires full English or full Chinese (e.g. commitlint, CONTRIBUTING).

## Workflow

1. Inspect changes:
   - `git status`
   - `git diff --staged`
   - If nothing is staged, review `git diff`, then stage relevant files with `git add`
2. Detect repo conventions (see below) before drafting the message.
3. Decide whether changes belong in one commit or several logical commits.
4. Draft subject + body using the quality rules below.
5. Commit with a heredoc so quotes and newlines are safe:

```bash
git commit -m "$(cat <<'EOF'
subject line here

optional body here
EOF
)"
```

6. Let hooks run normally. Do not use `--no-verify` unless the user explicitly asks.

## Detect Repo Conventions

Check sources in this order:

1. `commitlint.config.*`, `.commitlintrc*`, `lefthook.yml`, `.husky/commit-msg`
2. `CONTRIBUTING.md`, `README.md`, or docs mentioning commit format
3. Recent history: `git log --oneline -20`

Apply what you find:

| Signal | Action |
|--------|--------|
| Conventional Commits enforced | Use `type(scope): subject` or `type: subject` per config |
| Scope required | Include scope |
| Scope optional / absent in history | Omit scope if it adds no clarity |
| Repo requires single language | Follow repo rule for both subject and body |
| No clear rule | Conventional Commits; scope optional; **English subject + Chinese body** |

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Infer scope from changed areas (package name, top-level folder, module) — do not hardcode project-specific paths.

## Message Quality

### Subject

- **English only** — including scope (e.g. `export`, not `导出`).
- State the **main outcome**, not the process ("add retry to payment API" not "update code").
- Imperative mood ("add", "fix", "remove"), lowercase start, no period at end.
- One logical change per commit header.
- Keep within repo limits; default max **72 chars** for subject if unspecified.

### Body — when required

Add a body when any of these apply:

- More than one file or concern touched
- Behavior, API, or UX changed
- Bug fix where root cause is not obvious from subject alone
- Refactor with non-obvious motivation
- Config / migration / dependency change with operational impact

Skip body only for trivial, self-explanatory edits (typo, single-line comment, format-only).

### Body — what to include

Write in **Chinese**. Use 1–4 short lines or bullets covering:

1. **What** changed (concrete behavior or artifact)
2. **Where** it applies (module, endpoint, screen, job)
3. **Why** if not obvious (bug symptom, perf goal, constraint)

Bad:

```
fix: fix bug

update files
```

Good:

```
fix(auth): prevent session expiry during long uploads

- 上传超过 access-token 有效期时自动刷新 token
- 影响 /api/upload 与移动端后台同步
- 修复传输中途被登出的问题（#482）
```

The goal: `git log` + message alone should support weekly/monthly work summaries without opening the diff.

## Type Selection

| Type | Use when |
|------|----------|
| `feat` | New capability or user-visible behavior |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no logic change |
| `refactor` | Structure change, same behavior |
| `perf` | Performance improvement |
| `test` | Tests only |
| `build` | Build tooling or dependencies |
| `ci` | CI/CD configuration |
| `chore` | Tooling, misc maintenance |
| `revert` | Reverts a prior commit |

## Multi-commit Strategy

If changes mix unrelated concerns (feature + unrelated chore), split:

1. Stage and commit the first logical unit
2. Repeat for remaining units
3. Each commit should be self-contained and meaningful on its own

Suggest splitting when the user would otherwise get a subject like "fix misc issues" or "update several files".

## Safety Rules

- Never commit secrets, `.env`, credentials, or private keys
- Do not stage unrelated local noise unless the user wants it
- Do not amend or force-push unless explicitly requested
- If commitlint/hooks fail, fix the message or code — do not bypass hooks

## Examples

**Default (English subject + Chinese body):**

```
feat(export): add CSV export with filter criteria

- 新增导出接口 /api/reports/export
- 前端报表页增加导出按钮与进度提示
```

```
feat(billing): add proration for mid-cycle plan upgrades

- 结账时按未使用天数计算抵扣金额
- 适用于 Stripe webhook 与后台预览
```

```
fix(search): escape special characters in query parser

- 修复搜索 "C++" 等含特殊字符时结果为空的问题
```

```
chore(deps): upgrade eslint to 9.x with flat config

- 统一各包的 flat config 写法
```

**No body needed (subject only):**

```
docs: fix typo in API authentication section
```

## Distribution

This skill is maintained in `@mournerliao/agent-skills`. Install or update with the CLI (Codex / Claude Code):

```bash
npx @mournerliao/agent-skills add
# or, after a global install:
agent-skills add
agent-skills update commit
```

Cursor is not yet a supported install target of this CLI; copy `skills/commit` into the Cursor skills directory manually if needed.
