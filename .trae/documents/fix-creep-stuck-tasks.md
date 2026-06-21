# 修复 Creep 接了任务但不移动的问题

## 问题分析

### 根本原因

通过代码审查，发现以下关键问题导致 creep 接了任务但不移动：

#### 1. autoAssign 失败时直接返回（无日志）
- **位置**：`task.creep.harvest.js:30-32`, `task.creep.build.js:24`, `task.creep.upgrade.js:23`
- **问题**：当 autoAssign 找不到可用源时，直接 `return`，没有任何日志输出
- **影响**：creep 接了任务但无法开始工作，用户看不到任何错误信息

#### 2. 任务数据不完整导致直接返回
- **位置**：`task.creep.harvest.js:36`, `task.creep.build.js:29`, `task.creep.upgrade.js:28`
- **问题**：如果 `data.sourceId` 或 `data.targetId` 为空，直接 `return`
- **影响**：creep 接了任务但无法执行任何操作

#### 3. Harvest 任务没有存储目标时卡住
- **位置**：`task.creep.harvest.js:155-189`
- **问题**：当 `targetId === 'base'` 时，如果所有建筑都满了，creep 会一直等待
- **影响**：收获者没有地方存能量，无法完成采集循环

#### 4. 缺少备用方案
- **位置**：所有任务模块的 autoAssign 逻辑
- **问题**：找不到可用源时没有备用方案
- **影响**：任务被分配但无法执行

## 修复方案

### 修复 1：Harvest 任务 - autoAssign 失败时提供备用方案

**文件**：`task.creep.harvest.js`

**修改位置**：第 18-34 行

**修改内容**：
```javascript
// autoAssign: 动态分配 source 和 target
if (data.autoAssign) {
    const sources = creep.room.find(FIND_SOURCES);
    // 优先选择能量剩余多且槽位空闲的 source
    let bestSource = null;
    let bestScore = -1;
    for (const src of sources) {
        const nearbyCreeps = src.pos.findInRange(FIND_MY_CREEPS, 1, { filter: c => c.memory.taskType === 'harvest' }).length;
        const score = src.energy - nearbyCreeps * 100;
        if (score > bestScore) { bestScore = score; bestSource = src; }
    }

    if (bestSource) {
        creep.memory.taskData = { sourceId: bestSource.id, targetId: 'base' };
    } else {
        // 【新增】如果没有可用 source，尝试使用默认 source（第一个 source）
        if (sources.length > 0) {
            console.log("[Harvest] ⚠️  autoAssign 失败，使用默认 source: " + sources[0].id);
            creep.memory.taskData = { sourceId: sources[0].id, targetId: 'base' };
        } else {
            // 【新增】如果没有 source，清理任务并返回
            console.log("[Harvest] ❌ 房间没有能量源，清理任务: " + creep.name);
            taskHelper.completeTask(creep);
            return;
        }
    }
    return this.run(creep); // 用新 data 重新执行
}
```

**修改位置**：第 155-189 行（base 存储逻辑）

**修改内容**：
```javascript
// 4. 没有容器时的原有逻辑：送往base或指定目标
if (targetId === 'base') {
    var target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: function(s) {
            return (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
                   s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
    });

    if (target) {
        var result2 = creep.transfer(target, RESOURCE_ENERGY);
        if (result2 === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
        } else if (result2 === OK) {
            taskHelper.completeTask(creep);
        }
    } else {
        // 【新增】base 满了，尝试寻找其他存储目标
        var fallback = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: function(s) {
                return (s.structureType === STRUCTURE_CONTAINER ||
                        s.structureType === STRUCTURE_STORAGE ||
                        s.structureType === STRUCTURE_LINK) &&
                       s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });

        if (fallback) {
            var result3 = creep.transfer(fallback, RESOURCE_ENERGY);
            if (result3 === ERR_NOT_IN_RANGE) {
                creep.moveTo(fallback, { visualizePathStyle: { stroke: '#ffffff' } });
            } else if (result3 === OK) {
                taskHelper.completeTask(creep);
            }
        } else {
            // 【新增】所有存储目标都满了，清理任务
            console.log("[Harvest] ❌ 所有存储目标都满了，清理任务: " + creep.name);
            taskHelper.completeTask(creep);
        }
    }
    return;
}
```

### 修复 2：Build 任务 - autoAssign 失败时提供备用方案

**文件**：`task.creep.build.js`

**修改位置**：第 19-27 行

**修改内容**：
```javascript
// autoAssign: 动态分配能量来源
if (data.autoAssign) {
    const source = this._findEnergySource(creep);
    if (source) {
        creep.memory.taskData = { targetId: source.id };
    } else {
        // 【新增】如果没有可用能量来源，尝试使用默认 source
        const sources = creep.room.find(FIND_SOURCES);
        if (sources.length > 0 && sources[0].energy > 0) {
            console.log("[Build] ⚠️  autoAssign 失败，使用默认 source: " + sources[0].id);
            creep.memory.taskData = { targetId: sources[0].id };
        } else {
            // 【新增】如果没有 source，清理任务并返回
            console.log("[Build] ❌ 房间没有可用能量来源，清理任务: " + creep.name);
            taskHelper.completeTask(creep);
            return;
        }
    }
    return this.run(creep);
}
```

### 修复 3：Upgrade 任务 - autoAssign 失败时提供备用方案

**文件**：`task.creep.upgrade.js`

**修改位置**：第 18-26 行

**修改内容**：
```javascript
// autoAssign: 动态分配能量来源
if (data.autoAssign) {
    const source = this._findEnergySource(creep);
    if (source) {
        creep.memory.taskData = { targetId: source.id };
    } else {
        // 【新增】如果没有可用能量来源，尝试使用默认 source
        const sources = creep.room.find(FIND_SOURCES);
        if (sources.length > 0 && sources[0].energy > 0) {
            console.log("[Upgrade] ⚠️  autoAssign 失败，使用默认 source: " + sources[0].id);
            creep.memory.taskData = { targetId: sources[0].id };
        } else {
            // 【新增】如果没有 source，清理任务并返回
            console.log("[Upgrade] ❌ 房间没有可用能量来源，清理任务: " + creep.name);
            taskHelper.completeTask(creep);
            return;
        }
    }
    return this.run(creep);
}
```

### 修复 4：添加任务数据完整性检查

**文件**：`task.creep.harvest.js`

**修改位置**：第 36 行

**修改内容**：
```javascript
if (!data.sourceId || !data.targetId) {
    console.log("[Harvest] ❌ 任务数据不完整: sourceId=" + data.sourceId + ", targetId=" + data.targetId + " (Creep: " + creep.name + ")");
    taskHelper.completeTask(creep);
    return;
}
```

**文件**：`task.creep.build.js`

**修改位置**：第 29 行

**修改内容**：
```javascript
if (!data.targetId) {
    console.log("[Build] ❌ 任务数据不完整: targetId=" + data.targetId + " (Creep: " + creep.name + ")");
    taskHelper.completeTask(creep);
    return;
}
```

**文件**：`task.creep.upgrade.js`

**修改位置**：第 28 行

**修改内容**：
```javascript
if (!data.targetId) {
    console.log("[Upgrade] ❌ 任务数据不完整: targetId=" + data.targetId + " (Creep: " + creep.name + ")");
    taskHelper.completeTask(creep);
    return;
}
```

## 验证步骤

1. **上传代码到 Screeps**
2. **观察日志输出**：
   - 如果看到 `[Harvest] ⚠️  autoAssign 失败，使用默认 source`，说明备用方案生效
   - 如果看到 `[Harvest] ❌ 所有存储目标都满了，清理任务`，说明存储逻辑修复生效
   - 如果看到 `[Harvest] ❌ 任务数据不完整`，说明数据完整性检查生效
3. **检查 creep 行为**：
   - creep 应该能够正常移动到 source
   - creep 应该能够正常存储能量
   - 如果所有存储目标都满了，creep 应该清理任务并尝试接新任务
4. **监控任务数量**：
   - 任务数量应该保持稳定
   - 不应该出现任务堆积或 creep 卡住的情况

## 预期效果

1. **Harvest 任务**：
   - autoAssign 失败时使用默认 source，而不是直接返回
   - 所有存储目标都满了时清理任务，而不是卡住
   - 任务数据不完整时清理任务并打印日志

2. **Build 任务**：
   - autoAssign 失败时使用默认 source，而不是直接返回
   - 任务数据不完整时清理任务并打印日志

3. **Upgrade 任务**：
   - autoAssign 失败时使用默认 source，而不是直接返回
   - 任务数据不完整时清理任务并打印日志

4. **整体效果**：
   - creep 接了任务后应该能够正常移动和执行
   - 如果遇到问题，会打印清晰的日志，便于诊断
   - 任务会被正确清理，不会堆积
   - creep 会尝试接新任务，而不是卡住
