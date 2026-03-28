# Screeps NewAGE AI

[English](#english) | [中文](#中文)

<a name="english"></a>
## English

### Overview
This repository contains the AI codebase for Screeps. The **main** branch is the **old system** – it is kept as a reference and inspiration for the rewrite. All core modules have been **completely refactored** in the **Beta** branch, which is currently under active development.

### Branches
- **main**: Legacy system. This branch is not actively maintained and serves only as a historical reference and inspiration for the new architecture.
- **Beta**: **Fully rewritten** AI. All modules have been redesigned from the ground up. The new system includes a complete decision-making layer, automatic room claiming, dynamic task management, and full automation. **Currently in active development.**

### New System Features (Beta branch)
The Beta branch provides a modern, modular architecture with the following components:

- **Task System** (`lib.AP.taskboard`): Define and manage creep and building tasks. Tasks are stored in memory and can be assigned automatically or manually.
- **Core Libraries** (`lib.AP.*`):
  - `search`: Efficient data queries with caching.
  - `market`: Basic market operations (buy/sell/transport).
  - `automarket`: Automatic arbitrage across rooms.
  - `spawncreep`: Spawn creeps with pre-defined body templates.
  - `tempbuild`: Automatically place city center templates and peripheral structures.
  - `calculate_claim`: Score rooms for claiming decisions.
- **Automation Modules** (`AP.*`):
  - `autobuild`: Drives infrastructure construction based on room level.
  - `memcleaner`: Manages memory and global data caching.
  - `roleDispatcher`: Dynamic task dispatching – creeps execute tasks based on their assigned `taskType`.
- **User Task Sender** (`User.tasksender`): A set of global console functions (`Game.tasksender`) to manually create, list, and remove tasks for debugging and testing.
- **Unibot Fallback**: Creeps without a task will automatically pick up suitable tasks from the board based on their body model.

All modules have been **completely refactored** compared to the old system. The API documentation below describes the new system (Beta branch). For details, see [API_GUIDE.md](./API_GUIDE.md).

### Getting Started (Beta branch)
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
本仓库为 Screeps AI 代码库。**main** 分支为 **旧版系统**，仅作为重构的参考和灵感来源。所有核心模块已在 **Beta** 分支 **完全重构**，目前正在积极开发中。

### 分支说明
- **main**：遗留系统。该分支不再主动维护，仅作为历史参考和架构灵感的来源。
- **Beta**：**完全重写**的 AI。所有模块均经过重新设计，包含完整的决策层、自动占领房间、动态任务管理和全自动化功能。**目前正在积极开发中。**

### 新版系统功能特性（Beta 分支）
Beta 分支采用现代化模块化架构，包含以下组件：

- **任务系统**（`lib.AP.taskboard`）：定义和管理 creep 与建筑任务。任务存储在内存中，可自动或手动指派。
- **核心库**（`lib.AP.*`）：
  - `search`：带缓存的高效数据查询。
  - `market`：基础市场操作（买入/卖出/运输）。
  - `automarket`：跨房间自动套利。
  - `spawncreep`：使用预定义模板生成 creep。
  - `tempbuild`：自动放置城市中心模板和外围建筑。
  - `calculate_claim`：对房间进行占领评分。
- **自动化模块**（`AP.*`）：
  - `autobuild`：根据房间等级驱动基础设施建设。
  - `memcleaner`：内存管理和全局数据缓存。
  - `roleDispatcher`：动态任务分发 – creep 根据其 `taskType` 执行相应任务。
- **用户任务发送器**（`User.tasksender`）：一组全局控制台函数（`Game.tasksender`），用于手动创建、查看和删除任务，方便调试与测试。
- **Unibot 接单**：未分配任务的 creep 会根据自身型号从任务看板中自动领取合适的任务。

所有模块相比旧系统均 **完全重构**。以下 API 文档描述的是新版系统（Beta 分支）。详细 API 文档请参阅 [API_GUIDE.md](./API_GUIDE.md)。

### 快速开始（Beta 分支）
1. 克隆仓库并切换到 **Beta** 分支。
2. 将代码复制到你的 Screeps 账户。
3. AI 将全自动运行，无需人工干预。
4. 如需调试，可使用 `Game.tasksender` 查看或修改任务。

### 贡献
欢迎提交 issue 或 pull request。重大变更请事先讨论。