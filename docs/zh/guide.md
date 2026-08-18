# @mournerliao/agent-skills 中文指南

个人能力库：把常用 skill 记进 catalog，通过 npm 同步到任意电脑，再按需安装 / 更新 / 卸载。人和 AI 使用同一套 CLI。

CLI 在 [dotagents](https://github.com/Mournerliao/dotagents) 仓库的 [`cli/`](../../cli/) 目录。完整说明以英文 [guide.md](../guide.md) 为准。

## 安装

```bash
npx @mournerliao/agent-skills list
# 或
npm install -g @mournerliao/agent-skills
agent-skills list
```

需要 Node.js 20+。

## 常用命令

```bash
npx @mournerliao/agent-skills list
npx @mournerliao/agent-skills list --json

npx @mournerliao/agent-skills install agent-skills --agent codex --scope global
npx @mournerliao/agent-skills install commit --agent codex --scope project
npx @mournerliao/agent-skills install mattpocock-skills --dry-run
npx @mournerliao/agent-skills install impeccable --accept-permissions

npx @mournerliao/agent-skills update commit --agent codex --scope project
npx @mournerliao/agent-skills remove commit --agent codex --scope project

npx @mournerliao/agent-skills record --entry-json '{"kind":"delegated", ...}'
npx @mournerliao/agent-skills validate --catalog
```

从 git checkout 改已发布 catalog 时，把 `--catalog` 指到 `cli/catalog/catalog.json`。

- **maintained**：包内技能，按 `--agent` / `--scope` 安装。`--agent codex` 写到 `.agents/skills`；Cursor 读全局的 `~/.agents/skills`，不要再拷一份到 `~/.cursor/skills`。
- **delegated**：执行上游安装配方（如 `npx skills` / `npx impeccable`）；非交互需 `--accept-permissions`。配方只装进 Claude Code 和 Codex/agents，不带 Cursor 拷贝目标。
- **link-only**：仅链接，不能装。
- **不写**本机 lock；装没装过看安装根（全局即 `~/.agents/skills`）。
- `record` 只改 catalog，不安装。
- `compatibility` 表示装好之后谁能用，不是要往几个目录各拷一份。

领域词汇见根目录 [CONTEXT.md](../../CONTEXT.md)。
