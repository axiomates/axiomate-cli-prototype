# Axiomate 架构改进计划（Scratchpad / 并发安全 / 压缩恢复）

本文件是对现有多个 plan/讨论内容的**合并版**，用于在仓库根目录统一追踪。

## 背景与目标（关键风险提示）

### 1) Scratchpad 可能变成第二个“上下文垃圾场”

如果不加约束，AI 很容易：
- `current-task` 写得越来越长
- `todo` 永远不清
- `notes` 变成 dump

原则：
- **让 Agent 主动维护它的 Scratchpad**（通过工具显式读写）。
- **不要让系统自动去总结并写入这些文件**（自动写入往往抓不住 AI 真正在意的重点；主动写入本身就是“推理对齐”过程）。

约束（强制 rewrite，不允许 append）：
- `current-task` ≤ 10 行
- `todo` 必须是 checklist（`- [ ]` / `- [x]`）
- 每次更新必须 **rewrite** 对应 section（不允许 append）

### 2) EventQueue + FSM = 并发 bug 温床

提前做三件事：
- **所有 event 带 correlationId**（用于追踪链路）
- **FSM transition 全部是纯函数**
- **UI 只能订阅“状态快照”**，不订阅中间事件

### 3) 可逆压缩的“恢复时机”要非常克制

- **不要自动 restore**
- 只能：
  - AI 明确请求（并且应经过用户确认/显式入口）
  - 或用户明确要求

否则会：
- 重新污染上下文
- 破坏 KV cache 稳定性

### 4) 安全执行策略：权限确认 > Docker 沙箱

**核心原则**：
- **权限确认系统是必须的**（Claude Code 风格，不增加用户门槛）
- **Docker 沙箱是可选的**（检测到就用，没有也能正常工作）
- **文件操作支持撤销**（比沙箱更实用）

**安全优先级**：
1. 权限确认（必须实现）← 核心安全
2. 操作回滚（推荐实现）← 容错
3. Docker 沙箱（可选实现）← 增强

**不强制 Docker 的原因**：
- 增加用户门槛（很多人不想装 Docker）
- CLI 工具应该开箱即用
- 权限确认 + 撤销机制已经足够安全

---

## 实施顺序

1. **Phase 1（Scratchpad 系统）**：先把“工作记忆”制度化，避免后续复杂度上来后失控
2. **Phase 4（权限确认系统）**：核心安全机制，必须优先实现
3. **Phase 3（压缩/恢复策略）**：把“不会自动 restore”的纪律固化为代码与测试
4. **Phase 2（EventQueue 并发安全）**：补全链路追踪与纯函数约束，降低 debug 成本
5. **Phase 5（可选 Docker 沙箱）**：增强功能，检测到 Docker 时提供沙箱执行

---

## Phase 1：Scratchpad 系统（工具驱动的主动维护）

### 1.1 新增两个“原子工具”（对模型呈现为两个 function）

实现方式：一个内置 tool `a-c-scratchpad` + 两个 action（对 OpenAI/Anthropic 来说等价于两个 atomic function）：
- `a-c-scratchpad_update(type, content)` ≈ `update_scratchpad(type: 'todo'|'task', content: string)`
- `a-c-scratchpad_read()` ≈ `read_scratchpad()`

**文件（新增）**
- `source/services/tools/discoverers/scratchpad.ts`
- `source/services/tools/handlers/scratchpadHandler.ts`

**存储位置**
- `${cwd}/.axiomate/scratchpad.md`

**文件格式（固定结构，便于强约束）**

```markdown
# Current Task
<task content, max 10 lines>

# Todo
- [ ] item 1
- [x] item 2
```

### 1.2 Handler 强制约束（失败就报错，不静默截断）

`__SCRATCHPAD_UPDATE__`：
- 只更新指定 section（`task` 或 `todo`），其他 section 原样保留
- **永远 rewrite 指定 section**（不 append、不 merge）
- 验证：
  - `task`: ≤ 10 行
  - `todo`: 每一行必须是 checklist（`- [ ]` 或 `- [x]` 开头）

`__SCRATCHPAD_READ__`：
- 返回完整文件内容（不存在则返回提示/空内容）

**重要：tool result 控制体积**
- `update` 的 tool result 必须极短（例如 `"OK"`），避免每轮把 scratchpad 内容复制进聊天历史导致二次污染
- `read` 才返回完整内容（但内容已通过行数/格式约束被限定）

实现可复用 `source/services/tools/fileOperations.ts`：
- `readFileContent()`
- `writeFileContent()`

### 1.3 注册与可用性（关键落地点）

**注册 discoverer（内置工具）**
- `source/services/tools/discoverers/index.ts`：把 `detectScratchpad` 加入 `builtinDiscoverers`

**注册 handler（注意：不是 handlers/index.ts）**
- `source/services/tools/executor.ts`：在 `commandHandler` 之前 `registerHandler(scratchpadHandler)`  
  （否则会被 fallback 吃掉）

**工具白名单**
- `source/constants/tools.ts`：把 `a-c-scratchpad` 加入 `ACTION_CORE_TOOLS`（建议：始终可用）

### 1.4 Plan Mode 下 Scratchpad 是否可用（建议：可用）

现状：Plan Mode 下（支持 `tool_choice` 的路径）会把 allowedTools 收敛为 `p-plan`，导致 scratchpad 不可用。

建议：Plan Mode 允许 `p-plan` + `a-c-scratchpad`（scratchpad 只写 `.axiomate/scratchpad.md`，不触碰代码/命令执行，符合“规划但不改代码”的语义）。

需要修改：
- `source/services/ai/service.ts`：Plan Mode 的 `toolMask.allowedTools` 包含 `p-plan` 与 `a-c-scratchpad`
- `source/services/ai/toolMask.ts`：planMode 分支同样包含 `a-c-scratchpad`
- `source/constants/prompts.ts`：更新 `PLAN_MODE_REMINDER` 的 ALLOWED/FORBIDDEN 列表，把 scratchpad 加入 ALLOWED

### 1.5 System Prompt 增加 Scratchpad 规则（只约束，不自动写）

文件：
- `source/constants/prompts.ts`

内容要点：
- 明确存在 scratchpad tools
- 强制 rewrite 规则、行数上限、todo checklist 格式
- 强调“系统不自动写入，只有 Agent 主动调用工具维护”

### 1.6 工具命名一致性审计（避免新旧不一致导致恢复/解析失败）

本项目工具对模型暴露的 function name 为：`${tool.id}_${action.name}`。

需要审计并统一：
- `source/hooks/useSessionManager.ts` 里对 tool call name 的硬编码匹配（应与真实 function name 一致；必要时兼容旧写法）

### 1.7 运行时文件忽略

确认 `.axiomate/` 已在 `.gitignore` 中；如未包含，补充忽略规则，避免把 scratchpad/session 等运行时文件提交进仓库。

---

## Phase 3：压缩/恢复策略（克制的 restore）

目标：**不引入自动 restore**；只保留显式入口（用户/AI 明确请求）。

### 3.1 现状复核

当前 `compact` 会生成 summary 并创建新 session，把 summary 写入新 session（`Session.compactWith()`），并保存旧 session（可通过 session 切换显式回到旧 session）。  
没有看到“自动 restore”逻辑 —— 这点要保持。

### 3.2 计划改动（不做时间锁，不改通用 restoreSession 语义）

不建议在 `restoreSession()` 里做“5 分钟禁止恢复”一类时间锁（容易阻断合法操作：重启/切换 session 等）。

建议用两种方式固化纪律：
- **注释 + 测试**：明确禁止新增“自动 restore”路径
- **显式入口**（可选）：如果未来要“恢复压缩前对话”，做成用户命令/工具，且需要用户确认；不要后台自动触发

---

## Phase 2：EventQueue + FSM 并发安全（debug 友好）

### 2.1 correlationId（建议以 message.id 为主）

`MessageQueue` 已经为每条消息生成 `msg_<counter>_<timestamp>` 形式的 `id`，并把它作为各类 stream 回调的首参传递。  
建议把它**提升为统一的 correlationId 概念**（命名、日志、结构体字段一致），而不是无意义新增重复字段。

如仍需显式字段：
- `QueuedMessage` 添加 `correlationId`（默认等于 `id`），并在所有回调/日志透传

### 2.2 FSM transition 纯函数

审计并保证：
- `source/components/AutocompleteInput/reducer.ts` 所有 transition 不产生副作用
- 副作用只能发生在 reducer 外（hook/handler 层）

### 2.3 UI 只订阅状态快照

保持现有模式：
- UI 只基于 state/messages 渲染
- 不让组件直接订阅“中间事件对象”，避免并发下状态穿透

---

## 工作清单（可直接执行）

### Phase 1（Scratchpad）
- [ ] 新增 `source/services/tools/discoverers/scratchpad.ts`（builtin tool）
- [ ] 新增 `source/services/tools/handlers/scratchpadHandler.ts`（读写 + 强约束 + update 返回短串）
- [ ] `source/services/tools/discoverers/index.ts`：注册 `detectScratchpad`
- [ ] `source/services/tools/executor.ts`：注册 `scratchpadHandler`（放在 `commandHandler` 前）
- [ ] `source/constants/tools.ts`：把 `a-c-scratchpad` 加入 `ACTION_CORE_TOOLS`
- [ ] Plan Mode 允许 scratchpad（更新 `service.ts` / `toolMask.ts` / `prompts.ts` 的 reminder）
- [ ] `source/constants/prompts.ts`：加入 Scratchpad 规则（rewrite、行数、checklist、禁止自动写）
- [ ] 工具命名一致性审计：修复/兼容 `useSessionManager.ts` 里对 tool call name 的匹配
- [ ] `.gitignore`：确认忽略 `.axiomate/`

### Phase 3（压缩/恢复）
- [ ] 删除“时间锁 restore”类设计（保持 restore 语义纯粹）
- [ ] 加测试/注释：禁止自动 restore；只允许显式入口
- [ ]（可选）增加显式 restore 命令/工具（带用户确认）

### Phase 2（并发安全）
- [ ] 统一 correlationId 概念（优先复用 message.id；必要时添加字段并透传）
- [ ] 审计 `editorReducer` 等 FSM transition 纯函数性
- [ ] 确保 UI 只基于状态快照渲染（不订阅中间事件）

### Phase 4（权限确认系统 - 核心安全）

**目标**：实现 Claude Code 风格的权限确认，不强制 Docker，开箱即用。

#### 4.1 权限管理器

**文件（新增）**：
- `source/services/permissions/PermissionManager.ts`
- `source/services/permissions/types.ts`

**权限策略**：
- **文件读取**：自动允许（无需确认）
- **文件写入**：首次确认，同类操作自动（会话级缓存）
- **命令执行**：配置白名单，匹配则自动，否则确认
- **敏感操作**：总是确认（删除、force push、数据库操作等）

**权限配置结构**：
```typescript
type PermissionConfig = {
  fileWrite: 'always_allow' | 'first_confirm' | 'always_confirm';
  fileDelete: 'always_confirm';
  commands: {
    allowedPatterns: string[];  // e.g., ['npm *', 'git status']
    blockedPatterns: string[];  // e.g., ['rm -rf *']
    defaultBehavior: 'confirm' | 'deny';
  };
  sessionApprovals: Set<string>;  // 已确认的操作类型
};
```

#### 4.2 风险评估器

**文件（新增）**：
- `source/services/permissions/RiskAssessor.ts`

**风险等级**：
- `safe`：直接执行（如 `git status`、`npm install`）
- `moderate`：需要确认（如文件写入、`git push`）
- `dangerous`：总是确认（如 `rm -rf`、`git push --force`）

**危险模式匹配**：
```typescript
const dangerousPatterns = [
  /rm\s+-rf/,
  /git\s+push.*--force/,
  /drop\s+database/i,
  /delete\s+from.*where\s+1/i,
];
```

#### 4.3 确认 UI 组件

**文件（修改）**：
- `source/components/ConfirmationDialog.tsx`（新增）
- `source/components/AskUserMenu.tsx`（复用或扩展）

**交互流程**：
1. 工具调用触发风险评估
2. 需要确认时，暂停执行，显示确认对话框
3. 用户选择：允许 / 拒绝 / 允许所有同类操作
4. 记录到会话级权限缓存

#### 4.4 集成到工具执行流程

**文件（修改）**：
- `source/services/tools/executor.ts`：在执行前调用权限检查
- `source/services/ai/tool-call-handler.ts`：集成权限管理器

**执行流程**：
```
工具调用 → 风险评估 → 权限检查 → 需要确认？
                                    ├─ 是 → 显示确认 UI → 用户选择 → 执行/拒绝
                                    └─ 否 → 直接执行
```

#### 4.5 文件操作撤销支持

**文件（新增）**：
- `source/services/undo/UndoManager.ts`

**功能**：
- 文件写入前自动备份（`.axiomate/backups/`）
- 支持 `/undo` 命令撤销最近操作
- 限制备份数量（避免磁盘占用）

**工作清单**：
- [ ] 新增 `PermissionManager.ts`（权限配置 + 会话缓存）
- [ ] 新增 `RiskAssessor.ts`（风险评估逻辑）
- [ ] 新增 `ConfirmationDialog.tsx`（确认 UI）
- [ ] 修改 `executor.ts`：集成权限检查
- [ ] 修改 `tool-call-handler.ts`：调用权限管理器
- [ ] 新增 `UndoManager.ts`（文件备份 + 撤销）
- [ ] `source/constants/prompts.ts`：添加权限确认说明
- [ ] 测试：各种操作类型的权限流程

### Phase 5（可选 Docker 沙箱 - 增强功能）

**目标**：检测到 Docker 时提供沙箱执行选项，没有 Docker 也能正常工作。

#### 5.1 Docker 检测与降级

**文件（新增）**：
- `source/services/sandbox/DockerSandbox.ts`
- `source/services/sandbox/ConfirmationSandbox.ts`（降级方案）
- `source/services/sandbox/index.ts`（工厂方法）

**策略**：
```typescript
async function createSandbox(): Promise<Sandbox> {
  const dockerAvailable = await isDockerAvailable();
  return dockerAvailable 
    ? new DockerSandbox() 
    : new ConfirmationSandbox();  // 降级到确认模式
}
```

#### 5.2 Docker 沙箱实现（轻量级）

**功能**：
- 启动临时容器（alpine 基础镜像）
- 挂载工作区目录（`-v workspace:/workspace`）
- 执行命令并捕获结果
- 自动清理（`--rm` 标志）

**使用场景**：
- 高风险命令（如 `rm -rf`、`npm publish`）
- 用户明确要求沙箱执行
- 预览模式（执行但不提交）

#### 5.3 预览-确认-提交模式

**文件（新增）**：
- `source/services/sandbox/PreviewSandbox.ts`

**流程**：
1. 在沙箱中执行命令
2. 获取文件变更 diff
3. 显示预览给用户
4. 用户确认后提交到真实环境

**工作清单**：
- [ ] 新增 `DockerSandbox.ts`（容器管理 + 命令执行）
- [ ] 新增 `ConfirmationSandbox.ts`（降级方案）
- [ ] 新增 `PreviewSandbox.ts`（预览模式）
- [ ] 修改 `RiskAssessor.ts`：高风险操作建议使用沙箱
- [ ] 修改 `executor.ts`：可选沙箱执行路径
- [ ] 测试：Docker 可用/不可用两种场景

