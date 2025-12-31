# axiomate

终端 AI 助手，支持流式响应、多文件上下文、会话管理。

## 快速开始

```bash
cp .env.local.example .env.local  # 配置 API
npm install
npm run build
npm start
```

首次启动会显示欢迎界面，可直接使用内置测试 API。

### 打包可执行文件

```bash
npm run package  # 需要 Bun
```

## 主要功能

- **流式响应** - 实时显示 AI 回复
- **多文件选择** - `@` 选择文件附加到消息
- **会话管理** - 多会话、自动保存
- **自动压缩** - 上下文满时自动总结
- **思考模式** - 支持 DeepSeek-R1、QwQ 等推理模型
- **工具调用** - AI 可使用本地工具（Git、Node.js 等）
- **多语言** - 英文、中文、日文

## 基本操作

| 按键         | 功能               |
| ------------ | ------------------ |
| `/`          | 打开命令菜单       |
| `@`          | 选择文件           |
| `?`          | 帮助（输入为空时） |
| `Tab`        | 接受建议           |
| `Shift+↑/↓`  | 切换输入/浏览模式  |
| `Ctrl+Enter` | 换行               |

## 斜杠命令

| 命令          | 功能         |
| ------------- | ------------ |
| `/model`      | 切换模型     |
| `/thinking`   | 开关思考模式 |
| `/plan`       | 开关规划模式 |
| `/session`    | 会话管理     |
| `/compact`    | 压缩上下文   |
| `/tools`      | 工具管理     |
| `/suggestion` | 输入建议设置 |
| `/language`   | 切换语言     |

## Plan Mode

规划模式用于复杂任务的分步执行。

- **Plan Mode** - 只读规划，AI 只能使用 plan 工具创建/编辑计划
- **Action Mode** - 完整执行，AI 可使用所有工具

### 使用方式

1. 用户手动：`/plan on` / `/plan off`
2. AI 自动：请求 AI "创建计划并执行"，AI 会自动切换模式

### 工作流程

1. AI 进入 Plan Mode，创建计划到 `.axiomate/plans/plan.md`
2. AI 退出 Plan Mode，执行计划中的每个步骤
3. AI 标记已完成步骤：`- [ ]` → `- [x]`

## 配置

- `~/.axiomate.json` - 模型和 API 配置
- `~/.axiomate/` - 日志和会话数据

## 开发

```bash
npm run dev        # 开发模式
npm test           # 测试
npm run lint:fix   # 修复代码风格
```

## 技术栈

React 19, Ink 6, TypeScript, Node.js >= 20
