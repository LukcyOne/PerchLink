## Project

**PerchLink**

PerchLink 是一款面向个人使用的 AI 增强书签管理工具，产品形态为 Tauri 桌面客户端加 Web 管理界面的双端组合。桌面端强调本地优先、离线可用与系统集成，Web 端提供随时访问的远程管理入口，两端通过可选同步能力共享同一套核心数据与交互体验。

**Core Value:** 用户必须能够在桌面端本地优先地稳定保存、整理和搜索书签，并在开启同步后可靠地把这份个人知识收藏收敛到多端一致状态。

### Constraints

- **Product Scope**: 单用户多设备 - 架构与数据模型都必须围绕个人使用场景设计，避免提前引入多租户复杂度
- **Platform**: Tauri + Web 双端共用前端 - 页面层不得把浏览器端与桌面端能力耦死在组件内部
- **Data Architecture**: Local-first + Server Sequencing - 桌面端先写本地 SQLite，服务端负责权威版本号、事件序列与冲突裁决
- **Security**: 敏感密钥默认不同步 - API Key、Access Token 等不得进入普通业务同步链路
- **Internationalization**: 默认 `zh-CN`，支持 `en-US` - 核心系统文案需要双语覆盖，缺失翻译回退中文
- **UX Reference**: `frontend_demo/` 仅作设计参考 - 正式代码需要沉淀共享组件、状态流与平台适配层
- **Performance**: 本地列表加载目标 < 500ms，常见筛选无明显卡顿 - 影响数据访问和状态管理选型
- **Deployment**: 远程 API + Web 需要支持 VPS/Docker 部署，桌面端需要支持 Windows/macOS/Linux 打包分发

## Technology Stack

### Recommended Stack

#### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.2 | Shared UI runtime for Web and Tauri | React 19 is current on react.dev, pairs well with Vite, and gives a strong ecosystem for desktop-like settings screens and list-heavy interfaces |
| Vite | current major on vite.dev | Shared frontend build tool for Web and Tauri | Fast iteration, clean TypeScript support, and strong compatibility with modern React-based monorepos |
| Tauri | 2.x | Desktop shell, native integration, packaging | Official Tauri 2 docs position it as the cross-platform native shell for existing web stacks, which matches the PRD exactly |
| TypeScript | 5.x | Shared types, SDK contracts, repository interfaces | The project needs one type system across UI, sync payloads, and API schemas |
| Fastify | 5.4.x | Remote API and sync service | Fastify 5 is current in official docs and is a strong fit for typed REST endpoints, validation, and SSE-style lightweight services |
| SQLite | 3.x | Local desktop database and optionally remote single-user storage | Matches the PRD's local-first design and keeps desktop persistence simple and portable |
| PostgreSQL | 16+ optional | Remote database upgrade path | Useful if remote sync/event volume or operational needs outgrow remote SQLite |

#### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.x | Server-state fetching, caching, mutation flows | Use for Web/API-facing flows, sync status polling, and remote invalidation patterns |
| Zustand | 5.x | Lightweight client state and UI/session state | Use for view state, filters, local settings panes, and composing repository-backed actions |
| Zod | 3.x or latest stable | Shared schema validation | Use for request validation, sync payload guards, and parsing non-trusted AI/provider config inputs |
| Drizzle ORM | latest stable | Typed schema and migrations for remote Node services | Use on the API side if you want a TS-first schema layer over SQLite/Postgres |
| i18next | latest stable | Shared i18n runtime | Use for shared language keys, interpolation, and locale switching across Web and Tauri |
| Vitest | current major | Unit/integration test runner for shared TS packages | Use for core business logic, parsers, repositories, and sync reducer-style tests |
| Playwright | current major | End-to-end testing for Web and core flows | Use for high-value UI flows such as add bookmark, search, sync center, and settings |

## Workflow

### GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.

## Architecture

Architecture details are currently tracked in `.planning/research/ARCHITECTURE.md`, `.planning/PROJECT.md`, and `.planning/ROADMAP.md`. Follow the shared-package, platform-adapter, and server-authoritative sync boundaries documented there until codebase-specific conventions emerge.
