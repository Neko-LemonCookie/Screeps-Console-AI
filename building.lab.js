/**
 * building.lab.js
 * LAB 运行逻辑：自动反应与强化 (Boost)
 * 5x5 模板：(-1,0)与(1,0)为原料，(0,1)为反应
 * 9x9 模板：y=4 的四个为原料，y=3 的两个为反应
 */

module.exports = {
    /**
     * 运行房间内的所有 LAB
     * @param {Room} room 
     */
    run: function(room) {
        const search = require('lib.AP.search');
        
        // 使用 API 查找 LAB 组（返回数组，取第一组用于 boost）
        const labGroups = search.fetch.labGroup(room.name);
        if (!labGroups || labGroups.length === 0) return;
        
        // 使用第一组 LAB 进行 boost 任务
        const firstGroup = labGroups[0];
        const inputLabs = firstGroup.inputLabs;
        const outputLabs = firstGroup.outputLabs;

        // 2. 获取任务看板数据
        const buildingTasks = (Memory.Taskboard && Memory.Taskboard.Task.Buildings[room.name]) || [];
        const creepTasks = (Memory.Taskboard && Memory.Taskboard.Task.Creeps[room.name]) || [];

        // 3. 处理每个反应 LAB 的逻辑 (独立执行各自领取的任务)
        for (const outputLab of outputLabs) {
            // 3.1 查找此 LAB 已领取的任务，或者尝试领取一个新的
            let activeTaskIndex = buildingTasks.findIndex(t => t.type === 'boost' && t.takenBy === outputLab.id);
            let activeTask = activeTaskIndex !== -1 ? buildingTasks[activeTaskIndex] : null;

            // 如果没有已领取的任务，尝试从任务看板领取一个最早且目前可执行的
            if (!activeTask) {
                const unclaimedTasks = buildingTasks
                    .map((t, index) => ({ task: t, index: index }))
                    .filter(item => item.task.type === 'boost' && item.task.takenBy === null)
                    .sort((a, b) => a.task.createdTime - b.task.createdTime);

                for (const item of unclaimedTasks) {
                    const bodyPart = item.task.data.bodyPart;
                    const mType = outputLab.mineralType;
                    // 只有矿物匹配且当前资源量足够至少一次强化时才领取
                    if (mType && BOOSTS[bodyPart] && BOOSTS[bodyPart][mType]) {
                        if (outputLab.store[mType] >= 30 && outputLab.store[RESOURCE_ENERGY] >= 20) {
                            item.task.takenBy = outputLab.id;
                            activeTask = item.task;
                            activeTaskIndex = item.index;
                            break;
                        }
                    }
                }
            }

            // 3.2 如果有 Boost 任务，执行 Boost 逻辑并跳过该组的反应逻辑
            if (activeTask) {
                const labId = outputLab.id;
                // 初始化房间内存（防止未初始化导致崩溃）
                if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
                // 初始化或获取计时器 (每个反应 LAB 独立计时)
                if (!Memory.rooms[room.name].labBoostTimers) Memory.rooms[room.name].labBoostTimers = {};
                if (Memory.rooms[room.name].labBoostTimers[labId] === undefined) {
                    Memory.rooms[room.name].labBoostTimers[labId] = 50;
                }
                
                // 增加资源等待计时器
                if (!Memory.rooms[room.name].labResourceWaitTimers) Memory.rooms[room.name].labResourceWaitTimers = {};
                if (Memory.rooms[room.name].labResourceWaitTimers[labId] === undefined) {
                    Memory.rooms[room.name].labResourceWaitTimers[labId] = 50;
                }

                let anyCreepNeedsBoost = false;
                const bodyPart = activeTask.data.bodyPart;

                // 1. 检查 Creep 需求计时器
                const creepsInRoom = room.find(FIND_MY_CREEPS);
                anyCreepNeedsBoost = creepsInRoom.some(c => {
                    return creepTasks.some(t => 
                        t.takenBy === c.name && 
                        t.type === 'boost' && 
                        t.data.bodyPart === bodyPart &&
                        (t.data.labId === labId || !t.data.labId)
                    );
                });

                if (anyCreepNeedsBoost) {
                    Memory.rooms[room.name].labBoostTimers[labId] = 50;
                } else {
                    Memory.rooms[room.name].labBoostTimers[labId]--;
                }

                // 2. 检查资源充足性计时器
                const mType = outputLab.mineralType;
                const hasResources = mType && outputLab.store[mType] >= 30 && outputLab.store[RESOURCE_ENERGY] >= 20;
                
                if (hasResources) {
                    Memory.rooms[room.name].labResourceWaitTimers[labId] = 50;
                } else {
                    Memory.rooms[room.name].labResourceWaitTimers[labId]--;
                }

                // 检查任务结束条件
                const timeoutCreep = Memory.rooms[room.name].labBoostTimers[labId] <= 0;
                const timeoutResource = Memory.rooms[room.name].labResourceWaitTimers[labId] <= 0;

                if (timeoutCreep || timeoutResource) {
                    const taskboard = require('lib.AP.taskboard');
                    taskboard.removeTask(room.name, 'Buildings', activeTaskIndex);
                    delete Memory.rooms[room.name].labBoostTimers[labId];
                    delete Memory.rooms[room.name].labResourceWaitTimers[labId];
                } else if (hasResources) {
                    this._handleBoost(outputLab, activeTask, creepTasks);
                }
                
                // 该 LAB 组处于 Boost 模式，不执行自动反应逻辑
                continue;
            } else {
                // 如果没有 Boost 任务，确保清理对应的计时器
                if (Memory.rooms[room.name].labBoostTimers && Memory.rooms[room.name].labBoostTimers[outputLab.id]) {
                    delete Memory.rooms[room.name].labBoostTimers[outputLab.id];
                }
                if (Memory.rooms[room.name].labResourceWaitTimers && Memory.rooms[room.name].labResourceWaitTimers[outputLab.id]) {
                    delete Memory.rooms[room.name].labResourceWaitTimers[outputLab.id];
                }
            }

            // 3.3 自动反应逻辑 (无 Boost 任务时执行)
            if (outputLab.cooldown > 0) continue;

            // 获取城市中心坐标（_getPairInputs 需要）
            const centerPos = room.memory.cityCenter
                ? new RoomPosition(room.memory.cityCenter.x, room.memory.cityCenter.y, room.name)
                : null;
            if (!centerPos) continue;

            const pairInputs = this._getPairInputs(outputLab, inputLabs, centerPos);
            if (pairInputs.length === 2) {
                const lab1 = pairInputs[0];
                const lab2 = pairInputs[1];
                if (lab1.mineralType && lab2.mineralType && 
                    lab1.store[lab1.mineralType] >= 5 && 
                    lab2.store[lab2.mineralType] >= 5) {
                    outputLab.runReaction(lab1, lab2);
                }
            }
        }
    },

    /**
     * 处理强化逻辑
     * @private
     */
    _handleBoost: function(lab, task, creepTasks) {
        // 寻找周围 1 格内有 boost 任务且需要该部位强化的 Creep
        const bodyPart = task.data.bodyPart;
        const targets = lab.pos.findInRange(FIND_MY_CREEPS, 1, {
            filter: (c) => {
                const cTask = creepTasks.find(t => t.takenBy === c.name && t.type === 'boost' && t.data.bodyPart === bodyPart);
                return !!cTask;
            }
        });

        if (targets.length > 0) {
            // 尝试为第一个目标强化
            const target = targets[0];
            if (lab.boostCreep(target) === OK) {
                // 强化成功，任务由任务看板自动或手动清理（通常由 Creep 自己清理）
            }
        }
    },

    /**
     * 根据反应 LAB 坐标寻找对应的原料 LAB
     * @private
     */
    _getPairInputs: function(outputLab, inputLabs, center) {
        const relX = outputLab.pos.x - center.x;
        const relY = outputLab.pos.y - center.y;
        
        // 5x5: Output(0,1) -> Inputs(-1,0), (1,0)
        if (relX === 0 && relY === 1) {
            return inputLabs.filter(l => {
                const lx = l.pos.x - center.x;
                const ly = l.pos.y - center.y;
                return (lx === -1 || lx === 1) && ly === 0;
            });
        }

        // 9x9: 
        // Pair 1: Output(2,3) -> Inputs(1,4), (3,4)
        if (relX === 2 && relY === 3) {
            return inputLabs.filter(l => {
                const lx = l.pos.x - center.x;
                const ly = l.pos.y - center.y;
                return (lx === 1 || lx === 3) && ly === 4;
            });
        }
        // Pair 2: Output(-2,3) -> Inputs(-3,4), (-1,4)
        if (relX === -2 && relY === 3) {
            return inputLabs.filter(l => {
                const lx = l.pos.x - center.x;
                const ly = l.pos.y - center.y;
                return (lx === -3 || lx === -1) && ly === 4;
            });
        }

        return [];
    }
};
