# Screeps NewAGE API 指南

## 1. 任务系统 (lib.AP.taskboard)

任务存储在 `Memory.Taskboard.Task` 下，分为 `Creeps` 和 `Buildings` 两类。

### 1.1 核心 API

- `init()`: 初始化内存结构。
- `removeTask(roomName, category, type)`: 删除指定房间的某类任务。

### 1.2 Creep 任务 (taskboard.creeps)

| 方法 | 参数 | 说明 |
| :--- | :--- | :--- |
| `harvest` | `roomName, sourceId, targetId` | 采集任务。targetId 可为建筑 ID 或 'base'/'ground'。 |
| `upgrade` | `roomName, targetId` | 升级控制器任务。targetId 为能量来源。 |
| `build` | `roomName, targetId` | 建造任务。targetId 为能量来源。 |
| `repair` | `roomName, targetId` | 维修任务。targetId 为能量来源。 |
| `carry` | `roomName, fromId, toId, resourceType` | 运输任务。 |
| `attack` | `roomName, targetRoomName` | 攻击任务。 |
| `police` | `roomName, posOrAuto` | 巡逻/守卫任务。 |
| `sign` | `roomName, targetRoomName, signText` | 签名任务。 |
| `claim` | `roomName, targetRoomName` | 占领控制器任务。 |
| `reserve` | `roomName, targetRoomName` | 预订控制器任务。 |
| `claimupgrade` | `roomName, targetRoomName, sourceId` | 远程占领并升级。 |
| `claimbuild` | `roomName, targetRoomName, sourceId` | 远程占领并建造。 |
| `globalcarry` | `roomName, fromRoom, toRoom, fromId, toId, resourceType` | 跨房间运输。 |
| `boost` | `roomName, labId, bodyPart` | 强化任务。bodyPart 为大写，如 'WORK'。 |

### 1.3 建筑任务 (taskboard.buildings)

| 方法 | 参数 | 说明 |
| :--- | :--- | :--- |
| `produce` | `roomName, resourceType` | Factory 生产任务。 |
| `transport` | `roomName, fromRoom, toRoom, resourceType, amount` | 终端/物流传输。 |
| `marketBuy` | `roomName, resourceType, amount` | 市场购买。 |
| `marketSell` | `roomName, resourceType, amount, useOrder` | 市场售卖 (useOrder: true 为挂单)。 |
| `automarket` | `roomName` | 自动市场管理 (包含自动套利)。 |
| `nukeattack` | `roomName, targetRoomName` | 核弹攻击。 |
| `spawn` | `roomName, model, energy` | 孵化管理。model 为部件型号，energy 为分配能量。 |
| `linktransport`| `roomName` | Link 网络传输。 |
| `boost` | `roomName, bodyPart` | Lab 强化任务。每个反应 Lab 组同时只能领取一个匹配资源的任务，takenBy 会被标记为该 Lab ID。 |

---

## 2. 核心库 (lib.AP.*)

### 2.1 数据查询库 (lib.AP.search)

该模块负责提供全系统的数据查询 API，分为直接查询 (fetch) 和缓存读取 (get) 两套 API。

- **fetch (由 memcleaner 调用)**:
  - `gcl()`, `rcl(roomName)`, `allCreepCounts()`, `structures(roomName)`, `sources(roomName)`, `minerals(roomName)`, `constructionSites(roomName)`。
- **get (由其他业务模块调用)**:
  - `gcl()`: 获取全局 GCL。
  - `rcl(roomName)`: 获取房间等级。
  - `creepCount(roomName, taskType)`: 获取特定任务类型的 Creep 数量。
  - `structure(roomName, type)`: 获取建筑 ID (数组或单个)。
  - `sources(roomName)`, `minerals(roomName)`, `constructionSites(roomName)`: 获取资源 ID 和建筑工地 ID。
- **其他直接查询 (由业务模块直接调用)**:
  - `labGroup(roomName)`: 查找 LAB 组，返回 `[{ inputLabs: Lab[], outputLabs: Lab[] }, ...]` 或 `null`。9x9 房间返回两组，5x5 房间返回一组。

### 2.2 市场基础库 (lib.AP.market)

该模块负责提供基础市场操作 API：买入、卖出（含挂单）、跨房间运输。

- `marketBuy(roomName, resourceType, amount)`: 立即从市场以最低价买入。
- `marketSell(roomName, resourceType, amount, useOrder)`: 
  - `useOrder = false`: 立即以最高买单价成交。
  - `useOrder = true`: 以市场 **中间价** 创建卖单挂单。
- `transport(fromRoom, toRoom, resourceType, amount)`: 跨房间 Terminal 资源运输。

### 2.3 自动市场套利 (lib.AP.automarket)

该模块提供自动寻找全服差价并进行中转套利的功能。

- `run(roomName)`: 启动纯自动套利循环。
  - **逻辑**：优先处理 Terminal 内已有的套利库存；若无库存且冷却结束，则扫描全服寻找利润最高的差价资源并买入。
  - **性能**：内置扫描频率节流与全局缓存，无需手动干预。

### 2.4 Creep 生成配置 (lib.AP.spawncreep)

该模块负责计算和提供不同任务类型的 Creep 部件列表，并执行生成操作。

- `spawn(spawn, model, energy)`: 执行生成。
  - **参数**：型号 (`'CommonI'`, `'CarrierI'`, `'AttackerI'`, `'ClaimerI'`)，可用能量。
  - **特点**：生成时不指定 `role`，但会在内存初始化 `taskType: null`，从而触发调度器自动回退至 `unibot` 进行接单。
- `calcBodyCost(body)`: 计算指定部件列表的总能量消耗。
- `getCommonIBody(energy)`: 获取 CommonI 型（通用型）部件列表。
- `getCarrierIBody(energy)`: 获取 CarrierI 型（运输型）部件列表。
- `getAttackerI(energy)`: 获取 AttackerI 型（攻击型）部件列表。
- `getClaimerIBody(energy)`: 获取 ClaimerI 型（占领型）部件列表。

### 2.4 城市基建库 (lib.AP.tempbuild)

该模块负责房间城市中心的自动寻找、建筑模板管理以及工地的自动放置。支持 **5x5 (普通房)** 和 **9x9 (主/核心房)** 两种布局。

- `getMiningSpots(objId)`: 计算指定对象（Source/Controller）周围 1 格内的可用位置。
- `findCityCenter(roomName, size)`: 在房间内搜索最佳城市中心。
  - **优先级 1**：如果房间内有 spawn，根据 spawn 位置反向计算城市中心
    - 5x5 模板：spawn 在 (2, -2)，城市中心 = (spawnX - 2, spawnY + 2)
    - 9x9 模板：spawn 在 (0, -1)，城市中心 = (spawnX, spawnY + 1)
  - **优先级 2**：如果没有 spawn 或无法反向计算，使用算法计算（考虑地形、资源距离、沼泽比例等）
- `runCityCenter(roomName)`: 运行城市中心模板生成逻辑（默认使用 9x9 核心房间布局）。
- `runOuterStructures(roomName)`: 运行城市外围生成逻辑，包括容器、外部道路和防御围墙。

### 2.5 占领价值评分 (lib.AP.calculate_claim)

该模块负责对目标房间进行综合评分，辅助占领决策。

- `getScore(roomName)`: 获取房间占领综合得分。
  - **评分维度**：
    - **矿源**：新矿种 +5，稀有矿 +10，能与现有矿种合成（如 U+O）+20。
    - **布局**：能放下 9x9 模板 +10，能放下 5x5 模板 +5，都放不下 -999（排除）。
    - **地形**：根据自然墙和沼泽的比例进行阶梯加减分。
    - **资源分布**：每有一个能量源 +5；两源距离 <20 +10，>30 -5。
    - **便利性**：任一能量源距离控制器 <15 格则 +15。
  - **排除项**：无控制器、已被非 NPC 占领或预定（Invader 除外）的房间直接返回 -999。

## 3. AP 自动化控制模块 (AP.*)

### 3.1 自动建筑控制 (AP.autobuild)
该模块负责驱动房间的整体基建进程。

- **逻辑流**：
  1. **模板基建**：持续检查并放置城市中心模板内的建筑。
  2. **外围建设 (RCL 4 触发)**：一次性计算并放置通往控制器、资源点的道路、外围容器及防御围墙。
     - *改进*：计算道路起点时，会包含模板中规划但尚未建造的道路位置。
  3. **提取器 (RCL 6 触发)**：在矿源位置自动建造 Extractor。
  4. **外围修复**：记录城市范围外的道路、容器、围墙及城墙的位置与类型。
     - *优化*：若检测到建筑缺失，直接根据内存记录在原位放置对应类型的工地，不再重新调用 `tempbuild` 进行路径与缺口计算，大幅节省 CPU。
  5. **防御检查**：定期检查出口围墙的完整性，确保缺口（Rampart）和围墙持续存在。

### 3.1 内存与系统管理 (AP.memcleaner)

系统每 tick 的运行起点，按顺序执行以下任务：
1. **内存初始化**：统一初始化 `Taskboard`, `AutoMarket`, `SpawnCreep` 等模块的内存结构。
2. **失效内存清理**：清理死去 Creep 的内存，重置任务看板中已死亡领取者的标记。
3. **全局数据拉取**：调用 `lib.AP.search.fetch` 将全系统高耗能查询结果存入 `global.SearchCache`。

### 3.2 任务调度器 (module.roleDispatcher)

系统不再基于固定的角色名进行硬编码调度，而是根据 Creep 内存中分配的任务类型，动态调用对应的 `task.creep.*` 模块。

---

## 4. 用户任务发送器 (User.tasksender)

用户任务发送器提供全局函数用于手动发布任务，主要用于调试和测试底层模块。

### 全局对象
- `Game.tasksender`: 通过 Screeps 控制台访问任务发送器

### 可用方法

| 方法 | 参数 | 说明 |
| :--- | :--- | :--- |
| `creepTask(roomName, taskType, data)` | 房间名, 任务类型, 任务数据 | 发布 Creep 任务 |
| `buildingTask(roomName, taskType, data)` | 房间名, 任务类型, 任务数据 | 发布 Building 任务 |
| `removeTask(roomName, category, typeOrIndex)` | 房间名, 类别, 类型或索引 | 删除任务 |
| `listTasks(roomName, category)` | 房间名, 类别 | 查看任务列表 |
| `clearTasks(roomName, category)` | 房间名, 类别 | 清空任务 |
| `help()` | 无 | 显示帮助信息 |

### 支持的 Creep 任务类型
`harvest`, `upgrade`, `build`, `repair`, `carry`, `attack`, `police`, `sign`, `claim`, `reserve`, `claimupgrade`, `claimbuild`, `globalcarry`, `boost`

### 支持的 Building 任务类型
`produce`, `transport`, `marketBuy`, `marketSell`, `automarket`, `nukeattack`, `spawn`, `linktransport`, `boost`

### 使用示例

```javascript
// 查看帮助
Game.tasksender.help();

// 发布 Creep 任务
Game.tasksender.creepTask('W1N1', 'harvest', { sourceId: 'sourceId', targetId: 'base' });
Game.tasksender.creepTask('W1N1', 'carry', { fromId: 'storageId', toId: 'terminalId', resourceType: RESOURCE_ENERGY });

// 发布 Building 任务
Game.tasksender.buildingTask('W1N1', 'spawn', { model: 'CommonI', energy: 300 });
Game.tasksender.buildingTask('W1N1', 'marketBuy', { resourceType: 'U', amount: 10000 });

// 查看任务
Game.tasksender.listTasks('W1N1', 'all');

// 删除任务
Game.tasksender.removeTask('W1N1', 'Creeps', 0);

// 清空任务
Game.tasksender.clearTasks('W1N1', 'all');
```

---

## 5. Unibot 接单规则 (creep.unibot)

当 Creep 没有分配任务时（`taskType: null`），会由 `unibot` 模块根据其 **模型 (Model)** 从 `Taskboard` 中领受任务。

#### 模型限制与优先级
- **CommonI**: 
  - **支持**: `harvest`, `repair`, `build`, `upgrade`, `claimupgrade`, `claimbuild`, `sign`, `carry`, `globalcarry`
  - **优先级**: `harvest` > `repair` > `build` > `upgrade` > `sign` > `carry`
- **CarrierI**:
  - **支持**: `carry`, `globalcarry`, `sign`
  - **优先级**: `carry` > `globalcarry` > `sign`
- **AttackerI**:
  - **支持**: `police`, `sign`, `attack`
  - **优先级**: `police` > `sign` > `attack`
- **ClaimerI**:
  - **支持**: `claim`, `reserve`, `sign`
  - **优先级**: `claim` > `reserve` > `sign`

#### 接单逻辑
1. **内存锁定**：任务一旦被领取，会在 Taskboard 内存中标记 `takenBy: creepName`，防止重复领取。
2. **时间优先**：在同一优先级下，优先领取 `createdTime` 最早的任务。
3. **回退机制**：无任务可接时，Creep 保持待命状态。

---

## 4. 模块引用 (module.references)

通过 `require('module.references')` 可以访问所有系统模块，包括 `AP.*`, `lib.*`, `task.*` 和 `building.*`。
