# WeChat Agent Connector

[English](./README.en.md)

## 发给 AI 的安装提示词

把下面这段完整发给 Claude Code、Codex 或其他支持终端操作的 AI 即可：

```text
请帮我从零开始安装并初始化这个仓库里的 wechat-agent skill，让“当前目录”作为微信 agent 的工作目录。

仓库地址：
https://github.com/zhangtyzzz/wechat-agent-connector

严格要求：
1. 把“当前目录”的绝对路径记为 TARGET_PROJECT_DIR。
2. 不要使用 TARGET_PROJECT_DIR 的上级目录。
3. connector 仓库必须 clone 到 `TARGET_PROJECT_DIR/wechat-agent-connector`。
4. 如果 `TARGET_PROJECT_DIR/wechat-agent-connector` 不存在，就 clone 到这个精确路径；如果已存在就直接复用，不要改用别的路径。
5. 在 `TARGET_PROJECT_DIR/wechat-agent-connector` 目录运行：
   `bash scripts/install-skill.sh`
6. 然后在 `TARGET_PROJECT_DIR/wechat-agent-connector` 目录运行：
   `WECHAT_AGENT_PROJECT_DIR="$TARGET_PROJECT_DIR" bash ~/.codex/skills/wechat-agent/scripts/ensure.sh`
7. 不要依赖命令之间的 shell 工作目录延续；每一步都必须在正确目录里明确执行。
8. 如果初始化过程中需要微信登录，就自动进入扫码流程。
9. 初始化完成后，汇报这些结果：
   - skill 是否已安装
   - gateway 是否已运行
   - 微信是否已连接
   - 当前 adapter 是什么
   - 当前绑定的 projectDir 是什么
10. 不要自行修改仓库，不要手工改 plist，不要发明新的安装流程；直接使用仓库现有脚本。
11. 除非遇到真正阻塞的问题，否则不要停下来问我。
```

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
