# Chrono WebNext

ChronoFork 历史模拟控制台（Next.js App Router 实现）。

## 技术栈

- Next.js 16
- React 19 + TypeScript
- Tailwind CSS v4
- Radix UI / shadcn 风格组件
- Framer Motion
- WebSocket（实时消息驱动）

## 快速开始

1. 安装依赖

```bash
pnpm install
```

2. 启动开发环境

```bash
pnpm dev
```

3. 生产构建与启动

```bash
pnpm build
pnpm start
```

4. 类型检查

```bash
pnpm exec tsc --noEmit
```

## 项目结构（当前）

```text
app/
  page.tsx                         # 主控制台入口
  episodes/ help/ settings/ ...    # 其他页面

src/features/chronofork/
  index.ts                         # Feature 聚合导出
  components/                      # ChronoFork 业务 UI
  state/                           # reducer + context + types
  api/                             # WebSocket 与 API 适配
  mock/                            # 本地 mock 数据
  config/                          # feature 配置（env）
  theme.tsx
  phaseColor.ts

components/ui/                     # 通用 UI 组件（共享层）
hooks/                             # 共享 hooks
lib/                               # 共享工具
public/                            # 静态资源
```

## 分层约束

1. `app/*` 只做页面组合，不放业务状态机/传输逻辑。
2. ChronoFork 域逻辑统一在 `src/features/chronofork/*`。
3. 共享层（`components/ui`、`hooks`、`lib`）不反向依赖 `@features/*`。

当前别名见 `tsconfig.json`：

- `@/* -> ./*`
- `@chrono/* -> ./src/*`
- `@features/* -> ./src/features/*`

## 核心运行逻辑

1. `app/page.tsx` 挂载 `ThemeProvider + ChronoForkProvider`。
2. `ChronoForkProvider` 通过 reducer 管理全局状态，并注入 WebSocket 能力。
3. `CenterStage` 触发关键动作（开始观察、回溯、发送消息、请求策略、请求报告）。
4. `useWebSocket` 接收服务端消息并派发到 reducer。
5. `FlowHeader / TimeRiverDock / TacticalHUDDock` 根据状态渲染 UI。

## 主要开发命令

- 开发：`pnpm dev`
- 构建：`pnpm build`
- 启动：`pnpm start`
- 类型检查：`pnpm exec tsc --noEmit`
- Lint（脚本已配置）：`pnpm lint`

## 注意事项

1. 当前 `package.json` 已有 `lint` 脚本，但若本地未安装 `eslint` 会执行失败；可补充安装 ESLint 后再使用。
2. `tsconfig.tsbuildinfo` 已加入 `.gitignore`，无需提交。
3. 详细分层说明见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
