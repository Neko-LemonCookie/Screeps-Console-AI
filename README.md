# Screeps NewAGE AI

[English](#english) | [中文](#中文)

<a name="english"></a>
## English

### Overview
This repository contains the AI codebase for Screeps. The **Beta** branch is now the **official main branch**; the existing **main** branch is no longer being updated and is kept only as a historical reference.

All core modules have been **completely refactored** in the Beta branch. The new system features a **global decision AI** with RCL-graded strategies, automatic room claiming, dynamic task management, and full automation. **Currently in active development.**

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   main.js (Entry)                    │
│  memcleaner → decisionAI → taskhandler → autobuild   │
│                        ↓                             │
│              roleDispatcher → building modules        │
└─────────────────────────────────────────────────────┘

┌─ Decision Layer (AP.developv* / AP.claim / AP.fight) ─┐
│  Per-room RCL-graded strategy routing                 │
│  v1 (9x9 large room): L3 → L5 → L7 → max             │
│  v2 (5x5 small room):  L4 → L5 → max                │
│  Publishes Strategy tasks → Taskboard                 │
└───────────────────────────────────────────────────────┘

┌─ Integration Layer (AP.taskhandler) ─────────────────┐
│  Reads Strategy tasks → converts to Spawn tasks       │
│  bodySize string → numeric energy (_resolveEnergy)    │
│  Market action / Lab production forwarding            │
└───────────────────────────────────────────────────────┘

┌─ Execution Layer ────────────────────────────────────┐
│  Taskboard (Memory.Taskboard.Task)                    │
│    ├── Creeps[room]   – harvest/upgrade/build/carry.. │
│    ├── Buildings[room]– spawn/marketSell/produce...   │
│    └── Strategy[room]  – need_creeps/market_action..  │
│  Unibot: idle creeps auto-pick tasks by model type     │
│  RoleDispatcher: dispatch by taskType                  │
└───────────────────────────────────────────────────────┘

┌─ Base AI Layer (lib.AP.tempbuild / AP.autobuild) ────┐
│  Progressive road placement by RCL stage             │
│  Container → Link upgrade pipeline (RCL 5+)           │
│  Link auto-pairing (source-end ↔ receiver-end)        │
│  Harvester smart deposit (mining cycle continuation)   │
└───────────────────────────────────────────────────────┘

┌─ WASM Modules (Rust) ───────────────────────────────┐
│  calculate_claim – Room scoring for expansion         │
│  spawncreep     – Body template optimization          │
│  tempbuild      – Mining spot & city center calc      │
└───────────────────────────────────────────────────────┘
```

### Features (Beta branch)

#### Global Decision AI System
- **Strategy Router** (`AP.developv1`, `AP.developv2`): Maps current RCL to appropriate strategy file using explicit lookup tables. Supports two layout types:
  - **9x9 (large/core rooms)**: Full feature set with dual-link support, 6-Lab groups
  - **5x5 (small/satellite rooms)**: Compact layout, RCL 6 = max strategy
- **RCL-Graded Strategies**: Each layout has progressive strategy files tailored to unlocked buildings:
  - **L3/L4** (early): CommonI only, no Storage/Carrier, harvest-priority
  - **L5/L6** (mid): Storage online, CarrierI introduced at storageLevel > 10k
  - **L7** (late): Boost-enabled creeps, Terminal/Lab/Factory active
  - **max** (RCL8): All models active, expansion coordination, market selling
- **Claim Module** (`AP.claim`): GCL guard (min level 3), CPU usage cap (75%), new-room bootstrap first-market-order to initialize Terminal economy
- **Fight Module** (`AP.fight`): 4-level threat assessment (LOW/MEDIUM/HIGH/CRITICAL) with cooldown-gated defender deployment and emergency mode flags

#### Task System (`lib.AP.taskboard`)
Three-tier task categories stored in Memory:
- **Creeps[room]**: harvest, upgrade, build, repair, carry, attack, claim, reserve, globalcarry, boost, sign, police, claimupgrade, claimbuild
- **Buildings[room]**: spawn (4-param with data object), marketBuy, marketSell, produce, transport, automarket, nukeattack, linktransport, boost
- **Strategy[room]**: need_creeps (with bodySize/model/priority), market_action, lab_production; auto-cleanup after 500 ticks

#### Core Libraries (`lib.AP.*`)
- `search`: Efficient data queries with caching.
- `market`: Basic market operations (buy/sell/transport).
- `automarket`: Automatic arbitrage across rooms.
- `spawncreep`: Spawn creeps with pre-defined body templates.
- `tempbuild`: Auto-placement of 5x5/9x9 city center templates, progressive roads, Container/Link placement.
- `calculate_claim`: Room scoring for claiming decisions (**WASM-accelerated**).
- `taskHelper`: Task completion utilities for creep tasks.

#### Automation Modules (`AP.*`)
- `autobuild`: Infrastructure construction driver with Container→Link upgrade pipeline.
- `memcleaner`: Memory initialization (including Strategy namespace), dead creep cleanup, global cache refresh.
- `taskhandler`: Strategy-to-execution bridge. Converts need_creeps → spawn tasks with energy resolution (small=450, medium=700, large=850, max=roomCapacity).
- `roleDispatcher`: Dynamic task dispatching – creeps execute tasks based on assigned `taskType`.

#### Base AI Upgrades
- **Progressive Roads**: RCL 4 = source roads only, RCL 5 = +controller, RCL 6 = +mineral+storage, RCL 7+ = complete remaining paths. Hard cap of 20 concurrent road construction sites.
- **Link Integration**: Template-defined Link positions for both layouts. RCL 5+ triggers automatic Container destruction and Link pair creation (source-end near source, receiver-end near Storage within 10 tiles).
- **Link Auto-Pairing**: Automatic discovery and registration of unpaired links based on proximity classification.
- **Smart Harvesting**: Harvesters deposit into nearby Container/Link when available, then continue mining cycle (no return-to-base). CarrierI handles transport.

#### Creep Model System
| Model | Prefix | Body Size | Primary Tasks |
|-------|--------|-----------|---------------|
| CommonI | CM1 | small/medium/large/max | harvest, upgrade, build, repair, carry |
| CarrierI | CR1 | small/medium/large/max | carry, globalcarry |
| AttackerI | AT1 | medium/large/max | attack, police |
| ClaimerI | CL1 | large | claim, reserve, claimupgrade, claimbuild |

#### User Task Sender (`User.tasksender`)
Global console functions (`Game.tasksender`) for manual task creation, listing, and removal – useful for debugging and testing.

### Getting Started
1. Clone the repository and checkout the **Beta** branch.
2. Copy the code to your Screeps account.
3. The AI runs fully automatically – no manual intervention required.
4. For debugging, use `Game.tasksender` to inspect or modify tasks.

### Contributing
Feel free to open issues or pull requests. For major changes, please discuss them first.

---

<a name="中文"></a>
## 中文

### 概述
本仓库为 Screeps AI 代码库。**Beta** 分支现已成为 **正式主分支**；原有的 **main** 分支不再更新，仅作为历史参考保留。

所有核心模块已在 Beta 分支 **完全重构**。新系统具备 **全局决策AI**、RCL分级策略、自动占领房间、动态任务管理和全自动化功能。**目前正在积极开发中。**

### 架构总览

```
┌─────────────────────────────────────────────────────┐
│                   main.js (入口)                      │
│  memcleaner → 决策AI → taskhandler → autobuild        │
│                        ↓                             │
│              roleDispatcher → 建筑模块                 │
└─────────────────────────────────────────────────────┘

┌─ 决策层 (AP.developv* / AP.claim / AP.fight) ────────┐
│  每房间RCL分级策略路由                                  │
│  v1 (9x9大房间): L3 → L5 → L7 → max                   │
│  v2 (5x5小房间):  L4 → L5 → max                       │
│  发布Strategy任务 → Taskboard                          │
└───────────────────────────────────────────────────────┘

┌─ 集成层 (AP.taskhandler) ────────────────────────────┐
│  读取Strategy任务 → 转换为Spawn任务                     │
│  bodySize字符串 → 数值energy (_resolveEnergy)          │
│  市场操作 / Lab生产转发                                 │
└───────────────────────────────────────────────────────┘

┌─ 执行层 ────────────────────────────────────────────┐
│  Taskboard (Memory.Taskboard.Task)                    │
│    ├── Creeps[房间]   – harvest/upgrade/build/carry.. │
│    ├── Buildings[房间]– spawn/marketSell/produce...   │
│    └── Strategy[房间]  – need_creeps/market_action..  │
│  Unibot: 空闲creep按型号自动接单                         │
│  RoleDispatcher: 按taskType分发任务                     │
└───────────────────────────────────────────────────────┘

┌─ 基层AI (lib.AP.tempbuild / AP.autobuild) ──────────┐
│  按RCL阶段渐进式道路铺设                                │
│  Container→Link替换管线(RCL 5+)                        │
│  Link自动配对(源端↔接收端)                              │
│  收获者智能存容器(继续采矿循环)                           │
└───────────────────────────────────────────────────────┘

┌─ WASM模块 (Rust) ──────────────────────────────────┐
│  calculate_claim – 扩张房间评分                        │
│  spawncreep     – 身体模板优化                          │
│  tempbuild      – 采矿位与城市中心计算                   │
└───────────────────────────────────────────────────────┘
```

### 功能特性（Beta 分支）

#### 全局决策AI系统
- **策略路由器**（`AP.developv1`、`AP.developv2`）：通过显式映射表将当前RCL映射到对应策略文件。支持两种布局：
  - **9x9（大房间/核心房）**：完整功能集，双Link支持，6个Lab分组
  - **5x5（小房间/卫星房）**：紧凑布局，RCL 6即为max策略
- **RCL分级策略**：每种布局都有针对已解锁建筑的渐进式策略文件：
  - **L3/L4（前期）**：仅CommonI，无Storage/Carrier，优先采集
  - **L5/L6（中期）**：Storage上线，storageLevel > 10k时引入CarrierI
  - **L7（后期）**：启用Boost的Creep，Terminal/Lab/Factory全面运作
  - **max（RCL 8）**：全部模型激活，扩张协调，市场出售
- **占领模块**（`AP.claim`）：GCL守卫（最低等级3）、CPU使用率上限（75%）、新房间首单市场启动以初始化Terminal经济
- **战斗模块**（`AP.fight`）：4级威胁评估（LOW/MEDIUM/HIGH/CRITICAL），带冷却门的防御者部署和紧急模式标志

#### 任务系统（`lib.AP.taskboard`）
三层任务分类存储于Memory：
- **Creeps[房间]**：harvest、upgrade、build、repair、carry、attack、claim、reserve、globalcarry、boost、sign、police、claimupgrade、claimbuild
- **Buildings[房间]**：spawn（4参数含data对象）、marketBuy、marketSell、produce、transport、automarket、nukeattack、linktransport、boost
- **Strategy[房间]**：need_creeps（含bodySize/model/priority）、market_action、lab_production；500 tick后自动清理过期任务

#### 核心库（`lib.AP.*`）
- `search`：带缓存的高效数据查询。
- `market`：基础市场操作（买入/卖出/运输）。
- `automarket`：跨房间自动套利。
- `spawncreep`：使用预定义模板生成creep。
- `tempbuild`：自动放置5x5/9x9城市中心模板、渐进式道路、Container/Link布局。
- `calculate_claim`：占领决策房间评分（**WASM加速**）。
- `taskHelper`：Creep任务完成工具函数。

#### 自动化模块（`AP.*`）
- `autobuild`：基础设施建设驱动，含Container→Link升级管线。
- `memcleaner`：内存初始化（含Strategy命名空间）、死亡creep清理、全局缓存刷新。
- `taskhandler`：策略到执行的桥梁。将need_creeps转换为spawn任务并解析energy值（small=450、medium=700、large=850、max=房间容量上限）。
- `roleDispatcher`：动态任务分发 – creep根据分配的`taskType`执行相应任务。

#### 基层AI升级
- **渐进式道路**：RCL 4仅矿点路，RCL 5加Controller路，RCL 6加Mineral+Storage路，RCL 7+补完剩余路径。硬上限20个并发道路工地。
- **Link集成**：两种模板均预定义Link位置。RCL 5+触发自动销毁Container并创建Link对（源端靠近Source，接收端靠近Storage且不超过10格）。
- **Link自动配对**：基于距离分类自动发现并注册未配对的Link。
- **智能收获**：有附近Container/Link时Harvester存入后继续采矿循环（不回基地），由CarrierI负责运输。

#### Creep型号系统
| 型号 | 前缀 | 身体规格 | 主要任务 |
|------|------|----------|----------|
| CommonI | CM1 | small/medium/large/max | harvest, upgrade, build, repair, carry |
| CarrierI | CR1 | small/medium/large/max | carry, globalcarry |
| AttackerI | AT1 | medium/large/max | attack, police |
| ClaimerI | CL1 | large | claim, reserve, claimupgrade, claimbuild |

#### 用户任务发送器（`User.tasksender`）
一组全局控制台函数（`Game.tasksender`），用于手动创建、查看和删除任务，方便调试与测试。

### 快速开始
1. 克隆仓库并切换到 **Beta** 分支。
2. 将代码复制到你的 Screeps 账户。
3. AI 将全自动运行，无需人工干预。
4. 如需调试，可使用 `Game.tasksender` 查看或修改任务。

### 贡献
欢迎提交 issue 或 pull request。重大变更请事先讨论。
