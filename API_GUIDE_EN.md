# Screeps NewAGE API Guide

## 1. Task System (lib.AP.taskboard)

Tasks are stored under `Memory.Taskboard.Task`, divided into `Creeps` and `Buildings`.

### 1.1 Core API

- `init()`: Initialize memory structure.
- `removeTask(roomName, category, type)`: Remove a task of a certain category from a room.

### 1.2 Creep Tasks (taskboard.creeps)

| Method | Parameters | Description |
| :--- | :--- | :--- |
| `harvest` | `roomName, sourceId, targetId` | Harvest task. targetId can be a structure ID or 'base'/'ground'. |
| `upgrade` | `roomName, targetId` | Upgrade controller task. targetId is the energy source. |
| `build` | `roomName, targetId` | Build task. targetId is the energy source. |
| `repair` | `roomName, targetId` | Repair task. targetId is the energy source. |
| `carry` | `roomName, fromId, toId, resourceType` | Transport task. |
| `attack` | `roomName, targetRoomName` | Attack task. |
| `police` | `roomName, posOrAuto` | Patrol/guard task. |
| `sign` | `roomName, targetRoomName, signText` | Sign task. |
| `claim` | `roomName, targetRoomName` | Claim controller task. |
| `reserve` | `roomName, targetRoomName` | Reserve controller task. |
| `claimupgrade` | `roomName, targetRoomName, sourceId` | Remote claim and upgrade. |
| `claimbuild` | `roomName, targetRoomName, sourceId` | Remote claim and build. |
| `globalcarry` | `roomName, fromRoom, toRoom, fromId, toId, resourceType` | Cross‑room transport. |
| `boost` | `roomName, labId, bodyPart` | Boost task. bodyPart is uppercase, e.g. 'WORK'. |

### 1.3 Building Tasks (taskboard.buildings)

| Method | Parameters | Description |
| :--- | :--- | :--- |
| `produce` | `roomName, resourceType` | Factory production task. |
| `transport` | `roomName, fromRoom, toRoom, resourceType, amount` | Terminal / logistics transfer. |
| `marketBuy` | `roomName, resourceType, amount` | Market buy. |
| `marketSell` | `roomName, resourceType, amount, useOrder` | Market sell (useOrder: true for order). |
| `automarket` | `roomName` | Automatic market management (includes automatic arbitrage). |
| `nukeattack` | `roomName, targetRoomName` | Nuke attack. |
| `spawn` | `roomName, model, energy` | Spawn management. model is the body part set, energy is allocated energy. |
| `linktransport`| `roomName` | Link network transport. |
| `boost` | `roomName, bodyPart` | Lab boost task. Each lab reaction group can only claim one task with matching resources at a time; takenBy will be marked with the lab ID. |

---

## 2. Core Libraries (lib.AP.*)

### 2.1 Data Query Library (lib.AP.search)

This module provides system‑wide data query APIs, divided into two sets: direct query (fetch) and cached read (get).

- **fetch (called by memcleaner)**:
  - `gcl()`, `rcl(roomName)`, `allCreepCounts()`, `structures(roomName)`, `sources(roomName)`, `minerals(roomName)`, `constructionSites(roomName)`.
- **get (called by other business modules)**:
  - `gcl()`: Get global GCL.
  - `rcl(roomName)`: Get room level.
  - `creepCount(roomName, taskType)`: Get number of creeps for a specific task type.
  - `structure(roomName, type)`: Get structure ID (array or single).
  - `sources(roomName)`, `minerals(roomName)`, `constructionSites(roomName)`: Get resource IDs and construction site IDs.
- **Other direct queries (called directly by business modules)**:
  - `labGroup(roomName)`: Find lab groups, returns `[{ inputLabs: Lab[], outputLabs: Lab[] }, ...]` or `null`. 9x9 rooms return two groups, 5x5 rooms return one group.

### 2.2 Market Base Library (lib.AP.market)

This module provides basic market operation APIs: buy, sell (including orders), and cross‑room transport.

- `marketBuy(roomName, resourceType, amount)`: Instantly buy from the market at the lowest price.
- `marketSell(roomName, resourceType, amount, useOrder)`:
  - `useOrder = false`: Instantly sell at the highest buy order price.
  - `useOrder = true`: Create a sell order at the market **mid price**.
- `transport(fromRoom, toRoom, resourceType, amount)`: Cross‑room terminal resource transport.

### 2.3 Automatic Market Arbitrage (lib.AP.automarket)

This module automatically finds price differences across the server and performs arbitrage.

- `run(roomName)`: Start the fully automatic arbitrage loop.
  - **Logic**: Prioritizes arbitrage using existing inventory in the terminal; if no inventory and the cooldown is over, it scans the server for the most profitable price difference and buys.
  - **Performance**: Built‑in scanning throttling and global caching – no manual intervention required.

### 2.4 Creep Spawn Configuration (lib.AP.spawncreep)

This module calculates and provides body part lists for different task types, and performs spawn operations.

- `spawn(spawn, model, energy)`: Perform spawn.
  - **Parameters**: model (`'CommonI'`, `'CarrierI'`, `'AttackerI'`, `'ClaimerI'`), available energy.
  - **Feature**: Does not assign a `role` during spawn, but initialises memory with `taskType: null`, which triggers the dispatcher to automatically fall back to `unibot` to claim tasks.
- `calcBodyCost(body)`: Calculate the total energy cost of a given body part list.
- `getCommonIBody(energy)`: Get body part list for CommonI (general purpose) type.
- `getCarrierIBody(energy)`: Get body part list for CarrierI (transport) type.
- `getAttackerI(energy)`: Get body part list for AttackerI (attack) type.
- `getClaimerIBody(energy)`: Get body part list for ClaimerI (claim) type.

### 2.5 City Infrastructure Library (lib.AP.tempbuild)

This module is responsible for automatically finding a city centre, managing building templates, and automatically placing construction sites. Supports **5x5 (normal room)** and **9x9 (primary/core room)** layouts.

- `getMiningSpots(objId)`: Calculate available positions within one tile around the given object (Source/Controller).
- `findCityCenter(roomName, size)`: Search for the best city centre in a room.
  - **Priority 1**: If there is a spawn in the room, calculate the city centre based on the spawn’s position
    - 5x5 template: spawn at (2, -2), city centre = (spawnX - 2, spawnY + 2)
    - 9x9 template: spawn at (0, -1), city centre = (spawnX, spawnY + 1)
  - **Priority 2**: If no spawn or reverse calculation is impossible, use an algorithm (considers terrain, resource distance, swamp ratio, etc.)
- `runCityCenter(roomName)`: Run the city centre template generation logic (defaults to 9x9 core room layout).
- `runOuterStructures(roomName)`: Run the city periphery generation logic, including containers, external roads, and defensive walls.

### 2.6 Claim Value Scoring (lib.AP.calculate_claim)

This module provides a comprehensive score for target rooms to assist claim decisions.

- `getScore(roomName)`: Get the total claim score for a room.
  - **Scoring dimensions**:
    - **Minerals**: New mineral type +5, rare mineral +10, synergy with existing minerals (e.g., U+O) +20.
    - **Layout**: Can fit a 9x9 template +10, can fit a 5x5 template +5, can fit neither –999 (excluded).
    - **Terrain**: Stepwise addition/subtraction based on natural wall and swamp ratios.
    - **Resource distribution**: +5 per energy source; distance between two sources <20 +10, >30 -5.
    - **Convenience**: Any energy source within <15 tiles of the controller +15.
  - **Exclusions**: Rooms without a controller, already claimed or reserved by non‑NPC players (except Invaders) return –999 directly.

## 3. AP Automation Control Modules (AP.*)

### 3.1 Automatic Building Control (AP.autobuild)
This module drives the overall infrastructure construction of a room.

- **Logic Flow**:
  1. **Template Construction**: Continuously checks and places buildings within the city centre template.
  2. **Periphery Construction (triggered at RCL 4)**: One‑time calculation and placement of roads to the controller, energy sources, peripheral containers, and defensive walls.
     - *Improvement*: When calculating road start points, it also includes road positions planned in the template but not yet built.
  3. **Extractor (triggered at RCL 6)**: Automatically builds an Extractor at the mineral deposit.
  4. **Periphery Repair**: Records the positions and types of roads, containers, walls, and ramparts outside the city centre.
     - *Optimisation*: If a structure is found missing, it directly places a construction site of the corresponding type at the original position based on memory records, without recalculating paths and gaps with `tempbuild`, significantly saving CPU.
  5. **Defense Check**: Periodically checks the integrity of exit walls to ensure ramparts and walls remain present.

### 3.2 Memory & System Management (AP.memcleaner)

The system’s entry point every tick, executes the following tasks in order:
1. **Memory Initialisation**: Initialises memory structures for modules like `Taskboard`, `AutoMarket`, `SpawnCreep`, etc.
2. **Invalid Memory Cleanup**: Clears memory of dead creeps, resets taskboard claims from dead claimants.
3. **Global Data Fetch**: Calls `lib.AP.search.fetch` to store high‑cost system‑wide query results in `global.SearchCache`.

### 3.3 Task Dispatcher (module.roleDispatcher)

The system no longer uses hard‑coded scheduling based on fixed roles; instead, it dynamically calls the corresponding `task.creep.*` module according to the task type assigned in the creep’s memory.

---

## 4. User Task Sender (User.tasksender)

The user task sender provides global functions to manually publish tasks, mainly used for debugging and testing underlying modules.

### Global Object
- `Game.tasksender`: Access the task sender via the Screeps console.

### Available Methods

| Method | Parameters | Description |
| :--- | :--- | :--- |
| `creepTask(roomName, taskType, data)` | room name, task type, task data | Publish a creep task. |
| `buildingTask(roomName, taskType, data)` | room name, task type, task data | Publish a building task. |
| `removeTask(roomName, category, typeOrIndex)` | room name, category, type or index | Remove a task. |
| `listTasks(roomName, category)` | room name, category | List tasks. |
| `clearTasks(roomName, category)` | room name, category | Clear tasks. |
| `help()` | none | Show help. |

### Supported Creep Task Types
`harvest`, `upgrade`, `build`, `repair`, `carry`, `attack`, `police`, `sign`, `claim`, `reserve`, `claimupgrade`, `claimbuild`, `globalcarry`, `boost`

### Supported Building Task Types
`produce`, `transport`, `marketBuy`, `marketSell`, `automarket`, `nukeattack`, `spawn`, `linktransport`, `boost`

### Usage Examples

```javascript
// Show help
Game.tasksender.help();

// Publish a creep task
Game.tasksender.creepTask('W1N1', 'harvest', { sourceId: 'sourceId', targetId: 'base' });
Game.tasksender.creepTask('W1N1', 'carry', { fromId: 'storageId', toId: 'terminalId', resourceType: RESOURCE_ENERGY });

// Publish a building task
Game.tasksender.buildingTask('W1N1', 'spawn', { model: 'CommonI', energy: 300 });
Game.tasksender.buildingTask('W1N1', 'marketBuy', { resourceType: 'U', amount: 10000 });

// List tasks
Game.tasksender.listTasks('W1N1', 'all');

// Remove a task
Game.tasksender.removeTask('W1N1', 'Creeps', 0);

// Clear tasks
Game.tasksender.clearTasks('W1N1', 'all');
```

---

## 5. Unibot Task Claiming Rules (creep.unibot)

When a creep has no assigned task (`taskType: null`), the `unibot` module will claim a task from the `Taskboard` based on its **model**.

#### Model Restrictions & Priorities
- **CommonI**:
  - **Supported**: `harvest`, `repair`, `build`, `upgrade`, `claimupgrade`, `claimbuild`, `sign`, `carry`, `globalcarry`
  - **Priority**: `harvest` > `repair` > `build` > `upgrade` > `sign` > `carry`
- **CarrierI**:
  - **Supported**: `carry`, `globalcarry`, `sign`
  - **Priority**: `carry` > `globalcarry` > `sign`
- **AttackerI**:
  - **Supported**: `police`, `sign`, `attack`
  - **Priority**: `police` > `sign` > `attack`
- **ClaimerI**:
  - **Supported**: `claim`, `reserve`, `sign`
  - **Priority**: `claim` > `reserve` > `sign`

#### Claiming Logic
1. **Memory Lock**: Once a task is claimed, it is marked with `takenBy: creepName` in the taskboard memory to prevent duplicate claims.
2. **Time Priority**: Among the same priority level, tasks with the earliest `createdTime` are claimed first.
3. **Fallback**: If no task is available, the creep remains idle.

---

## 4. Module Reference (module.references)

By calling `require('module.references')`, you can access all system modules, including `AP.*`, `lib.*`, `task.*` and `building.*`.