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

agent-skills install commit --agent codex --scope project
agent-skills install mattpocock-skills --dry-run
agent-skills install impeccable --accept-permissions

agent-skills update commit --agent codex --scope project
agent-skills remove commit --agent codex --scope project

agent-skills record --entry-json '{"kind":"delegated", ...}'
agent-skills validate --catalog
```

- **maintained**：包内技能，按 `--agent` / `--scope` 安装。
- **delegated**：执行上游安装配方（如 `npx skills` / `npx impeccable`）；非交互需 `--accept-permissions`。
- **link-only**：仅链接，不能装。
- **不写**本机 lock；装没装过由环境判断。
- `record` 只改 catalog，不安装。

领域词汇见根目录 [CONTEXT.md](../../CONTEXT.md)。
