# Screeps AI - 全局决策AI设计文档

**日期**: 2026-06-20
**状态**: ✅ 已批准，待实施
**优先级**: P0 (核心功能)

---

## 1. 概述

### 1.1 目标
实现全局决策AI系统（AP.develop*/claim/fight），作为Screeps AI的"战略大脑"，负责：
- Creep数量与型号配置决策
- 资源分配与市场策略
- 房间占领扩张决策
- 战斗防御响应

### 1.2 核心原则
- **每个房间独立运行AI实例**（全局AI仅限单房间，但可跨房间运资源）
- **通过Taskboard发布Strategy任务**解耦决策层和执行层
- **按RCL等级分层策略**（L3→L5→L7→Max渐进式发展）
- **因地制宜**：v1=大房间(9x9模板)，v2=小房间(5x5模板)
- **先做Demo能跑，后期微调参数**

### 1.3 架构层次

```
┌─────────────────────────────────────────────┐
│              全局决策AI (新增)                │
│   AP.developv1/v2 | AP.claim | AP.fight     │
│         ↓ 发布 Strategy 任务                 │
├─────────────────────────────────────────────┤
│              基层执行层 (已有)                │
│   AP.taskhandler | AP.autobuild | unibot    │
│         ↓ 执行 Creep/Building 任务           │
└─────────────────────────────────────────────┘
```

---

## 2. Taskboard扩展

### 2.1 新增Strategy类别

```javascript
// lib.AP.taskboard.js 修改
Memory.Taskboard.Task = {
  Creeps: {},    // 现有：执行层任务
  Buildings: {}, // 现有：建筑层任务
  Strategy: {}   // 新增：决策层需求
}
```

### 2.2 Strategy任务数据结构

```javascript
{
  id: 'strat_xxx',
  type: 'need_creeps',           // 需求类型 [枚举]
  model: 'CommonI',             // Creep型号
  count: 3,                     // 需要数量
  priority: 'harvest',          // 优先级
  roomName: 'W1N1',            // 目标房间
  takenBy: null,                // 处理者（taskhandler）
  data: {                       // 附加参数
    minBodySize: 6,
    enableBoost: false,
    sourceRoom: 'W1N1'
  },
  createdAt: Game.time,
  refreshInterval: 100          // 刷新周期
}
```

### 2.3 Strategy任务类型枚举

| type | 说明 | data字段 |
|------|------|----------|
| `need_creeps` | 需要Creep | model, count, priority, bodySize, enableBoost |
| `market_action` | 市场操作 | action(sell/buy), resource, amount |
| `lab_production` | Lab生产 | compound, targetAmount |
| `expansion_action` | 扩张行动 | action(scout/claim), targetRoom |

---

## 3. Main.js集成

### 3.1 插入点

在步骤1(memcleaner)和步骤3(taskhandler)之间插入：

```javascript
// main.js
module.exports.loop = function () {
    // 0. 初始化
    if (!Game.tasksender) Game.tasksender = require('User.tasksender');

    // 1. 系统维护
    modules.memcleaner.run();

    // 2. 【新增】全局决策AI
    modules.develop.run();     // ← developv1/v2路由器
    modules.claim.run();       // ← 占领决策
    modules.fight.run();       // ← 战斗决策

    // 3. 任务处理器（感知Strategy任务）
    modules.taskhandler.run();

    // 4-6. 后续不变...
};
```

### 3.2 module.references.js 更新

```javascript
// 新增三个模块引用
develop: { module: 'AP.developv1' },      // 路由器自动选v1或v2
claim: { module: 'AP.claim' },
fight: { module: 'AP.fight' },
```

---

## 4. DevelopV1/V2 路由器

### 4.1 AP.developv1.js (大房间9x9)

```javascript
/**
 * 根据RCL选择策略文件：
 * RCL 3 → L3.js
 * RCL 4-5 → L5.js
 * RCL 6-7 → L7.js
 * RCL 8 → max.js
 */

const strategyCache = {};

function getStrategy(rcl) {
    const key = 'v1_' + rcl;
    if (!strategyCache[key]) {
        const strategyMap = {
            3: require('AP.developv1.L3'),
            5: require('AP.developv1.L5'),
            7: require('AP.developv1.L7'),
            8: require('AP.developv1.max')
        };
        let targetRcl = rcl;
        while (targetRcl >= 3 && !strategyMap[targetRcl]) {
            targetRcl -= 2;
        }
        strategyCache[key] = strategyMap[targetRcl] || require('AP.developv1.L3');
    }
    return strategyCache[key];
}

const DevelopV1 = {
    run: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;
            if (room.memory.layoutType !== '9x9') continue;  // 只处理大房间

            const strategy = getStrategy(room.controller.level);
            strategy.run(room);
        }
    }
};

module.exports = DevelopV1;
```

### 4.2 AP.developv2.js (小房间5x9)

类似v1，但：
- 检查条件改为 `layoutType === '5x5'`
- 加载 `AP.developv2.L4 / .L5 / .max`
- Creep配置更精简（小地图不需要那么多creep）

---

## 5. 策略文件接口规范

### 5.1 统一导出接口

所有 `.Lx` 文件必须导出：

```javascript
const Strategy_Lx = {
    // 必须实现
    run(room),           // 主函数（每tick调用）
    analyze(room),       // 返回房间状态快照

    // 可选实现
    _shouldRefresh(room, interval),  // 刷新控制
    _publishCreepNeeds(room, state), // 发布Creep需求
    _handleEmergencies(room, state)  // 紧急响应
};

module.exports = Strategy_Lx;
```

### 5.2 analyze() 返回值结构

```javascript
{
    rcl: number,                    // 房间等级
    energyAvailable: number,        // 当前可用能量
    energyCapacity: number,         // 能量容量上限
    storage: number,                // Storage能量(无则0)
    creeps: {                       // 各型号当前数量
        CommonI: number,
        CarrierI: number,
        AttackerI: number,
        ClaimerI: number
    },
    constructionSites: number,      // 工地数量
    controllerProgress: number,     // 控制器进度(0-1)
    labCount: number,               // Lab数量
    terminalAvailable: boolean,     // 是否有Terminal
    threats: Array                  // 敌情信息
}
```

---

## 6. RCL分级策略详情

### 6.1 L3 策略 (RCL 3, 大房间早期)

**阶段特征：**
- 无Storage（RCL4才能建）
- 无Container（模板未包含）
- CommonI自带CARRY自己运输
- 能量来源仅Source

**Creep配置：**
```javascript
{
  CommonI: {
    minCount: 4,           // 至少4个通用工人
    maxCount: 6,           // 最多6个
    bodySize: 'small',     // 小body (200-450 energy)
    priorities: ['harvest', 'upgrade', 'build', 'repair'],
    ratio: { harvest: 50, upgrade: 25, build: 15, repair: 10 }
  }
  // 注意：L3不需要CarrierI！
}
```

**刷新间隔：** 50 ticks

---

### 6.2 L5 策略 (RCL 5, 大房间中期)

**阶段特征：**
- 有Storage，能量经济稳定
- 可建造Lab、Terminal
- 开始资源多样化

**Creep配置：**
```javascript
{
  CommonI: {
    minCount: 3,           // 减少数量，增大个体
    maxCount: 5,
    bodySize: 'medium',    // 中等body (550-700 energy)
    priorities: ['harvest', 'build', 'upgrade', 'repair', 'carry']
  },
  CarrierI: {
    minCount: 2,           // Storage需要专职运输
    maxCount: 4,
    bodySize: 'medium',
    priorities: ['carry', 'globalcarry']  // 支持跨房间
  }
}
```

**新增能力：**
- 资源管理（市场卖出多余资源）
- 跨房间运输需求
- Lab基础生产准备

**刷新间隔：** 100 ticks

**市场开关：**
```javascript
const ENABLE_MARKET = false;  // 赛季模式通常关闭
```

---

### 6.3 L7 策略 (RCL 7, 大房间后期)

**阶段特征：**
- 所有高级建筑就绪（Labx6, Terminal, Factory）
- 可Boost Creep
- 精简高效模式

**Creep配置：**
```javascript
{
  CommonI: {
    minCount: 2,           // 精简到2个大块头
    maxCount: 3,
    bodySize: 'large',     // 大body (700-850 energy)
    enableBoost: true,     // 开启boost！
    boostResource: 'XUH2O' // WORK boost
  },
  CarrierI: {
    minCount: 3,
    maxCount: 5,
    bodySize: 'large',
    enableBoost: true,
    boostResource: 'XKH2O'
  },
  AttackerI: {             // 新增防御需求
    minCount: 0,
    maxCount: 3,
    bodySize: 'large',
    enableBoost: true
  }
}
```

**新增能力：**
- Boost生产管理（Lab配方调度）
- 高级资源优化
- 基础防御协调

**刷新间隔：** 150 ticks

---

### 6.4 Max 策略 (RCL 8, 终极形态)

**阶段特征：**
- 所有建筑满级
- GCL增长 + 房间扩张
- 经济最优化

**Creep配置：**
```javascript
{
  CommonI: { minCount: 2, maxCount: 3, bodySize: 'max', enableBoost: true },
  CarrierI: { minCount: 4, maxCount: 6, bodySize: 'max', enableBoost: true },
  AttackerI: { minCount: 2, maxCount: 4, bodySize: 'max', enableBoost: true },
  ClaimerI: { minCount: 0, maxCount: 2, bodySize: 'large' }  // 准备扩张
}
```

**新增能力：**
- 自动扩张评估（Claim模块配合）
- 经济最优化算法
- 多房间协调

**刷新间隔：** 200 ticks

---

## 7. Claim模块 (AP.claim.js)

### 7.1 核心职责
- 评估候选房间价值（使用lib.AP.calculate_claim WASM评分）
- 决定何时发送ClaimerI
- 协调占领流程：scout → reserve → claim → build

### 7.2 触发条件
- 仅RCL 7+房间才启动claim逻辑
- 控制房间数量不超过上限（默认8个）
- 两次claim间隔至少15k ticks

### 7.3 输出
发布Strategy任务：
```javascript
{
  type: 'need_creeps',
  model: 'ClaimerI',
  count: 1,
  priority: 'claim',
  data: {
    targetRoom: 'E5N3',
    phase: 'claim',         // claim → reserve → upgrade → build
    escortNeeded: true
  }
}
```

---

## 8. Fight模块 (AP.fight.js)

### 8.1 核心职责
- 实时敌情检测与威胁评估
- 分级防御响应（Low/Medium/High/Critical）
- 协调AttackerI部署

### 8.2 威胁等级定义

| Level | 条件 | 响应 |
|-------|------|------|
| LOW (0) | 无敌军或仅有scouts | 正常运行 |
| MEDIUM (1) | 有敌军但未攻击建筑 | 派2个AttackerI防御 |
| HIGH (2) | 敌军在拆建筑 | 紧急防御模式 |
| CRITICAL (3) | 大规模入侵(>5敌人) | 请求援军+全房紧急状态 |

### 8.3 输出
根据威胁等级发布Strategy任务：
```javascript
{
  type: 'need_creeps',
  model: 'AttackerI',
  count: 2,
  priority: 'attack',
  data: {
    mode: 'defend',
    targetRoom: 'W1N1',
    urgency: true
  }
}
```

---

## 9. Taskhandler集成

### 9.1 感知Strategy任务

在`AP.taskhandler.js`中增加对Strategy任务的读取：

```javascript
// 在run()开头添加
this._processStrategyTasks();

_processStrategyTasks: function() {
    if (!Memory.Taskboard || !Memory.Taskboard.Task.Strategy) return;

    for (const roomName in Memory.Taskboard.Task.Strategy) {
        const tasks = Memory.Taskboard.Task.Strategy[roomName];
        if (!tasks) continue;

        for (const task of tasks) {
            if (task.takenBy) continue;  // 已被处理

            switch (task.type) {
                case 'need_creeps':
                    this._handleNeedCreeps(task);
                    break;
                case 'market_action':
                    if (ENABLE_MARKET) this._handleMarketAction(task);
                    break;
                case 'lab_production':
                    this._handleLabProduction(task);
                    break;
            }

            task.takenBy = 'taskhandler';  // 标记已处理
        }
    }
}
```

### 9.2 Strategy→执行转换示例

```javascript
_handleNeedCreeps: function(strategyTask) {
    const currentCount = this._countCreepsByModel(
        strategyTask.roomName,
        strategyTask.model
    );

    const needCount = Math.max(0, strategyTask.count - currentCount);

    if (needCount > 0) {
        // 转换为具体的Spawn任务到Buildings类别
        for (let i = 0; i < needCount; i++) {
            taskboard.addTask(strategyTask.roomName, 'Buildings', {
                type: 'spawn',
                model: strategyTask.model,
                priority: strategyTask.priority,
                data: strategyTask.data
            });
        }
    }
}
```

---

## 10. 文件清单

### 10.1 需要新建/重写的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `AP.developv1.js` | 重写 | 大房间路由器 |
| `AP.developv1.L3.js` | 重写 | RCL3策略 |
| `AP.developv1.L5.js` | 重写 | RCL5策略 |
| `AP.developv1.L7.js` | 重写 | RCL7策略 |
| `AP.developv1.max.js` | 重写 | RCL8 Max策略 |
| `AP.developv2.js` | 重写 | 小房间路由器 |
| `AP.developv2.L4.js` | 重写 | RCL4策略(小) |
| `AP.developv2.L5.js` | 重写 | RCL5策略(小) |
| `AP.developv2.max.js` | 重写 | Max策略(小) |
| `AP.claim.js` | 重写 | 占领决策 |
| `AP.fight.js` | 重写 | 战斗决策 |

### 10.2 需要修改的现有文件

| 文件 | 修改内容 |
|------|---------|
| `main.js` | 步骤2插入develop/claim/fight调用 |
| `module.references.js` | 新增3个模块引用 |
| `lib.AP.taskboard.js` | 新增Strategy任务类别支持 |
| `AP.taskhandler.js` | 新增_processStrategyTasks()感知逻辑 |

---

## 11. 常量配置

```javascript
// 全局常量（建议放在单独config文件或各模块顶部）
const CONFIG = {
    MARKET: {
        ENABLED: false  // 赛季模式通常关闭
    },
    EXPANSION: {
        MAX_ROOMS: 8,
        CLAIM_INTERVAL: 15000,
        MIN_RCL_TO_CLAIM: 7
    },
    DEFENSE: {
        ENEMY_THRESHOLD_LOW: 0,
        ENEMY_THRESHOLD_MEDIUM: 1,
        ENEMY_THRESHOLD_HIGH: 3,
        ENEMY_THRESHOLD_CRITICAL: 5
    },
    STRATEGY_REFRESH: {
        L3: 50,
        L5: 100,
        L7: 150,
        MAX: 200
    }
};
```

---

## 12. 实施顺序

### Phase 1: 核心框架 (MVP)
1. ✅ Taskboard扩展（新增Strategy类别）
2. ✅ Main.js集成（插入develop/claim/fight调用）
3. ✅ Module references更新
4. ✅ Developv1路由器实现
5. ✅ L3策略实现（最简单，验证架构）

### Phase 2: 完整策略
6. L5/L7/Max策略实现
7. Developv2路由器+小房间策略
8. Taskhandler Strategy感知逻辑

### Phase 3: 高级功能
9. Claim模块实现
10. Fight模块实现
11. 参数调优与测试

---

## 13. 测试计划

### 13.1 单元测试
- [ ] 策略路由器RCL映射正确性
- [ ] analyze()返回值完整性
- [ ] Strategy任务数据结构校验

### 13.2 集成测试
- [ ] L3策略发布need_creeps任务
- [ ] Taskhandler正确感知并转换Strategy任务
- [ ] Claim模块触发条件和输出验证
- [ ] Fight模块威胁评估准确性

### 13.3 季节测试
- [ ] 在赛季世界运行24小时
- [ ] 观察Creep数量是否合理
- [ ] 验证RCL升级速度
- [ ] 检查CPU使用率

---

## 14. 已知限制与后续优化

### 14.1 当前限制
- [ ] 市场系统默认关闭（赛季限制）
- [ ] Nuker暂无调用逻辑（待补充）
- [ ] Factory产品映射需核对官方配方
- [ ] 任务超时机制未实现

### 14.2 后续优化方向
- [ ] 动态参数自调整（基于历史数据机器学习）
- [ ] 多房间资源调配优化算法
- [ ] 战斗策略进化（反击/骚扰/攻坚）
- [ ] Observer自动化侦察网络

---

## 15. 设计决策记录

### 为什么选择Strategy任务模式而非Memory参数？
- **解耦**：决策层和执行层通过Taskboard松耦合
- **可观测**：所有决策都记录在Taskboard中，易于调试
- **灵活性**：可以多个决策模块同时发布需求，taskhandler统一调度
- **扩展性**：未来新增决策类型只需添加新的Strategy任务类型

### 为什么L3不需要CarrierI？
- RCL 3无Storage（需要RCL 4）
- 建筑模板未包含Container
- CommonI自带CARRY部件，采集后自己运回 Spawn/Extension
- 符合Screeps早期游戏常见策略

### 为什么市场做成常量开关？
- Screeps赛季模式通常禁用Market
- 避免代码中出现大量if判断
- 简化逻辑，降低CPU消耗
- 不需要频繁修改（赛季期间保持关闭即可）

---

**文档版本**: v1.0
**最后更新**: 2026-06-20
**审批状态**: ✅ 用户已批准
