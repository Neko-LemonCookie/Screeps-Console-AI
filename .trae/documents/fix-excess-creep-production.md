# 修复生产远超所需数量的 creep 的问题

## 问题分析

### 根本原因

在 `AP.taskhandler.js` 中，存在**重复计算 creep 需求**的问题：

1. **`_countValidCreeps()` 方法**（第 505-525 行）：
   - 统计了等待中的 spawn 任务
   - 将这些任务计入 `validCreeps`，例如 `validCreeps['harvest'] += 1`

2. **`_calculateCreepNeeds()` 方法**（第 391-466 行）：
   - 使用 `_countValidCreeps()` 获取有效 creep 数量
   - 计算需求：`needed = taskCounts[type] - validCreeps[type]`
   - **但是没有考虑等待中的 spawn 任务！**

### 具体问题

假设场景：
- 当前房间有 3 个空闲的 CommonI creep（harvest 类型）
- 有 5 个等待中的 spawn 任务（即将生成 5 个 CommonI creep）
- 有 2 个 harvest 任务

**当前逻辑：**
1. `_countValidCreeps()` 返回：
   - `validCreeps['harvest'] = 3`（空闲 creep）+ `5`（等待中的 spawn 任务）= **8**
2. `_calculateCreepNeeds()` 计算：
   - `taskCounts['harvest'] = 2`
   - `needed = 2 - 8 = -6`（不需要生成）
3. **但是**，如果某个 tick 没有正确统计等待中的 spawn 任务，或者统计逻辑有误，就会导致：
   - `validCreeps['harvest'] = 3`（只有空闲 creep）
   - `needed = 2 - 3 = -1`（不需要生成）
   - **但实际上应该考虑等待中的 spawn 任务，导致错误判断**

### 更严重的问题

从代码第 424-431 行可以看到，build 任务的计算逻辑：

```javascript
// 2. build: 计算建筑工地需要的能量，每 5K 对应一个 build 任务，每个任务对应一个 creep
const buildTasks = tasks.filter(t => t.type === 'build');
const buildCreepsNeeded = this._calculateBuildCreeps(room, buildTasks.length);
const currentBuildCreeps = validCreeps['build'] || 0;
const needed = Math.max(0, buildCreepsNeeded - currentBuildCreeps);
```

这里只考虑了当前房间内的 build creep，**没有考虑等待中的 spawn 任务**。

## 修复方案

### 修复 1：在 `_calculateCreepNeeds()` 中考虑等待中的 spawn 任务

**文件**：`AP.taskhandler.js`

**修改位置**：第 412 行之后

**修改内容**：
```javascript
// 统计有效 creep
const validCreeps = this._countValidCreeps(roomName);

// 【新增】考虑等待中的 spawn 任务
const existingSpawnTasks = modules.taskboard.getTasks(roomName, 'Buildings');
const waitingSpawnTasks = existingSpawnTasks.filter(t => t.type === 'spawn' && !t.takenBy);

for (const task of waitingSpawnTasks) {
    const model = task.data.model;
    switch (model) {
        case 'AttackerI':
            validCreeps['police'] = (validCreeps['police'] || 0) + 1;
            break;
        case 'CarrierI':
            validCreeps['carry'] = (validCreeps['carry'] || 0) + 1;
            break;
        case 'ClaimerI':
            validCreeps['claim'] = (validCreeps['claim'] || 0) + 1;
            break;
        case 'CommonI':
            validCreeps['harvest'] = (validCreeps['harvest'] || 0) + 1;
            break;
    }
}
```

### 修复 2：在 `_calculateBuildCreeps()` 中考虑等待中的 spawn 任务

**文件**：`AP.taskhandler.js`

**修改位置**：第 424-431 行

**修改内容**：
```javascript
// 2. build: 计算建筑工地需要的能量，每 5K 对应一个 build 任务，每个任务对应一个 creep
const buildTasks = tasks.filter(t => t.type === 'build');
const buildCreepsNeeded = this._calculateBuildCreeps(room, buildTasks.length);

// 【新增】考虑等待中的 spawn 任务
const existingSpawnTasks = modules.taskboard.getTasks(roomName, 'Buildings');
const waitingSpawnTasks = existingSpawnTasks.filter(t => t.type === 'spawn' && !t.takenBy);

for (const task of waitingSpawnTasks) {
    const model = task.data.model;
    if (model === 'CommonI') {
        buildCreepsNeeded++;
    }
}

const currentBuildCreeps = validCreeps['build'] || 0;
const needed = Math.max(0, buildCreepsNeeded - currentBuildCreeps);
for (let i = 0; i < needed; i++) {
    needs.push({ type: 'build', priority: this._getTaskPriority('build') });
}
```

### 修复 3：在 `_handleNeedCreeps()` 中考虑等待中的 spawn 任务

**文件**：`AP.taskhandler.js`

**修改位置**：第 153 行

**修改内容**：
```javascript
// 每次最多补3个
const spawnCount = Math.min(deficit, 3);

// 【新增】考虑等待中的 spawn 任务，避免重复生成
const existingSpawnTasks = modules.taskboard.getTasks(roomName, 'Buildings');
const waitingSpawnTasks = existingSpawnTasks.filter(t => t.type === 'spawn' && !t.takenBy);

for (const task of waitingSpawnTasks) {
    const model = task.data.model;
    switch (model) {
        case 'AttackerI':
            deficit--;
            break;
        case 'CarrierI':
            deficit--;
            break;
        case 'ClaimerI':
            deficit--;
            break;
        case 'CommonI':
            deficit--;
            break;
    }
}

const spawnCount = Math.min(deficit, 3);
for (var i = 0; i < spawnCount; i++) {
    taskboard.buildings.spawn(roomName, model, priority, { energy: energy, model: model });
}
```

## 验证步骤

1. **上传代码到 Screeps**
2. **观察日志输出**：
   - 检查 `[TaskHandler] Spawn: xxx 需补xxx` 的日志
   - 确认补丁数量是否合理
3. **监控 creep 数量**：
   - creep 数量应该保持稳定
   - 不应该出现持续增长的情况
4. **检查任务数量**：
   - 任务数量应该保持稳定
   - 不应该出现任务堆积的情况

## 预期效果

1. **creep 数量保持稳定**：
   - 系统会正确考虑等待中的 spawn 任务
   - 不会重复生成 creep

2. **日志更清晰**：
   - 可以看到补丁数量和当前 creep 数量的对比
   - 可以看到等待中的 spawn 任务数量

3. **资源使用更合理**：
   - 不会浪费能量生成多余的 creep
   - 不会因为 creep 过多而影响性能
