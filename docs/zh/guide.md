# agent-skills 中文指南

个人能力库：把常用 skill（以及以后的其他能力类型）记进 catalog，通过 npm 同步到任意电脑，再按需安装 / 更新 / 卸载。人和 AI 使用同一套 CLI。

完整说明以仓库根目录英文 [README.md](../../README.md) 为准。

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
agent-skills list
agent-skills list --json

agent-skills install agent-skills --agent codex --scope global
agent-skills install commit --agent codex --scope project
agent-skills install mattpocock-skills --dry-run
agent-skills install impeccable --accept-permissions

agent-skills update commit --agent codex --scope project
agent-skills remove commit --agent codex --scope project

agent-skills record --entry-json '{"kind":"delegated", ...}'
agent-skills validate --catalog
```

- **maintained**：包内技能，按 `--agent` / `--scope` 安装。`--agent codex` 写到 `.agents/skills`；Cursor 读全局的 `~/.agents/skills`，不要再拷一份到 `~/.cursor/skills`。
- **delegated**：执行上游安装配方（如 `npx skills` / `npx impeccable`）；非交互需 `--accept-permissions`。配方只装进 Claude Code 和 Codex/agents，不带 Cursor 拷贝目标。
- **link-only**：仅链接，不能装。
- **不写**本机 lock；装没装过看安装根（全局即 `~/.agents/skills`）。
- `record` 只改 catalog，不安装。
- `compatibility` 表示装好之后谁能用，不是要往几个目录各拷一份。

领域词汇见根目录 [CONTEXT.md](../../CONTEXT.md)。
