# CLAUDE.md

Claude Code 开发指南。保持精简，只记录架构和入口，细节查代码。

## 项目概述

axiomate - 基于 React 19 + Ink 6 的终端 AI 助手。

**技术栈**: React 19, Ink 6, TypeScript 5.7, Node.js >= 20, Vitest

## 常用命令

```bash
npm run build      # 编译
npm run dev        # 开发模式
npm start          # 运行
npm test           # 测试
npm run package    # 打包可执行文件 (需要 Bun)
```

## 目录结构

```
assets/
└── model-presets.json         # 模型配置模板（构建时生成 TS）
scripts/
└── gen-meta.ts                # 构建脚本（生成 meta.ts 和 modelPresets.ts）
source/
├── cli.tsx                    # 入口
├── app.tsx                    # 主组件，状态管理中心
├── components/
│   ├── AutocompleteInput/     # 输入组件（模式、键盘、菜单）
│   ├── AskUserMenu.tsx        # AI 询问用户 UI
│   ├── StaticMessage.tsx      # 已完成消息显示（进入终端原生滚动区）
│   ├── StreamingMessage.tsx   # 流式消息显示
│   └── StatusBar.tsx          # 状态栏（含脉动点工作指示器）
├── models/                    # 数据模型（InputInstance, UserInput）
├── constants/
│   ├── commands.ts            # 斜杠命令定义
│   ├── models.ts              # 默认模型配置
│   ├── meta.ts                # 自动生成（版本信息）
│   └── modelPresets.ts        # 自动生成（从 assets/model-presets.json）
├── services/
│   ├── commandHandler.ts      # 命令处理
│   ├── ai/                    # AI 服务（会话、流式、工具调用）
│   └── tools/                 # 工具系统
│       ├── discoverers/       # 工具发现器（每个工具一个文件）
│       └── executor.ts        # 工具执行
├── i18n/                      # 国际化 (en, zh-CN, ja)
└── utils/
    └── config.ts              # 用户配置 (~/.axiomate.json)
```

## 关键模块入口

| 功能 | 入口文件 |
|------|---------|
| 键盘处理 | `AutocompleteInput/hooks/useInputHandler.ts` |
| UI 模式切换 | `AutocompleteInput/reducer.ts` |
| 斜杠命令 | `constants/commands.ts` + `services/commandHandler.ts` |
| AI 会话 | `services/ai/service.ts` |
| 工具发现 | `services/tools/discoverers/index.ts` |
| 配置加载 | `utils/config.ts` |
| 消息渲染 | `components/StaticMessage.tsx` + `components/StreamingMessage.tsx` |

## 消息渲染架构

使用 Ink 的 `<Static>` 组件实现原生终端滚动：

- **已完成消息** → `StaticMessage` → 进入终端原生滚动区域
- **流式消息** → `StreamingMessage` → 显示在交互区域

布局结构：
```
<Static> 已完成消息（终端原生滚动）
<Box>
  StreamingMessage（当前流式消息）
  Divider
  AutocompleteInput（输入框）
  Divider
  StatusBar（状态栏）
</Box>
```

## 配置文件

| 文件 | 用途 |
|------|------|
| `~/.axiomate.json` | 用户配置（模型、API） |
| `.env.local` | 开发环境变量（API keys，不提交） |
| `.env.local.example` | 环境变量模板 |
| `assets/model-presets.json` | 模型配置 JSON 模板（使用 `{{API_KEY}}` 占位符） |

## 构建流程

`npm run build` → prebuild 钩子 → `scripts/gen-meta.ts`：
1. 读取 `assets/model-presets.json`
2. 从 `.env.local` 读取 API keys
3. 替换占位符 `{{SILICONFLOW_API_KEY}}` 等
4. 生成 `source/constants/modelPresets.ts`

## 添加新功能

### 添加斜杠命令

1. `constants/commands.ts` - 添加命令定义
2. `services/commandHandler.ts` - 添加处理器

### 添加工具

1. `services/tools/discoverers/` - 创建发现器
2. `services/tools/discoverers/index.ts` - 注册

### 添加模型

编辑 `assets/model-presets.json`，使用占位符格式：
```json
{
  "model": "provider/model-name",
  "apiKey": "{{YOUR_API_KEY_NAME}}"
}
```

### 添加 i18n 文本

`i18n/locales/*.json` - 三个语言文件都要加

## Plan Mode

两种模式：**Plan Mode**（只读规划）和 **Action Mode**（完整执行）。

### 模式切换

| 方式 | 命令/工具 | 生效时机 |
|------|----------|---------|
| 用户手动 | `/plan on`, `/plan off` | 下一条消息 |
| AI 调用 | `plan_enter_mode`, `plan_exit_mode` | 立即生效 |

### 工作流程

1. AI 调用 `plan_enter_mode` → 切换到 Plan Mode（只有 plan 工具）
2. AI 使用 `plan_write` 创建计划到 `.axiomate/plans/plan.md`
3. AI 调用 `plan_exit_mode` → 切换回 Action Mode（所有工具）
4. AI 执行计划，用 `plan_edit` 标记完成：`- [ ]` → `- [x]`

### 关键实现

| 功能 | 文件 |
|------|------|
| Plan 工具定义 | `services/tools/discoverers/plan.ts` |
| 模式切换执行 | `services/tools/executor.ts` |
| 动态工具刷新 | `services/ai/service.ts` (streamChatWithTools) |
| System Prompt | `constants/prompts.ts` |
| 状态存储 | `utils/config.ts` (planModeEnabled) |

## 代码规范

- 用户可见文本必须用 i18n `t()` 函数
- 类型定义放 `models/` 或 `types/`
- 跨平台路径用 `constants/platform.ts` 的 `PATH_SEPARATOR`
