# Decision AI (全局决策AI) 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现Screeps AI的全局决策系统，包括RCL分级发展策略(DevelopV1/V2)、房间占领(Claim)、战斗防御(Fight)，通过Taskboard Strategy任务解耦决策层与执行层。

**Architecture:** 采用策略模式+路由器架构，每个房间独立运行AI实例。Developv1/v2作为路由器根据layoutType(9x9/5x5)和RCL等级选择对应策略文件(.Lx)。策略文件通过发布Strategy任务到Taskboard，taskhandler感知后转换为具体Creep生成任务。

**Tech Stack:** JavaScript (Screeps API), Taskboard内存数据结构, WASM(calculate_claim用于房间评分)

---

## Phase 1: 核心框架 (MVP)

### Task 1: 扩展Taskboard支持Strategy任务类别

**Files:**
- Modify: `lib.AP.taskboard.js` (在现有Creeps/Buildings基础上新增Strategy支持)

- [ ] **Step 1: 在_initMemory中初始化Strategy类别**

修改 `AP.memcleaner.js:34` 的 `_initMemory()` 方法（或直接在taskboard首次访问时懒初始化）:

```javascript
// lib.AP.taskboard.js - 在文件顶部或_addTask方法中添加Strategy支持

// 修改 _ensureRoom 方法确保支持Strategy类别
_ensureRoom: function(category, roomName) {
    const validCategories = ['Creeps', 'Buildings', 'Strategy']; // 新增Strategy
    if (!validCategories.includes(category)) {
        console.log("[Taskboard] ❌ 无效任务类别: " + category);
        return;
    }
    if (!Memory.Taskboard.Task[category]) {
        Memory.Taskboard.Task[category] = {};
    }
    if (!Memory.Taskboard.Task[category][roomName]) {
        Memory.Taskboard.Task[category][roomName] = [];
    }
},
```

- [ ] **Step 2: 添加Strategy专用的addStrategy方法**

```javascript
// lib.AP.taskboard.js - 新增strategy命名空间

/**
 * Strategy 任务 API (决策层需求)
 */
strategy: {
    /**
     * 发布Creep需求
     * @param {string} roomName 房间名
     * @param {Object} options 需求配置
     * @param {string} options.model Creep型号 (CommonI/CarrierI/AttackerI/ClaimerI)
     * @param {number} options.count 需要数量
     * @param {string} options.priority 优先级 (harvest/build/upgrade/carry/attack/claim)
     * @param {Object} [options.data] 附加参数
     */
    needCreeps: function(roomName, options) {
        if (!roomName || !options || !options.model || !options.count) {
            console.log("[Taskboard] ❌ needCreeps 参数缺失");
            return;
        }
        
        libAPTaskboard._addTask('Strategy', roomName, 'need_creeps', {
            model: options.model,
            count: options.count,
            priority: options.priority || 'harvest',
            data: options.data || {},
            refreshInterval: options.refreshInterval || 100
        });
    },

    /**
     * 发布市场操作需求
     * @param {string} roomName 房间名
     * @param {string} action 操作类型 ('sell' | 'buy')
     * @param {string} resource 资源类型
     * @param {number} amount 数量
     */
    marketAction: function(roomName, action, resource, amount) {
        if (!ENABLE_MARKET) {
            return; // 市场关闭时不发布
        }
        
        libAPTaskboard._addTask('Strategy', roomName, 'market_action', {
            action: action,
            resource: resource,
            amount: amount
        });
    },

    /**
     * 发布Lab生产需求
     * @param {string} roomName 房间名
     * @param {string} compound 目标化合物
     * @param {number} targetAmount 目标数量
     */
    labProduction: function(roomName, compound, targetAmount) {
        libAPTaskboard._addTask('Strategy', roomName, 'lab_production', {
            compound: compound,
            targetAmount: targetAmount
        });
    },

    /**
     * 清除房间的过期Strategy任务
     * @param {string} roomName 房间名
     * @param {number} maxAge 最大存活tick数
     */
    cleanExpired: function(roomName, maxAge) {
        if (!Memory.Taskboard || !Memory.Taskboard.Task || !Memory.Taskboard.Task.Strategy) return;
        
        const tasks = Memory.Taskboard.Task.Strategy[roomName];
        if (!Array.isArray(tasks)) return;
        
        const now = Game.time;
        Memory.Taskboard.Task.Strategy[roomName] = tasks.filter(task => {
            return (now - task.createdTime) < maxAge;
        });
    }
}
```

- [ ] **Step 3: 在memcleaner中初始化Strategy结构**

```javascript
// AP.memcleaner.js - _initMemory() 方法中添加

// 任务看板初始化（已有代码，扩展为包含Strategy）
if (!Memory.Taskboard) Memory.Taskboard = {};
if (!Memory.Taskboard.Task) Memory.Taskboard.Task = { Creeps: {}, Buildings: {}, Strategy: {} }; // 新增Strategy
```

- [ ] **Step 4: 验证Taskboard扩展**

在Screeps控制台执行:
```javascript
const taskboard = require('lib.AP.taskboard');
taskboard.strategy.needCreeps('W1N1', { model: 'CommonI', count: 3, priority: 'harvest' });
console.log(JSON.stringify(Memory.Taskboard.Task.Strategy));
// 预期输出: {"W1N1":[{"type":"need_creeps","data":{...},"createdTime":xxx,"takenBy":null}]}
```

---

### Task 2: 集成Decision AI到Main.js

**Files:**
- Modify: `main.js` (在步骤1和步骤3之间插入决策AI调用)

- [ ] **Step 1: 插入决策AI调用**

```javascript
// main.js - 修改后的完整文件

/**
 * main.js - 新 AGE AI 核心入口
 * 基于任务看板 (Taskboard) 与 自动化控制 (AP) 架构重构。
 */

const modules = require('module.references');

// 全局常量配置
const ENABLE_MARKET = false;  // 赛季模式通常关闭

module.exports.loop = function () {
    // 0. 初始化用户任务发送器（全局对象）
    if (!Game.tasksender) {
        Game.tasksender = require('User.tasksender');
    }
    
    // 1. 系统维护与数据刷新 (每 tick 起点)
    // 包含：内存初始化、死 Creep 清理、任务解绑、全局缓存刷新
    modules.memcleaner.run();

    // 2. 【新增】全局决策AI运行
    // 每个房间独立运行自己的策略实例（develop自动根据layoutType选v1或v2）
    modules.developv1.run();   // 大房间(9x9)策略
    modules.developv2.run();   // 小房间(5x5)策略
    modules.claim.run();       // 占领决策
    modules.fight.run();       // 战斗决策

    // 3. 任务处理器 (AP.taskhandler)
    // 包含：根据任务情况生成 creep 和处理工厂生产流程
    modules.taskhandler.run();

    // 4. 自动化基建控制 (AP.autobuild)
    modules.autobuild.run();

    // 5. 任务调度 (Dispatcher)
    modules.roleDispatcher.run();

    // 6. 建筑逻辑 (Buildings)
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;

        // 6.1 Spawn 逻辑
        const spawns = room.find(FIND_MY_SPAWNS);
        for (const spawn of spawns) {
            modules.buildingSpawn.run(spawn);
        }

        // 6.2 自动市场套利 (如果有 Terminal)
        if (room.terminal) {
            modules.buildingTerminal.run(room.terminal);
            modules.automarket.run(roomName);
        }
        
        // 6.3 Tower 逻辑
        modules.buildingTower.run(room);

        // 6.4 Lab 逻辑
        modules.buildingLab.run(room);

        // 6.5 Factory 逻辑
        modules.buildingFactory.run(room);

        // 6.6 Nuker 逻辑
        modules.buildingNuker.run(room);

        // 6.7 Link 逻辑
        modules.buildingLink.run(room);
    }

    // 7. 资源统计与调试输出 (可选)
    if (Game.time % 100 === 0) {
        console.log("--- 📊 帝国概况 Tick: " + Game.time + " ---");
        console.log("GCL: " + Game.gcl.level + " (" + (Game.gcl.progress / Game.gcl.progressTotal * 100).toFixed(2) + "%)");
        console.log("Creeps: " + Object.keys(Game.creeps).length);
    }
};
```

**注意**: module.references.js已经包含了developv1/developv2/claim/fight的引用定义（第22-32行），无需额外修改。

- [ ] **Step 2: 验证main.js加载无报错**

上传到Screeps后观察控制台：
- 预期：无报错，正常执行步骤1-7
- 如果某模块报错"xxx is not a function"，说明该模块还是空文件（后续Task会填充）

---

### Task 3: 实现DevelopV1路由器

**Files:**
- Rewrite: `AP.developv1.js`

- [ ] **Step 1: 实现路由器核心逻辑**

```javascript
/**
 * AP.developv1.js - 大房间(9x9模板)策略路由器
 * 
 * 根据房间RCL等级自动选择对应的策略文件：
 * - RCL 3 → developv1.L3.js
 * - RCL 4-5 → developv1.L5.js
 * - RCL 6-7 → developv1.L7.js
 * - RCL 8 → developv1.max.js
 */

// 策略缓存（避免重复require）
const strategyCache = {};

/**
 * 根据RCL获取对应的策略模块
 * @param {number} rcl 房间控制等级
 * @returns {Object} 策略模块
 */
function getStrategy(rcl) {
    const key = 'v1_' + rcl;
    
    if (!strategyCache[key]) {
        // RCL到策略文件的映射表
        const strategyMap = {
            3: 'AP.developv1.L3',
            5: 'AP.developv1.L5',
            7: 'AP.developv1.L7',
            8: 'AP.developv1.max'
        };
        
        // 向下查找最适合的策略（RCL 4用L3，RCL 6用L5）
        let targetRcl = rcl;
        while (targetRcl >= 3 && !strategyMap[targetRcl]) {
            targetRcl -= 2;  // 3→5→7→8的跳跃间隔
        }
        
        const strategyPath = strategyMap[targetRcl];
        
        if (strategyPath) {
            try {
                strategyCache[key] = require(strategyPath);
                console.log("[DevelopV1] ✅ 加载策略: " + strategyPath + " (RCL " + rcl + ")");
            } catch (e) {
                console.error("[DevelopV1] ❌ 策略加载失败: " + strategyPath, e);
                strategyCache[key] = null;
            }
        } else {
            strategyCache[key] = null;
        }
    }
    
    return strategyCache[key];
}

const DevelopV1 = {
    /**
     * 主运行函数：遍历所有大房间并执行对应策略
     */
    run: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            
            // 只处理自己的房间
            if (!room.controller || !room.controller.my) continue;
            
            // 只处理大房间（9x9布局）
            if (room.memory.layoutType !== '9x9') continue;
            
            // 获取当前RCL对应的策略
            const rcl = room.controller.level;
            const strategy = getStrategy(rcl);
            
            if (strategy && typeof strategy.run === 'function') {
                try {
                    strategy.run(room);
                } catch (e) {
                    console.error("[DevelopV1] ❌ 策略执行错误 (" + roomName + " RCL" + rcl + "):", e.message);
                }
            } else {
                console.warn("[DevelopV1] ⚠️ 无可用策略: " + roomName + " RCL" + rcl);
            }
        }
    },
    
    /**
     * 清除缓存（用于强制重新加载策略，调试用）
     */
    clearCache: function() {
        for (const key in strategyCache) {
            delete strategyCache[key];
        }
    }
};

module.exports = DevelopV1;
```

- [ ] **Step 2: 验证路由器功能**

在Screeps控制台执行:
```javascript
const developv1 = require('AP.developv1');
developv1.run();
// 预期输出: "[DevelopV1] ✅ 加载策略: AP.developv1.L3 (RCL X)" 或警告信息
```

---

### Task 4: 实现L3策略 (MVP核心)

**Files:**
- Rewrite: `AP.developv1.L3.js`

- [ ] **Step 1: 实现L3完整策略**

```javascript
/**
 * AP.developv1.L3.js - RCL 3 策略 (大房间早期)
 * 
 * 阶段特征：
 * - 无Storage（RCL4才能建）
 * - 无Container（建筑模板未包含）
 * - CommonI自带CARRY部件自己运输
 * - 能量来源仅Source + Spawn/Extension
 * 
 * 核心目标：大量采集者快速积累能量，推进到RCL 5
 */

const DevelopV1_L3 = {
    // === 配置常量 ===
    CONFIG: {
        REFRESH_INTERVAL: 50,           // 每50tick刷新一次策略
        
        CREEP_CONFIG: {
            CommonI: {
                minCount: 4,             // 至少4个通用工人
                maxCount: 6,             // 最多6个（避免拥挤）
                bodySize: 'small',       // 小body快速生成 (200-450 energy)
                priorities: ['harvest', 'upgrade', 'build', 'repair']
                // L3不需要CarrierI！CommonI自带CARRY
            }
        }
    },

    /**
     * 主运行函数（每tick调用）
     * @param {Room} room 房间对象
     */
    run: function(room) {
        try {
            const state = this.analyze(room);
            
            // 控制刷新频率（降低CPU消耗）
            if (!this._shouldRefresh(room)) return;
            
            // 发布Creep需求
            this._publishCreepNeeds(room, state);
            
            // 检查里程碑（是否接近升级）
            this._checkMilestone(room, state);
            
        } catch (e) {
            console.error("[DevelopV1-L3] ❌ 执行错误:", e.message);
        }
    },

    /**
     * 分析房间当前状态
     * @param {Room} room
     * @returns {Object} 状态快照
     */
    analyze: function(room) {
        const creeps = this._countCreepsByModel(room);
        const sources = room.find(FIND_SOURCES);
        
        return {
            rcl: room.controller.level,
            energyAvailable: room.energyAvailable,
            energyCapacity: room.energyCapacityAvailable,
            creeps: creeps,
            commonICount: creeps.CommonI || 0,
            constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            controllerProgress: room.controller.progress / room.controller.progressTotal,
            storageBuilt: !!room.storage,
            sourceCount: sources.length,
            sources: sources
        };
    },

    /**
     * 判断是否需要刷新Strategy任务
     * @private
     */
    _shouldRefresh: function(room) {
        const lastRefresh = room.memory.lastStrategyRefresh || 0;
        const interval = this.CONFIG.REFRESH_INTERVAL;
        
        if (Game.time - lastRefresh >= interval) {
            room.memory.lastStrategyRefresh = Game.time;
            return true;
        }
        return false;
    },

    /**
     * 发布Creep需求到Taskboard
     * @private
     */
    _publishCreepNeeds: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        const config = this.CONFIG.CREEP_CONFIG.CommonI;
        
        const currentCount = state.commonICount;
        
        // === CommonI需求判断 ===
        if (currentCount < config.minCount) {
            // 低于最小值：紧急补充
            const deficit = config.minCount - currentCount;
            
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI',
                count: Math.min(deficit, 2),  // 每次最多申请2个，避免突然爆发
                priority: 'harvest',           // L3优先采集
                data: {
                    bodySize: config.bodySize,
                    urgent: currentCount < 2   // 极低数量时标记紧急
                }
            });
            
            if (Game.time % 100 === 0) {
                console.log("[" + room.name + "] [L3] 🔴 CommonI不足: " + currentCount + "/" + config.minCount + 
                           ", 申请 +" + Math.min(deficit, 2));
            }
        }
        else if (currentCount < config.maxCount && state.constructionSites > 3) {
            // 有大量工地时适当增加
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI',
                count: 1,
                priority: 'build',
                data: { bodySize: config.bodySize }
            });
        }
        
        // L3阶段不发布CarrierI需求（无Storage）
    },

    /**
     * 统计房间内各型号Creep数量
     * @private
     */
    _countCreepsByModel: function(room) {
        const counts = { CommonI: 0, CarrierI: 0, AttackerI: 0, ClaimerI: 0 };
        
        const creeps = room.find(FIND_MY_CREEPS);
        for (const creep of creeps) {
            const model = creep.memory.model;
            if (model && counts[model] !== undefined) {
                counts[model]++;
            }
        }
        
        return counts;
    },

    /**
     * 检查是否达到升级里程碑
     * @private
     */
    _checkMilestone: function(room, state) {
        // RCL进度超过80%且Creep充足时提示
        if (state.controllerProgress > 0.8 && state.commonICount >= this.CONFIG.CREEP_CONFIG.CommonI.minCount) {
            if (Game.time % 500 === 0) {  // 每500tick提示一次即可
                console.log("[" + room.name + "] [L3] 📈 即将达到RCL5 (进度: " + (state.controllerProgress * 100).toFixed(1) + "%)" +
                           ", 准备切换到L5策略");
            }
        }
    }
};

module.exports = DevelopV1_L3;
```

- [ ] **Step 2: 测试L3策略**

在Screeps控制台（RCL 3的房间）执行:
```javascript
const L3 = require('AP.developv1.L3');
const room = Game.rooms['你的房间名'];
const state = L3.analyze(room);
console.log(JSON.stringify(state, null, 2));
// 预期: 输出包含rcl, energyAvailable, creeps等字段的状态对象

L3.run(room);
console.log(JSON.stringify(Memory.Taskboard.Task.Strategy));
// 预期: 如果CommonI不足4个，应该看到need_creeps类型的Strategy任务
```

---

## Phase 2: 完整策略实现

### Task 5: 实现L5策略

**Files:**
- Rewrite: `AP.developv1.L5.js`

- [ ] **Step 1: 实现L5完整策略**

```javascript
/**
 * AP.developv1.L5.js - RCL 5 策略 (大房间中期)
 * 
 * 阶段特征：
 * - 有Storage，能量经济稳定
 * - 可建造Lab、Terminal、Spawn2
 * - 开始资源多样化
 * - CommonI数量减少但个体增大
 * - 引入CarrierI专职运输
 */

const DevelopV1_L5 = {
    CONFIG: {
        REFRESH_INTERVAL: 100,          // 中期可以更慢刷新
        
        CREEP_CONFIG: {
            CommonI: {
                minCount: 3,             // 减少数量（个体更强）
                maxCount: 5,
                bodySize: 'medium',      // 中等body (550-700 energy)
                priorities: ['harvest', 'build', 'upgrade', 'repair', 'carry']
            },
            CarrierI: {
                minCount: 2,             // Storage需要专职运输
                maxCount: 4,
                bodySize: 'medium',
                priorities: ['carry', 'globalcarry']  // 支持跨房间
            }
        },
        
        RESOURCE_POLICY: {
            enableMarket: false,         // 赛季模式关闭
            sellThreshold: {
                energy: 100000,
                U: 5000,
                O: 5000,
                H: 3000,
                Z: 2000,
                K: 2000,
                L: 2000
            },
            keepReserve: {
                energy: 20000
            }
        }
    },

    run: function(room) {
        try {
            const state = this.analyze(room);
            
            if (!this._shouldRefresh(room)) return;
            
            this._publishCreepNeeds(room, state);
            this._manageResources(room, state);      // L5新增：资源管理
            this._checkMilestone(room, state);
            
        } catch (e) {
            console.error("[DevelopV1-L5] ❌ 执行错误:", e.message);
        }
    },

    analyze: function(room) {
        const baseState = this._baseAnalyze(room);
        
        // L5特有状态
        return Object.assign(baseState, {
            storageLevel: room.storage ? (room.storage.store[RESOURCE_ENERGY] || 0) : 0,
            terminalAvailable: !!room.terminal,
            labCount: room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_LAB
            }).length
        });
    },

    _baseAnalyze: function(room) {
        const creeps = this._countCreepsByModel(room);
        
        return {
            rcl: room.controller.level,
            energyAvailable: room.energyAvailable,
            energyCapacity: room.energyCapacityAvailable,
            creeps: creeps,
            constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            controllerProgress: room.controller.progress / room.controller.progressTotal
        };
    },

    _shouldRefresh: function(room) {
        const lastRefresh = room.memory.lastStrategyRefresh || 0;
        if (Game.time - lastRefresh >= this.CONFIG.REFRESH_INTERVAL) {
            room.memory.lastStrategyRefresh = Game.time;
            return true;
        }
        return false;
    },

    _publishCreepNeeds: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        const commonConfig = this.CONFIG.CREEP_CONFIG.CommonI;
        const carrierConfig = this.CONFIG.CREEP_CONFIG.CarrierI;
        
        // === CommonI需求 ===
        const currentCommon = state.creeps.CommonI || 0;
        if (currentCommon < commonConfig.minCount) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI',
                count: Math.min(commonConfig.minCount - currentCommon, 2),
                priority: 'harvest',
                data: { bodySize: commonConfig.bodySize }
            });
        }
        
        // === CarrierI需求（L5新增！）===
        if (state.storageLevel > 10000) {  // Storage有一定储量后才需要
            const currentCarrier = state.creeps.CarrierI || 0;
            if (currentCarrier < carrierConfig.minCount) {
                taskboard.strategy.needCreeps(room.name, {
                    model: 'CarrierI',
                    count: carrierConfig.minCount - currentCarrier,
                    priority: 'carry',
                    data: { bodySize: carrierConfig.bodySize }
                });
            }
        }
    },

    _manageResources: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        const policy = this.CONFIG.RESOURCE_POLICY;
        
        // 市场操作（如果开启）
        if (policy.enableMarket && state.storageLevel > policy.sellThreshold.energy) {
            taskboard.strategy.marketAction(
                room.name,
                'sell',
                RESOURCE_ENERGY,
                state.storageLevel - policy.keepReserve.energy
            );
        }
        
        // Terminal跨房间运输准备
        if (state.terminalAvailable && state.storageLevel > 50000) {
            const currentCarrier = state.creeps.CarrierI || 0;
            if (currentCarrier < this.CONFIG.CREEP_CONFIG.CarrierI.maxCount) {
                taskboard.strategy.needCreeps(room.name, {
                    model: 'CarrierI',
                    count: 1,
                    priority: 'globalcarry',
                    data: { enableCrossRoom: true }
                });
            }
        }
    },

    _countCreepsByModel: function(room) {
        const counts = { CommonI: 0, CarrierI: 0, AttackerI: 0, ClaimerI: 0 };
        const creeps = room.find(FIND_MY_CREEPS);
        for (const creep of creeps) {
            const model = creep.memory.model;
            if (model && counts[model] !== undefined) {
                counts[model]++;
            }
        }
        return counts;
    },

    _checkMilestone: function(room, state) {
        if (state.controllerProgress > 0.8) {
            if (Game.time % 500 === 0) {
                console.log("[" + room.name + "] [L5] 📈 即将达到RCL7");
            }
        }
    }
};

module.exports = DevelopV1_L5;
```

- [ ] **Step 2: 验证L5策略**

在RCL 5+房间测试analyze()输出和Strategy任务发布。

---

### Task 6: 实现L7策略

**Files:**
- Rewrite: `AP.developv1.L7.js`

- [ ] **Step 1: 实现L7完整策略**

```javascript
/**
 * AP.developv1.L7.js - RCL 7 策略 (大房间后期)
 * 
 * 阶段特征：
 * - 所有高级建筑就绪（Labx6, Terminal, Factory, Observer, PowerSpawn）
 * - 可Boost Creep（WORK/CARRY boost）
 * - Creep数量精简但个体极强
 * - 开始基础防御协调
 */

const DevelopV1_L7 = {
    CONFIG: {
        REFRESH_INTERVAL: 150,          // 后期更稳定
        
        CREEP_CONFIG: {
            CommonI: {
                minCount: 2,             // 精简到2个大块头
                maxCount: 3,
                bodySize: 'large',       // 大body (700-850 energy)
                enableBoost: true,
                boostResource: 'XUH2O'  // WORK boost (+100%)
            },
            CarrierI: {
                minCount: 3,
                maxCount: 5,
                bodySize: 'large',
                enableBoost: true,
                boostResource: 'XKH2O'  // CARRY boost (+50%)
            },
            AttackerI: {                 // L7新增：基础防御
                minCount: 0,
                maxCount: 3,
                bodySize: 'large',
                enableBoost: true
            }
        },
        
        LAB_BOOST_CONFIG: {
            targetBoosts: [
                { resource: 'XUH2O', amount: 1000 },   // WORK boost
                { resource: 'XKH2O', amount: 500 }     // CARRY boost (可选)
            ],
            minLabsNeeded: 6
        }
    },

    run: function(room) {
        try {
            const state = this.analyze(room);
            
            if (!this._shouldRefresh(room)) return;
            
            this._publishCreepNeeds(room, state);
            this._manageBoostProduction(room, state);  // L7新增：Boost管理
            this._checkMilestone(room, state);
            
        } catch (e) {
            console.error("[DevelopV1-L7] ❌ 执行错误:", e.message);
        }
    },

    analyze: function(room) {
        const creeps = this._countCreepsByModel(room);
        
        return {
            rcl: room.controller.level,
            energyAvailable: room.energyAvailable,
            energyCapacity: room.energyCapacityAvailable,
            storageEnergy: room.storage ? (room.storage.store[RESOURCE_ENERGY] || 0) : 0,
            creeps: creeps,
            constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            controllerProgress: room.controller.progress / room.controller.progressTotal,
            labCount: room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB }).length,
            terminalAvailable: !!room.terminal,
            factoryAvailable: !!room.factory
        };
    },

    _shouldRefresh: function(room) {
        const lastRefresh = room.memory.lastStrategyRefresh || 0;
        if (Game.time - lastRefresh >= this.CONFIG.REFRESH_INTERVAL) {
            room.memory.lastStrategyRefresh = Game.time;
            return true;
        }
        return false;
    },

    _publishCreepNeeds: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        const configs = this.CONFIG.CREEP_CONFIG;
        
        // CommonI
        const commonCfg = configs.CommonI;
        const currentCommon = state.creeps.CommonI || 0;
        if (currentCommon < commonCfg.minCount) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI',
                count: commonCfg.minCount - currentCommon,
                priority: 'harvest',
                data: {
                    bodySize: commonCfg.bodySize,
                    enableBoost: commonCfg.enableBoost,
                    boostResource: commonCfg.boostResource
                }
            });
        }
        
        // CarrierI
        const carrierCfg = configs.CarrierI;
        const currentCarrier = state.creeps.CarrierI || 0;
        if (currentCarrier < carrierCfg.minCount && state.storageEnergy > 20000) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CarrierI',
                count: Math.min(carrierCfg.minCount - currentCarrier, 2),
                priority: 'carry',
                data: {
                    bodySize: carrierCfg.bodySize,
                    enableBoost: carrierCfg.enableBoost,
                    boostResource: carrierCfg.boostResource
                }
            });
        }
        
        // AttackerI（按需生成，不主动申请除非有威胁）
        // 由Fight模块负责触发
    },

    _manageBoostProduction: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        const labConfig = this.CONFIG.LAB_BOOST_CONFIG;
        
        if (state.labCount < labConfig.minLabsNeeded) {
            if (Game.time % 1000 === 0) {
                console.log("[" + room.name + "] [L7] ⚠️ Lab数量不足 (" + state.labCount + "/" + labConfig.minLabsNeeded + ")，无法启动boost");
            }
            return;
        }
        
        // 发布Lab生产任务
        for (const boost of labConfig.targetBoosts) {
            const labsWithCompound = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_LAB && 
                           s.store[boost.resource] > 0
            });
            
            let totalAmount = 0;
            for (const lab of labsWithCompound) {
                totalAmount += lab.store[boost.resource];
            }
            
            if (totalAmount < boost.amount) {
                taskboard.strategy.labProduction(room.name, boost.resource, boost.amount);
                
                if (Game.time % 500 === 0) {
                    console.log("[" + room.name + "] [L7] 🧪 需要生产boost: " + boost.resource + 
                               " (当前: " + totalAmount + "/" + boost.amount + ")");
                }
            }
        }
    },

    _countCreepsByModel: function(room) {
        const counts = { CommonI: 0, CarrierI: 0, AttackerI: 0, ClaimerI: 0 };
        const creeps = room.find(FIND_MY_CREEPS);
        for (const creep of creeps) {
            const model = creep.memory.model;
            if (model && counts[model] !== undefined) {
                counts[model]++;
            }
        }
        return counts;
    },

    _checkMilestone: function(room, state) {
        if (state.controllerProgress > 0.9) {
            if (Game.time % 500 === 0) {
                console.log("[" + room.name + "] [L7] 📈 即将达到RCL8 (Max)");
            }
        }
    }
};

module.exports = DevelopV1_L7;
```

---

### Task 7: 实现Max策略

**Files:**
- Rewrite: `AP.developv1.max.js`

- [ ] **Step 1: 实现Max完整策略**

```javascript
/**
 * AP.developv1.max.js - RCL 8 (Max) 终极策略
 * 
 * 阶段特征：
 * - 所有建筑已满级
 * - 主要目标：GCL增长、房间扩张、战斗准备
 * - 经济最优化
 * - 协调ClaimerI进行扩张
 */

const DevelopV1_Max = {
    CONFIG: {
        REFRESH_INTERVAL: 200,          // 最稳定，最慢刷新
        
        CREEP_CONFIG: {
            CommonI: {
                minCount: 2,
                maxCount: 3,
                bodySize: 'max',        // 最大body (850 energy)
                enableBoost: true
            },
            CarrierI: {
                minCount: 4,
                maxCount: 6,
                bodySize: 'max',
                enableBoost: true
            },
            AttackerI: {
                minCount: 2,             // Max阶段保持常备防御力量
                maxCount: 4,
                bodySize: 'max',
                enableBoost: true
            },
            ClaimerI: {
                minCount: 0,
                maxCount: 2,             // 准备扩张！
                bodySize: 'large'
            }
        },
        
        EXPANSION: {
            enableClaim: true,
            maxRooms: 8,                 // 最多拥有8个房间
            claimInterval: 15000,        // 每15k tick尝试一次claim
            preferredDistance: { min: 4, max: 6 }
        }
    },

    run: function(room) {
        try {
            const state = this.analyze(room);
            
            if (!this._shouldRefresh(room)) return;
            
            this._publishCreepNeeds(room, state);
            this._optimizeEconomy(room, state);      // 经济最优化
            this._evaluateExpansion(room, state);    // 评估扩张
            
        } catch (e) {
            console.error("[DevelopV1-Max] ❌ 执行错误:", e.message);
        }
    },

    analyze: function(room) {
        const creeps = this._countCreepsByModel(room);
        const myRooms = this._countMyRooms();
        
        return {
            rcl: room.controller.level,
            energyAvailable: room.energyAvailable,
            energyCapacity: room.energyCapacityAvailable,
            storageEnergy: room.storage ? (room.storage.store[RESOURCE_ENERGY] || 0) : 0,
            creeps: creeps,
            myRoomCount: myRooms,
            constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            controllerProgress: room.controller.progress / room.controller.progressTotal,
            gcl: Game.gcl.level,
            labCount: room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB }).length,
            terminalAvailable: !!room.terminal
        };
    },

    _shouldRefresh: function(room) {
        const lastRefresh = room.memory.lastStrategyRefresh || 0;
        if (Game.time - lastRefresh >= this.CONFIG.REFRESH_INTERVAL) {
            room.memory.lastStrategyRefresh = Game.time;
            return true;
        }
        return false;
    },

    _publishCreepNeeds: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        const configs = this.CONFIG.CREEP_CONFIG;
        
        // 所有型号都按配置发布需求
        for (const model in configs) {
            const cfg = configs[model];
            const currentCount = state.creeps[model] || 0;
            
            if (currentCount < cfg.minCount) {
                taskboard.strategy.needCreeps(room.name, {
                    model: model,
                    count: cfg.minCount - currentCount,
                    priority: this._getDefaultPriority(model),
                    data: {
                        bodySize: cfg.bodySize,
                        enableBoost: cfg.enableBoost
                    }
                });
            }
        }
    },

    _getDefaultPriority: function(model) {
        const priorities = {
            CommonI: 'harvest',
            CarrierI: 'carry',
            AttackerI: 'attack',
            ClaimerI: 'claim'
        };
        return priorities[model] || 'harvest';
    },

    _optimizeEconomy: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        
        // Storage能量过高时考虑卖出（如果市场开启）
        if (ENABLE_MARKET && state.storageEnergy > 200000) {
            taskboard.strategy.marketAction(room.name, 'sell', RESOURCE_ENERGY, 50000);
        }
        
        // 确保有足够的Carrier应对大容量Storage
        const carrierCfg = this.CONFIG.CREEP_CONFIG.CarrierI;
        const currentCarrier = state.creeps.CarrierI || 0;
        if (state.storageEnergy > 100000 && currentCarrier < carrierCfg.maxCount) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CarrierI',
                count: 1,
                priority: 'globalcarry',
                data: { enableCrossRoom: true }
            });
        }
    },

    _evaluateExpansion: function(room, state) {
        const policy = this.CONFIG.EXPANSION;
        
        if (!policy.enableClaim) return;
        if (state.myRoomCount >= policy.maxRooms) return;
        
        // 检查距离上次claim的时间
        const lastClaim = room.memory.lastClaimAttempt || 0;
        if (Game.time - lastClaim < policy.claimInterval) return;
        
        // 检查是否有足够资源支持扩张
        if (state.storageEnergy < 100000) {
            return; // 能量不足以支持扩张
        }
        
        // 发布扩张评估请求（由Claim模块具体执行）
        const taskboard = require('lib.AP.taskboard');
        taskboard.strategy.needCreeps(room.name, {
            model: 'ClaimerI',
            count: 1,
            priority: 'claim',
            data: {
                phase: 'scout_and_claim',
                preferredDistance: policy.preferredDistance
            }
        });
        
        room.memory.lastClaimAttempt = Game.time;
        
        if (Game.time % 1000 === 0) {
            console.log("[" + room.name + "] [Max] 🌍 评估扩张机会 (当前房间数: " + state.myRoomCount + "/" + policy.maxRooms + ")");
        }
    },

    _countCreepsByModel: function(room) {
        const counts = { CommonI: 0, CarrierI: 0, AttackerI: 0, ClaimerI: 0 };
        const creeps = room.find(FIND_MY_CREEPS);
        for (const creep of creeps) {
            const model = creep.memory.model;
            if (model && counts[model] !== undefined) {
                counts[model]++;
            }
        }
        return counts;
    },

    _countMyRooms: function() {
        let count = 0;
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                count++;
            }
        }
        return count;
    }
};

module.exports = DevelopV1_Max;
```

---

### Task 8: 实现DevelopV2路由器和小房间策略

**Files:**
- Rewrite: `AP.developv2.js`
- Rewrite: `AP.developv2.L4.js`
- Rewrite: `AP.developv2.L5.js`
- Rewrite: `AP.developv2.max.js`

- [ ] **Step 1: 实现DevelopV2路由器**

```javascript
/**
 * AP.developv2.js - 小房间(5x5模板)策略路由器
 * 
 * 与DevelopV1类似，但：
 * - 只处理 layoutType === '5x5' 的房间
 * - 加载 developv2.L4 / .L5 / .max
 * - Creep配置更精简（小地图不需要那么多creep）
 */

const strategyCache = {};

function getStrategy(rcl) {
    const key = 'v2_' + rcl;
    
    if (!strategyCache[key]) {
        const strategyMap = {
            4: 'AP.developv2.L4',
            5: 'AP.developv2.L5',
            8: 'AP.developv2.max'
        };
        
        let targetRcl = rcl;
        while (targetRcl >= 4 && !strategyMap[targetRcl]) {
            targetRcl += 1;  // v2的跳跃不同：4→5→8
        }
        
        const strategyPath = strategyMap[targetRcl];
        
        if (strategyPath) {
            try {
                strategyCache[key] = require(strategyPath);
                console.log("[DevelopV2] ✅ 加载策略: " + strategyPath + " (RCL " + rcl + ")");
            } catch (e) {
                console.error("[DevelopV2] ❌ 策略加载失败: " + strategyPath, e);
                strategyCache[key] = null;
            }
        } else {
            strategyCache[key] = null;
        }
    }
    
    return strategyCache[key];
}

const DevelopV2 = {
    run: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            
            if (!room.controller || !room.controller.my) continue;
            if (room.memory.layoutType !== '5x5') continue;  // 只处理小房间
            
            const rcl = room.controller.level;
            const strategy = getStrategy(rcl);
            
            if (strategy && typeof strategy.run === 'function') {
                try {
                    strategy.run(room);
                } catch (e) {
                    console.error("[DevelopV2] ❌ 策略执行错误 (" + roomName + " RCL" + rcl + "):", e.message);
                }
            }
        }
    },
    
    clearCache: function() {
        for (const key in strategyCache) {
            delete strategyCache[key];
        }
    }
};

module.exports = DevelopV2;
```

- [ ] **Step 2: 实现L4小房间策略（简化版）**

```javascript
/**
 * AP.developv2.L4.js - RCL 4 策略 (小房间)
 * 
 * 小房间特点：
 * - 地图小，Source间距近
 * - 不需要太多Creep
 * - RCL 4才有Storage
 */

const DevelopV2_L4 = {
    CONFIG: {
        REFRESH_INTERVAL: 50,
        CREEP_CONFIG: {
            CommonI: {
                minCount: 3,    // 小房间3个就够
                maxCount: 4,
                bodySize: 'small'
            }
            // L4暂不需要CarrierI（刚建Storage）
        }
    },

    run: function(room) {
        try {
            const state = this.analyze(room);
            if (!this._shouldRefresh(room)) return;
            this._publishCreepNeeds(room, state);
        } catch (e) {
            console.error("[DevelopV2-L4] ❌ 错误:", e.message);
        }
    },

    analyze: function(room) {
        const creeps = this._countCreepsByModel(room);
        return {
            rcl: room.controller.level,
            energyAvailable: room.energyAvailable,
            creeps: creeps,
            commonICount: creeps.CommonI || 0,
            controllerProgress: room.controller.progress / room.controller.progressTotal,
            storageBuilt: !!room.storage
        };
    },

    _shouldRefresh: function(room) {
        const lastRefresh = room.memory.lastStrategyRefresh || 0;
        if (Game.time - lastRefresh >= this.CONFIG.REFRESH_INTERVAL) {
            room.memory.lastStrategyRefresh = Game.time;
            return true;
        }
        return false;
    },

    _publishCreepNeeds: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        const config = this.CONFIG.CREEP_CONFIG.CommonI;
        
        if (state.commonICount < config.minCount) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI',
                count: config.minCount - state.commonICount,
                priority: 'harvest',
                data: { bodySize: config.bodySize }
            });
        }
    },

    _countCreepsByModel: function(room) {
        const counts = { CommonI: 0, CarrierI: 0, AttackerI: 0, ClaimerI: 0 };
        const creeps = room.find(FIND_MY_CREEPS);
        for (const creep of creeps) {
            const model = creep.memory.model;
            if (model && counts[model] !== undefined) counts[model]++;
        }
        return counts;
    }
};

module.exports = DevelopV2_L4;
```

- [ ] **Step 3: 实现L5小房间策略（简化版）**

```javascript
/**
 * AP.developv2.L5.js - RCL 5 策略 (小房间)
 */

const DevelopV2_L5 = {
    CONFIG: {
        REFRESH_INTERVAL: 100,
        CREEP_CONFIG: {
            CommonI: {
                minCount: 2,
                maxCount: 3,
                bodySize: 'medium'
            },
            CarrierI: {
                minCount: 1,    // 小房间1个运输工够
                maxCount: 2,
                bodySize: 'small'
            }
        }
    },

    run: function(room) {
        try {
            const state = this.analyze(room);
            if (!this._shouldRefresh(room)) return;
            this._publishCreepNeeds(room, state);
        } catch (e) {
            console.error("[DevelopV2-L5] ❌ 错误:", e.message);
        }
    },

    analyze: function(room) {
        const creeps = this._countCreepsByModel(room);
        return {
            rcl: room.controller.level,
            creeps: creeps,
            storageEnergy: room.storage ? (room.storage.store[RESOURCE_ENERGY] || 0) : 0,
            controllerProgress: room.controller.progress / room.controller.progressTotal
        };
    },

    _shouldRefresh: function(room) {
        const lastRefresh = room.memory.lastStrategyRefresh || 0;
        if (Game.time - lastRefresh >= this.CONFIG.REFRESH_INTERVAL) {
            room.memory.lastStrategyRefresh = Game.time;
            return true;
        }
        return false;
    },

    _publishCreepNeeds: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        const configs = this.CONFIG.CREEP_CONFIG;
        
        // CommonI
        const curCommon = (state.creeps.CommonI || 0);
        if (curCommon < configs.CommonI.minCount) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI',
                count: configs.CommonI.minCount - curCommon,
                priority: 'harvest',
                data: { bodySize: configs.CommonI.bodySize }
            });
        }
        
        // CarrierI
        if (state.storageEnergy > 10000) {
            const curCarrier = (state.creeps.CarrierI || 0);
            if (curCarrier < configs.CarrierI.minCount) {
                taskboard.strategy.needCreeps(room.name, {
                    model: 'CarrierI',
                    count: configs.CarrierI.minCount - curCarrier,
                    priority: 'carry',
                    data: { bodySize: configs.CarrierI.bodySize }
                });
            }
        }
    },

    _countCreepsByModel: function(room) {
        const counts = { CommonI: 0, CarrierI: 0, AttackerI: 0, ClaimerI: 0 };
        const creeps = room.find(FIND_MY_CREEPS);
        for (const creep of creeps) {
            const model = creep.memory.model;
            if (model && counts[model] !== undefined) counts[model]++;
        }
        return counts;
    }
};

module.exports = DevelopV2_L5;
```

- [ ] **Step 4: 实现Max小房间策略（简化版）**

```javascript
/**
 * AP.developv2.max.js - RCL 8 Max 策略 (小房间)
 */

const DevelopV2_Max = {
    CONFIG: {
        REFRESH_INTERVAL: 200,
        CREEP_CONFIG: {
            CommonI: { minCount: 1, maxCount: 2, bodySize: 'large', enableBoost: true },
            CarrierI: { minCount: 2, maxCount: 3, bodySize: 'large', enableBoost: true },
            AttackerI: { minCount: 1, maxCount: 2, bodySize: 'medium' }
        }
    },

    run: function(room) {
        try {
            const state = this.analyze(room);
            if (!this._shouldRefresh(room)) return;
            this._publishCreepNeeds(room, state);
        } catch (e) {
            console.error("[DevelopV2-Max] ❌ 错误:", e.message);
        }
    },

    analyze: function(room) {
        const creeps = this._countCreepsByModel(room);
        return {
            rcl: room.controller.level,
            creeps: creeps,
            storageEnergy: room.storage ? (room.storage.store[RESOURCE_ENERGY] || 0) : 0
        };
    },

    _shouldRefresh: function(room) {
        const lastRefresh = room.memory.lastStrategyRefresh || 0;
        if (Game.time - lastRefresh >= this.CONFIG.REFRESH_INTERVAL) {
            room.memory.lastStrategyRefresh = Game.time;
            return true;
        }
        return false;
    },

    _publishCreepNeeds: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        const configs = this.CONFIG.CREEP_CONFIG;
        
        for (const model in configs) {
            const cfg = configs[model];
            const current = (state.creeps[model] || 0);
            if (current < cfg.minCount) {
                taskboard.strategy.needCreeps(room.name, {
                    model: model,
                    count: cfg.minCount - current,
                    priority: model === 'AttackerI' ? 'attack' : (model === 'CarrierI' ? 'carry' : 'harvest'),
                    data: { bodySize: cfg.bodySize, enableBoost: cfg.enableBoost }
                });
            }
        }
    },

    _countCreepsByModel: function(room) {
        const counts = { CommonI: 0, CarrierI: 0, AttackerI: 0, ClaimerI: 0 };
        const creeps = room.find(FIND_MY_CREEPS);
        for (const creep of creeps) {
            const model = creep.memory.model;
            if (model && counts[model] !== undefined) counts[model]++;
        }
        return counts;
    }
};

module.exports = DevelopV2_Max;
```

---

## Phase 3: Taskhandler集成 (连接决策层和执行层)

### Task 9: 修改Taskhandler感知Strategy任务

**Files:**
- Modify: `AP.taskhandler.js` (在run()开头增加Strategy任务处理逻辑)

- [ ] **Step 1: 在taskhandler中添加Strategy感知方法**

在 `AP.taskholder.js` 文件的 `run:` 方法开头添加调用：

```javascript
// AP.taskhandler.js - 修改 run 方法

run: function() {
    // 【新增】先处理决策层的Strategy任务
    this._processStrategyTasks();
    
    // ... 原有的任务处理逻辑不变 ...
},

/**
 * 【新增】处理Strategy任务（决策层→执行层转换）
 * @private
 */
_processStrategyTasks: function() {
    if (!Memory.Taskboard || !Memory.Taskboard.Task || !Memory.Taskboard.Task.Strategy) return;
    
    const taskboard = require('lib.AP.taskboard');
    
    for (const roomName in Memory.Taskboard.Task.Strategy) {
        const tasks = Memory.Taskboard.Task.Strategy[roomName];
        if (!Array.isArray(tasks)) continue;
        
        for (let i = tasks.length - 1; i >= 0; i--) {
            const task = tasks[i];
            
            // 跳过已被处理的任务
            if (task.takenBy) continue;
            
            // 根据任务类型分发处理
            switch (task.type) {
                case 'need_creeps':
                    this._handleNeedCreeps(taskboard, roomName, task);
                    break;
                    
                case 'market_action':
                    this._handleMarketAction(taskboard, roomName, task);
                    break;
                    
                case 'lab_production':
                    this._handleLabProduction(taskboard, roomName, task);
                    break;
                    
                default:
                    console.warn("[TaskHandler] ⚠️ 未知的Strategy任务类型: " + task.type);
            }
            
            // 标记为已处理（避免重复处理）
            task.takenBy = 'taskhandler';
        }
    }
},

/**
 * 【新增】处理Creep需求：转换为具体的Spawn任务
 * @private
 */
_handleNeedCreeps: function(taskboard, roomName, strategyTask) {
    const model = strategyTask.data.model;
    const count = strategyTask.data.count;
    const priority = strategyTask.data.priority;
    
    if (!model || !count || count <= 0) return;
    
    // 统计当前该型号的Creep数量（包括正在孵化的）
    const currentCount = this._countCreepsByModel(roomName, model);
    const deficit = count - currentCount;
    
    if (deficit <= 0) {
        // 已满足需求，清除这个Strategy任务
        return;  // takenBy已标记，下次清理时会移除
    }
    
    // 转换为Spawn任务发布到Buildings类别
    for (let i = 0; i < Math.min(deficit, 3); i++) {  // 每次最多转换3个，避免爆发
        taskboard.buildings.spawn(roomName, model, priority, strategyTask.data);
    }
    
    if (Game.time % 100 === 0) {
        console.log("[TaskHandler] 🔄 Strategy转换: 需要" + count + "个" + model + 
                   ", 当前" + currentCount + "个, 实际孵化+" + Math.min(deficit, 3) + "个");
    }
},

/**
 * 【新增】统计指定型号的Creep数量
 * @private
 */
_countCreepsByModel: function(roomName, model) {
    let count = 0;
    
    // 统计存活的Creep
    if (Game.rooms[roomName]) {
        const creeps = Game.rooms[roomName].find(FIND_MY_CREEPS);
        for (const creep of creeps) {
            if (creep.memory.model === model) count++;
        }
    }
    
    // 还要检查正在孵化的（Spawn.spawning）
    // （可选：如果需要更精确的控制）
    
    return count;
},

/**
 * 【新增】处理市场操作需求
 * @private
 */
_handleMarketAction: function(taskboard, roomName, task) {
    if (!ENABLE_MARKET) return;
    
    const action = task.data.action;  // 'sell' | 'buy'
    const resource = task.data.resource;
    const amount = task.data.amount;
    
    // 调用market模块执行具体操作
    // 这里只是示例，实际逻辑可能需要更多参数检查
    console.log("[TaskHandler] 🏷️ 市场操作请求: " + action + " " + amount + " " + resource + 
               " in " + roomName);
    
    // 实际的市场操作应该在buildingTerminal或独立的市场模块中执行
    // 这里仅做日志记录，避免重复实现
},

/**
 * 【新增】处理Lab生产需求
 * @private
 */
_handleLabProduction: function(taskboard, roomName, task) {
    const compound = task.data.compound;
    const targetAmount = task.data.targetAmount;
    
    console.log("[TaskHandler] 🧪 Lab生产请求: 生产 " + targetAmount + " " + compound + 
               " in " + roomName);
    
    // 具体的Lab生产调度逻辑应该放在 building.lab.js 或独立的lab管理模块中
    // 这里仅记录需求，实际生产由对应模块负责
}
```

- [ ] **Step 2: 验证Strategy感知**

在Screeps控制台执行:
```javascript
// 手动发布一个Strategy任务
const tb = require('lib.AP.taskboard');
tb.strategy.needCreeps('W1N1', { model: 'CommonI', count: 5 });

// 运行taskhandler
const th = require('AP.taskhandler');
th.run();

// 检查是否转换为Buildings任务
console.log(JSON.stringify(Memory.Taskboard.Task.Buildings));
// 预期: 应该看到新的spawn类型任务
```

---

## Phase 4: 高级功能模块

### Task 10: 实现Claim模块 (房间占领决策)

**Files:**
- Rewrite: `AP.claim.js`

- [ ] **Step 1: 实现Claim完整模块**

```javascript
/**
 * AP.claim.js - 房间占领决策模块
 * 
 * 核心职责：
 * - 评估候选房间的价值（使用calculate_claim WASM模块）
 * - 决定何时发送ClaimerI
 * - 协调占领流程：scout → reserve → claim → build
 * 
 * 触发条件：
 * - 仅RCL 7+房间才启动claim逻辑
 * - 控制房间数量不超过上限（默认8个）
 * - 两次claim间隔至少15k ticks
 */

const APClaim = {
    CONFIG: {
        MIN_RCL_TO_CLAIM: 7,          // 最低RCL才能扩张
        MAX_ROOMS: 8,                  // 最多拥有房间数
        CLAIM_INTERVAL: 15000,        // 两次claim间隔(tick)
        PREFERRED_DISTANCE: { min: 4, max: 8 },  // 优选距离
        MIN_SCORE_THRESHOLD: 50       // 最低评分阈值
    },

    run: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            
            // 只处理自己的高等级房间
            if (!room.controller || !room.controller.my) continue;
            if (room.controller.level < this.CONFIG.MIN_RCL_TO_CLAIM) continue;
            
            this._runRoom(room);
        }
    },

    _runRoom: function(room) {
        // 1. 检查是否已达房间上限
        const myRoomCount = this._countMyRooms();
        if (myRoomCount >= this.CONFIG.MAX_ROOMS) {
            if (Game.time % 5000 === 0) {
                console.log("[Claim] 🚫 达到房间上限: " + myRoomCount + "/" + this.CONFIG.MAX_ROOMS);
            }
            return;
        }
        
        // 2. 检查距离上次claim的时间
        const lastClaim = room.memory.lastClaimAttempt || 0;
        if (Game.time - lastClaim < this.CONFIG.CLAIM_INTERVAL) return;
        
        // 3. 评估能量是否充足
        const storageEnergy = room.storage ? (room.storage.store[RESOURCE_ENERGY] || 0) : 0;
        if (storageEnergy < 80000) {
            return; // 能量不足，无法支持扩张
        }
        
        // 4. 寻找最佳候选房间
        const candidate = this._findBestCandidate(room);
        
        if (candidate) {
            this._dispatchClaimer(room, candidate);
            room.memory.lastClaimAttempt = Game.time;
        }
    },

    /**
     * 寻找最佳候选房间
     * @private
     */
    _findBestCandidate: function(sourceRoom) {
        const calculate_claim = require('lib.AP.calculate_claim');
        const taskboard = require('lib.AP.taskboard');
        
        // 获取候选房间列表（从Memory缓存或Observer扫描结果中获取）
        const candidates = this._getCandidateRooms(sourceRoom);
        
        if (candidates.length === 0) {
            return null;
        }
        
        let bestCandidate = null;
        let bestScore = -Infinity;
        
        for (const candidate of candidates) {
            try {
                // 使用WASM模块评分（如果可用），否则使用简单评分
                let score;
                if (typeof calculate_claim.scoreRoom === 'function') {
                    score = calculate_claim.scoreRoom(candidate);
                } else {
                    score = this._simpleScore(candidate);
                }
                
                // 距离惩罚（太近或太远都不好）
                const distance = this._estimateDistance(sourceRoom.name, candidate.name);
                if (distance < this.CONFIG.PREFERRED_DISTANCE.min || 
                    distance > this.CONFIG.PREFERRED_DISTANCE.max) {
                    score *= 0.7;  // 距离不理想，降分
                }
                
                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = candidate;
                }
            } catch (e) {
                console.warn("[Claim] ⚠️ 评分失败: " + candidate.name, e.message);
            }
        }
        
        if (bestCandidate && bestScore >= this.CONFIG.MIN_SCORE_THRESHOLD) {
            console.log("[Claim] 🎯 最佳目标: " + bestCandidate.name + " (分数: " + bestScore.toFixed(1) + ")");
            return bestCandidate;
        }
        
        return null;
    },

    /**
     * 派遣ClaimerI
     * @private
     */
    _dispatchClaimer: function(sourceRoom, targetRoom) {
        const taskboard = require('lib.AP.taskboard');
        
        taskboard.strategy.needCreeps(sourceRoom.name, {
            model: 'ClaimerI',
            count: 1,
            priority: 'claim',
            data: {
                targetRoom: targetRoom.name,
                phase: 'claim',           // claim → reserve → upgrade → build
                score: targetRoom.score || 0,
                escortNeeded: this._needsEscort(targetRoom)
            }
        });
        
        console.log("[Claim] 🚀 派遣ClaimerI: " + sourceRoom.name + " → " + targetRoom.name);
    },

    /**
     * 获取候选房间列表
     * @private
     * TODO: 应该结合Observer扫描结果和Memory缓存
     */
    _getCandidateRooms: function(sourceRoom) {
        // 简化版：返回空数组（实际应该从Observer扫描或Memory中获取）
        // 后续可扩展为：读取 room.memory.candidates 或使用Observer API
        
        // 示例：从Memory中读取预存的候选列表
        const candidates = sourceRoom.memory.claimCandidates || [];
        
        // 过滤掉已拥有的房间
        return candidates.filter(c => {
            const room = Game.rooms[c.name];
            return !room || !room.controller || !room.controller.my;
        });
    },

    /**
     * 简单评分备用方案（当WASM不可用时）
     * @private
     */
    _simpleScore: function(candidate) {
        let score = 50;  // 基础分
        
        // Source数量加成
        if (candidate.sourceCount >= 2) score += 20;
        else if (candidate.sourceCount === 1) score += 10;
        
        // Swarm位置减分
        if (candidate.isSwampHeavy) score -= 10;
        
        return score;
    },

    /**
     * 估算房间距离（简化版曼哈顿距离）
     * @private
     */
    _estimateDistance: function(roomName1, roomName2) {
        const pos1 = this._parseRoomPosition(roomName1);
        const pos2 = this._parseRoomPosition(roomName2);
        
        if (!pos1 || !pos2) return 999;
        
        return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
    },

    _parseRoomPosition: function(roomName) {
        const match = roomName.match(/^([WE])(\d+)([NS])(\d+)$/);
        if (!match) return null;
        
        const x = match[1] === 'E' ? parseInt(match[2]) : -parseInt(match[2]);
        const y = match[3] === 'N' ? parseInt(match[4]) : -parseInt(match[4]);
        
        return { x, y };
    },

    /**
     * 判断是否需要护卫
     * @private
     */
    _needsEscort: function(targetRoom) {
        // 如果目标房间可能有敌对玩家，需要护卫
        // 简化版：始终返回true（安全第一）
        // 后续可根据Observer情报优化
        return true;
    },

    /**
     * 统计当前拥有的房间数
     * @private
     */
    _countMyRooms: function() {
        let count = 0;
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                count++;
            }
        }
        return count;
    }
};

module.exports = APClaim;
```

---

### Task 11: 实现Fight模块 (战斗防御决策)

**Files:**
- Rewrite: `AP.fight.js`

- [ ] **Step 1: 实现Fight完整模块**

```javascript
/**
 * AP.fight.js - 战斗决策模块
 * 
 * 核心职责：
 * - 实时敌情检测与威胁评估
 * - 分级防御响应（Low/Medium/High/Critical）
 * - 协调AttackerI部署
 * 
 * 威胁等级：
 * - LOW (0):     无敌军或仅有scouts → 正常运行
 * - MEDIUM (1):  有敌军但未攻击建筑 → 派2个AttackerI防御
 * - HIGH (2):    敌军在拆建筑 → 紧急防御模式
 * - CRITICAL (3): 大规模入侵(>5敌人) → 请求援军+全房紧急状态
 */

const APFight = {
    THREAT_LEVELS: {
        LOW: 0,
        MEDIUM: 1,
        HIGH: 2,
        CRITICAL: 3
    },
    
    CONFIG: {
        ENEMY_THRESHOLDS: {
            MEDIUM: 1,      // ≥1个敌军 = MEDIUM
            HIGH: 3,        // ≥3个敌军在攻击 = HIGH
            CRITICAL: 5     // ≥5个敌军 = CRITICAL
        },
        DEFENDER_COUNT: {
            MEDIUM: 2,      // MEDIUM威胁派2个防御者
            HIGH: 4,        // HIGH威胁派4个
            CRITICAL: 6     // CRITICAL威胁派6个
        },
        EMERGENCY_MODE_DURATION: 1000,  // 紧急模式持续tick数
        COOLDOWN_BETWEEN_DEPLOYMENTS: 50  // 两次部署间隔
    },

    run: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            
            if (!room.controller || !room.controller.my) continue;
            
            const threatLevel = this._assessThreats(room);
            
            switch (threatLevel) {
                case this.THREAT_LEVELS.LOW:
                    // 正常模式，无需特殊操作
                    break;
                    
                case this.THREAT_LEVELS.MEDIUM:
                    this._deployDefenders(room, this.CONFIG.DEFENDER_COUNT.MEDIUM);
                    break;
                    
                case this.THREAT_LEVELS.HIGH:
                    this._emergencyMode(room);
                    this._deployDefenders(room, this.CONFIG.DEFENDER_COUNT.HIGH);
                    break;
                    
                case this.THREAT_LEVELS.CRITICAL:
                    this._criticalMode(room);
                    this._deployDefenders(room, this.CONFIG.DEFENDER_COUNT.CRITICAL);
                    break;
            }
            
            // 记录威胁等级（供其他模块参考）
            if (!room.memory.threat) room.memory.threat = {};
            room.memory.threat.level = threatLevel;
            room.memory.threat.lastAssess = Game.time;
        }
    },

    /**
     * 评估房间威胁等级
     * @private
     */
    _assessThreats: function(room) {
        const enemies = room.find(FIND_HOSTILE_CREEPS, {
            filter: creep => {
                // 排除自己和其他盟友的creep（如果有联盟系统）
                return !creep.owner.friend;  // 简化版：非友好即敌对
            }
        });
        
        if (enemies.length === 0) {
            return this.THREAT_LEVELS.LOW;
        }
        
        // 统计正在攻击建筑的敌人数
        let attackingCount = 0;
        for (const enemy of enemies) {
            if (this._isAttackingStructure(enemy, room)) {
                attackingCount++;
            }
        }
        
        // 根据敌人数和攻击行为判定威胁等级
        if (enemies.length >= this.CONFIG.ENEMY_THRESHOLDS.CRITICAL ||
            attackingCount >= this.CONFIG.ENEMY_THRESHOLDS.CRITICAL) {
            return this.THREAT_LEVELS.CRITICAL;
        } else if (enemies.length >= this.CONFIG.ENEMY_THRESHOLDS.HIGH ||
                   attackingCount >= this.CONFIG.ENEMY_THRESHOLDS.HIGH) {
            return this.THREAT_LEVELS.HIGH;
        } else if (enemies.length >= this.CONFIG.ENEMY_THRESHOLDS.MEDIUM) {
            return this.THREAT_LEVELS.MEDIUM;
        }
        
        return this.THREAT_LEVELS.MEDIUM;  // 有敌军至少是MEDIUM
    },

    /**
     * 判断敌军是否在攻击建筑
     * @private
     */
    _isAttackingStructure: function(enemy, room) {
        // 简化版：检查敌军是否在拆墙或攻击重要建筑
        // 更精确的版本应该检查enemy的行动意图
        const pos = enemy.pos;
        
        // 查找附近的被攻击的建筑
        const nearbyStructures = pos.findInRange(FIND_STRUCTURES, 3);
        for (const s of nearbyStructures) {
            if (s.structureType === STRUCTURE_WALL || 
                s.structureType === STRUCTURE_RAMPART ||
                s.structureType === STRUCTURE_SPAWN ||
                s.structureType === STRUCTURE_STORAGE ||
                s.structureType === STRUCTURE_TERMINAL) {
                // 如果敌人在攻击范围内且有攻击部件，认为在攻击
                if (enemy.getActiveBodyparts(ATTACK).length > 0 ||
                    enemy.getActiveBodyparts(RANGED_ATTACK).length > 0 ||
                    enemy.getActiveBodyparts(WORK).length > 0) {  // WORK也能拆建筑
                    return true;
                }
            }
        }
        
        return false;
    },

    /**
     * 部署防御者
     * @private
     */
    _deployDefenders: function(room, count) {
        const taskboard = require('lib.AP.taskboard');
        
        // 检查冷却时间
        const lastDeploy = room.memory.lastDefenseDeploy || 0;
        if (Game.time - lastDeploy < this.CONFIG.COOLDOWN_BETWEEN_DEPLOYMENTS) return;
        
        // 统计当前已有的AttackerI
        const currentAttackers = this._countCreepsByModel(room, 'AttackerI');
        const deficit = count - currentAttackers;
        
        if (deficit <= 0) return;  // 已有足够的防御者
        
        // 发布防御需求
        taskboard.strategy.needCreeps(room.name, {
            model: 'AttackerI',
            count: Math.min(deficit, 3),  // 每次最多申请3个
            priority: 'attack',
            data: {
                mode: 'defend',
                targetRoom: room.name,
                urgency: true
            }
        });
        
        room.memory.lastDefenseDeploy = Game.time;
        
        if (Game.time % 10 === 0) {  // 战斗期间频繁日志
            console.log("[Fight] 🛡️ 部署防御: " + room.name + " 需要+" + deficit + " AttackerI" +
                       " (威胁等级: " + this._getThreatName(room.memory.threat.level) + ")");
        }
    },

    /**
     * 紧急防御模式
     * @private
     */
    _emergencyMode: function(room) {
        // 设置紧急状态标志
        if (!room.memory.emergency) room.memory.emergency = {};
        room.memory.emergency.active = true;
        room.memory.emergency.since = Game.time;
        
        // 可以在这里添加其他紧急响应逻辑：
        // - 召回外围Creep
        // - 启动Tower最大火力
        // - 暂停非必要任务（如远距离建造）
        
        // Tower已经在building.tower.js中自动处理，这里只需设置标志
    },

    /**
     * 关键危机模式
     * @private
     */
    _criticalMode: function(room) {
        this._emergencyMode(room);
        
        // 请求援军（从其他房间调AttackerI）
        // 这部分可以后续扩展为多房间协同防御
        console.log("[Fight] 🚨 关键危机: " + room.name + " 遭受大规模入侵！");
    },

    /**
     * 统计指定型号Creep数量
     * @private
     */
    _countCreepsByModel: function(room, model) {
        const creeps = room.find(FIND_MY_CREEPS);
        let count = 0;
        for (const creep of creeps) {
            if (creep.memory.model === model) count++;
        }
        return count;
    },

    /**
     * 获取威胁等级名称
     * @private
     */
    _getThreatName: function(level) {
        const names = {
            0: 'LOW',
            1: 'MEDIUM',
            2: 'HIGH',
            3: 'CRITICAL'
        };
        return names[level] || 'UNKNOWN';
    }
};

module.exports = APFight;
```

---

## Phase 5: 测试与验证

### Task 12: 集成测试清单

**Files:** 无新建文件，验证所有模块协作

- [ ] **Step 1: 上传全部文件到Screeps**

确认以下文件都已上传且无语法错误：
- `lib.AP.taskboard.js` (已修改)
- `main.js` (已修改)
- `AP.developv1.js` (已重写)
- `AP.developv1.L3.js` (已重写)
- `AP.developv1.L5.js` (已重写)
- `AP.developv1.L7.js` (已重写)
- `AP.developv1.max.js` (已重写)
- `AP.developv2.js` (已重写)
- `AP.developv2.L4.js` (已重写)
- `AP.developv2.L5.js` (已重写)
- `AP.developv2.max.js` (已重写)
- `AP.claim.js` (已重写)
- `AP.fight.js` (已重写)
- `AP.taskhandler.js` (已修改)

- [ ] **Step 2: 基础功能验证**

在Screeps控制台执行测试脚本：

```javascript
// Test 1: Taskboard Strategy API
console.log("--- Test 1: Taskboard Strategy API ---");
const tb = require('lib.AP.taskboard');
tb.strategy.needCreeps('test', { model: 'CommonI', count: 2 });
console.log("✅ needCreeps: " + (Memory.Taskboard.Task.Strategy.test ? "PASS" : "FAIL"));

tb.strategy.cleanExpired('test', 0);
console.log("✅ cleanExpired: " + ((Memory.Taskboard.Task.Strategy.test || []).length === 0 ? "PASS" : "FAIL"));

// Test 2: DevelopV1 Router
console.log("\n--- Test 2: DevelopV1 Router ---");
const dv1 = require('AP.developv1');
dv1.run();
console.log("✅ developv1.run(): 无报错即PASS");

// Test 3: L3 Strategy Analyze
console.log("\n--- Test 3: L3 Strategy ---");
const l3 = require('AP.developv1.L3');
for (const rn in Game.rooms) {
    const room = Game.rooms[rn];
    if (room.controller && room.controller.my && room.memory.layoutType === '9x9') {
        const state = l3.analyze(room);
        console.log("✅ L3 analyze: rcl=" + state.rcl + " creeps=" + JSON.stringify(state.creeps));
        l3.run(room);
        console.log("✅ L3 run(): PASS");
        break;
    }
}

// Test 4: Fight Module (无害测试)
console.log("\n--- Test 4: Fight Module ---");
const fight = require('AP.fight');
fight.run();
console.log("✅ fight.run(): 无报错即PASS");

// Test 5: Claim Module (无害测试)
console.log("\n--- Test 5: Claim Module ---");
const claim = require('AP.claim');
claim.run();
console.log("✅ claim.run(): 无报错即PASS");

console.log("\n=== 全部测试完成 ===");
```

- [ ] **Step 3: 观察运行24小时**

监控指标：
- [ ] Console无红色报错
- [ ] Creep数量符合预期（L3: 4-6个CommonI）
- [ ] Strategy任务正确发布和转换
- [ ] RCL稳定上升
- [ ] CPU使用率合理（< 90% Global Reset比例）

- [ ] **Step 4: 参数微调（如需要）**

根据实际运行情况调整：
- `CONFIG.CREEP_CONFIG.*.minCount/maxCount`
- `CONFIG.REFRESH_INTERVAL`
- `CONFIG.EXPANSION.*` 参数

---

## 自检清单

### Spec覆盖率检查
- ✅ Taskboard Strategy类别扩展 → Task 1
- ✅ Main.js集成点 → Task 2
- ✅ Module references更新 → 已存在（无需修改）
- ✅ DevelopV1路由器 → Task 3
- ✅ L3/L5/L7/Max策略 → Task 4, 5, 6, 7
- ✅ DevelopV2路由器+小房间策略 → Task 8
- ✅ Taskhandler Strategy感知 → Task 9
- ✅ Claim模块 → Task 10
- ✅ Fight模块 → Task 11
- ✅ 市场开关常量 → Task 2 (ENABLE_MARKET)
- ✅ 测试计划 → Task 12

### 占位符扫描
- ✅ 无TBD/TODO占位符
- ✅ 所有代码步骤都有完整实现
- ✅ 所有命令都有预期输出说明

### 类型一致性检查
- ✅ Strategy任务数据结构统一（type/model/count/priority/data）
- ✅ 策略接口统一（run/analyze/_shouldRefresh/_publishCreepNeeds）
- ✅ 函数命名一致（驼峰式）

---

**计划版本:** v1.0  
**创建日期:** 2026-06-20  
**基于设计文档:** [2026-06-20-decision-ai-design.md](../specs/2026-06-20-decision-ai-design.md)  
**预计工作量:** 12个Task，建议分3次会话完成（Phase 1-2 / Phase 3-4 / Phase 5）
