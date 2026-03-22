# WeChat Agent Connector

一个面向 agent CLI 的开源微信接入网关。

这个项目会把腾讯 OpenClaw 微信插件里可复用的“微信协议层”抽出来，改造成一个通用连接器：由常驻 gateway 接收微信消息，再把消息转给任意本地 agent CLI。

当前 MVP 已覆盖：

- 微信扫码登录
- 长轮询收消息
- 文本消息回复
- 本地 shell adapter
- 面向 Codex / Claude Code 风格环境的 Skill 包装

后续计划：

- 媒体消息能力
- MCP 控制面
- 更多 adapter
- 更完整的守护与会话管理

## 目录结构

```text
packages/
  gateway/       gateway 进程与 shell adapter
  weixin-core/   微信协议、登录、轮询、状态存储
skills/
  wechat-agent/  Skill 与辅助脚本
config/
  wechat-agent.example.json
```

## 快速开始

```bash
bash scripts/install-skill.sh
```

Skill 安装完成后，推荐直接运行：

```bash
bash ~/.codex/skills/wechat-agent/scripts/ensure.sh
```

`ensure.sh` 会自动：

- 安装依赖
- 构建仓库
- 缺省时创建 `wechat-agent.config.json`
- 检查是否已经连接微信
- 未连接时自动发起扫码登录
- 未启动时自动把 gateway 拉起到后台

如果你想直接走 CLI，也可以：

```bash
bash scripts/bootstrap.sh
node packages/gateway/dist/cli.js ensure --config ./wechat-agent.config.json
```

shell adapter 默认要求目标 CLI：

- 从 stdin 读取一条 JSON 事件
- 从 stdout 输出一条 JSON 回复

输入示例：

```json
{
  "accountId": "wx-bot-1",
  "userId": "alice@im.wechat",
  "text": "hello",
  "contextToken": "..."
}
```

输出示例：

```json
{
  "text": "hi from my agent"
}
```

## Skill

仓库自带 [skills/wechat-agent](./skills/wechat-agent) Skill。Skill 负责操作层：

- 检查安装状态
- 需要时完成微信登录
- 需要时启动 gateway
- 说明如何绑定当前 CLI

## 文档

- [架构说明](./docs/ARCHITECTURE.md)
- [路线图](./docs/ROADMAP.md)
- [参与贡献](./CONTRIBUTING.md)

## 状态

当前还是 `0.x` 阶段，接口可能会调整，但目标是尽快把“微信 -> gateway -> 当前 CLI -> 微信”的闭环稳定下来。
