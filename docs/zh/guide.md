# agent-skills 中文指南

精简入口。完整说明以仓库根目录英文 [README.md](../../README.md) 为准。

## 安装

```bash
npx @mournerliao/agent-skills list --catalog
# 或
npm install -g @mournerliao/agent-skills
agent-skills list --catalog
```

需要 Node.js 20+。

## 支持的平台

首发仅支持 **Codex** 与 **Claude Code**。Cursor、WorkBuddy 为后续目标，当前不宣传为已支持。

## 常用命令

```bash
# 浏览随包附带的目录（maintained / catalog-only）
agent-skills list --catalog

# 交互安装（推荐）：选择 maintained 技能、agent=codex、scope=project
agent-skills add

# 非交互：安装本地 canonical 技能目录（仓库 clone 或包内 skills/ 路径）
agent-skills add /path/to/skill --agent codex --scope project

# 列出已安装、显式更新、移除
agent-skills list
agent-skills update <name>
agent-skills remove <name>

# 预览变更；敏感能力需确认或 --accept-permissions
agent-skills add /path/to/skill --agent codex --dry-run
agent-skills add /path/to/skill --agent codex --accept-permissions

# 校验技能或整份 catalog
agent-skills validate /path/to/skill
agent-skills validate --catalog
```

- **project** 为默认安装范围；**global** 用 `--scope global`。
- 安装会写入 `agent-skills.lock.json`（来源、版本、agent、scope、托管文件）。
- **不会**静默更新已安装技能；请使用显式 `update`。

## 信任边界

- `maintained`：本仓库可安装源（原创或有意维护的 fork）。
- `catalog-only`：仅推荐上游链接，默认不拷贝、不安装其源码。

贡献与策展规则见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。版本策略见 [versioning.md](../versioning.md)。

## 已知限制

- 不做静默/后台更新。
- 不评分模型行为或 prompt 质量。
- 不保证 catalog-only 第三方技能的兼容性。

发布说明见根目录 [CHANGELOG.md](../../CHANGELOG.md)。
