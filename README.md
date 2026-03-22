# WeChat Agent Connector

[English](./README.en.md)

一个面向 agent CLI 的开源微信接入网关。

这个仓库把腾讯 OpenClaw 微信插件里的通用能力拆成了一个独立连接器：常驻 gateway 负责接收微信消息，再把消息转给本地 agent CLI，并把结果回发到微信。

当前已经支持：

- 微信扫码登录
- 长轮询收消息
- 文本消息回复
- Codex 和 Claude Code 原生 adapter
- 自定义 CLI 的 shell-json adapter
- 按微信用户维度做 CLI session resume
- 按项目目录运行原生 CLI，让它们使用目标项目自己的默认规则
- 面向 Codex / Claude Code 风格环境的 Skill 包装
- macOS `launchd` 开机自启、崩溃自动拉起和状态检查

近期计划：

- 媒体消息能力
- MCP 控制面
- 更多 adapter
- Linux / Windows 的服务管理

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
- 首次运行时探测本机支持的 CLI 并要求选择
- 绑定当前项目目录
- 检查是否已经连接微信
- 未连接时自动发起扫码登录
- 未启动时自动把 gateway 拉起到后台
- 在 macOS 上安装或刷新 `launchd` 服务，确保自动重启

如果你更想直接走 CLI，也可以：

```bash
bash scripts/bootstrap.sh
node packages/gateway/dist/cli.js ensure --config ./wechat-agent.config.json
```

你在哪个目录里运行 `ensure`，那个目录默认就会成为 `projectDir`。原生 `codex` / `claude-code` adapter 会在这个目录里执行，因此会直接继承那个项目自己的规则文件和默认行为。如果要指定别的项目目录，可以传 `--project-dir /absolute/path/to/project`，或者设置 `WECHAT_AGENT_PROJECT_DIR`。

## Adapter 模型

gateway 通过 adapter protocol 调用本地 CLI，当前内置类型包括：

- `codex`
- `claude-code`
- `opencode`
- `shell-json`

第一次运行 `ensure` 时，会自动探测本机支持的 CLI，并把选择结果写入 `wechat-agent.config.json`。

当前行为：

- `codex` 走 `codex exec` 和 `codex exec resume`
- `claude-code` 走 `claude -p` 和 `claude --resume`
- `shell-json` 适配自定义 JSON CLI

原生 `codex` 和 `claude-code` adapter 不会注入自定义系统提示词，只会把微信消息作为用户输入传进去，剩下的行为交给目标项目自己的 CLI 默认配置和仓库内说明文件。

gateway 会按 `accountId + userId` 保存本地 CLI session id，所以同一个微信用户连续发消息时，会尽量恢复到同一个原生 CLI 会话。

## 运行模型

这套连接器分两层：

- Skill：给 Codex / Claude Code 这种环境用的操作入口
- Gateway：常驻进程，负责轮询微信并调用选中的 CLI

在 macOS 上，`start` 和 `ensure` 会通过 `launchd` 管理 gateway，这样可以得到：

- 登录后自动启动
- 进程崩溃后自动重启
- 通过 `doctor` 和 `status` 查看服务级状态

当前服务管理只适配 macOS。gateway 主体逻辑本身不依赖 macOS，但 Linux / Windows 还没有各自的 service manager 实现。

如果是自定义 CLI，则 `shell-json` 的协议是：

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

仓库自带 [skills/wechat-agent](./skills/wechat-agent) Skill。它负责操作层：

- 检查安装状态
- 检测并配置当前本地 CLI
- 需要时完成微信登录
- 需要时启动 gateway
- 绑定到目标项目目录
- 展示运行状态和服务状态

发起扫码登录时，连接器会同时：

- 在终端打印二维码
- 打印二维码 URL
- 生成带真实二维码的临时本地辅助 HTML 页面
- 在 macOS 上自动用浏览器打开这个辅助页
- 在成功、超时或退出时删除这个临时文件

## 文档

- [Architecture](./docs/ARCHITECTURE.md)
- [Roadmap](./docs/ROADMAP.md)
- [Contributing](./CONTRIBUTING.md)

## 状态

当前还是 `0.x` 阶段，接口可能继续演进，但核心目标已经很明确：稳定跑通“微信 -> gateway -> 当前 CLI -> 微信”这条链路。
