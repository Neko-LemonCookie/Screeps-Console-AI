/**
 * task.creep.harvest.js
 * 采集任务执行逻辑。
 * 参数：sourceId (Source/Mineral), targetId (ID/'base'/'ground')
 */

const taskHarvest = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        if (!data || !data.sourceId || !data.targetId) return;

        // 0. 强化 (Boost) 检查：如果房间内有 WORK 强化任务，且自身 TTL 足够，则转换任务
        if (creep.ticksToLive > 1200) {
            const buildingTasks = (Memory.Taskboard && Memory.Taskboard.Task.Buildings[creep.room.name]) || [];
            const boostWorkTask = buildingTasks.find(t => t.type === 'boost' && t.data.bodyPart === 'WORK');
            
            // 只要建筑任务已被 Lab 领取（takenBy 为 Lab ID），直接使用该 ID
            if (boostWorkTask && boostWorkTask.takenBy && boostWorkTask.takenBy !== 'LabGroup') {
                const targetLabId = boostWorkTask.takenBy;
                
                // 转换任务：先清理旧任务，再添加新任务并锁定
                const taskboard = require('lib.AP.taskboard');
                taskboard.removeTask(creep.room.name, 'Creeps', creep.name);
                
                // 创建新的 Boost 任务并立即锁定
                taskboard.creeps.boost(creep.room.name, targetLabId, 'WORK');
                const roomCreepTasks = Memory.Taskboard.Task.Creeps[creep.room.name];
                const lastTask = roomCreepTasks[roomCreepTasks.length - 1];
                lastTask.takenBy = creep.name;
                
                // 修改自身内存
                creep.memory.taskType = 'boost';
                creep.memory.taskData = { labId: targetLabId, bodyPart: 'WORK' };
                creep.say('💉 Boost');
                return;
            }
        }

        // 状态切换：如果背包满了，切换到存储状态；如果背包空了，切换到采集状态
        if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false;
            creep.say('⚡ 采集');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('📦 存能');
        }

        if (creep.memory.working) {
            // 存储逻辑
            this._deposit(creep, data.targetId);
        } else {
            // 采集逻辑
            this._harvest(creep, data.sourceId);
        }
    },

    /**
     * 采集逻辑
     * @private
     */
    _harvest: function(creep, sourceId) {
        const source = Game.getObjectById(sourceId);
        if (!source) {
            console.log("[Harvest] ❌ 找不到能量源: " + sourceId + " (Creep: " + creep.name + ")");
            // 找不到能量源，强制结束任务
            this._completeTask(creep);
            return;
        }

        let result;
        // 自动识别是 Source 还是 Mineral/Extractor
        if (source.energy !== undefined) {
            result = creep.harvest(source);
        } else {
            result = creep.harvest(source); // Mineral 也是用 harvest
        }

        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    },

    /**
     * 存储逻辑
     * @private
     */
    _deposit: function(creep, targetId) {
        // 1. 特殊目标：ground (原地丢弃)
        if (targetId === 'ground') {
            for (const resourceType in creep.store) {
                creep.drop(resourceType);
            }
            // 任务结束：丢弃后即算完成循环
            this._completeTask(creep);
            return;
        }

        // 2. 特殊目标：base (Spawn + Extension)
        if (targetId === 'base') {
            const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            if (target) {
                const result = creep.transfer(target, RESOURCE_ENERGY);
                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (result === OK) {
                    // 转移成功后完成任务
                    this._completeTask(creep);
                }
            } else {
                // 如果 base 满了，临时寻找最近的存储建筑
                const fallback = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        return (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                               s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
                if (fallback) {
                    const result = creep.transfer(fallback, RESOURCE_ENERGY);
                    if (result === ERR_NOT_IN_RANGE) {
                        creep.moveTo(fallback, { visualizePathStyle: { stroke: '#ffffff' } });
                    } else if (result === OK) {
                        // 转移成功后完成任务
                        this._completeTask(creep);
                    }
                }
            }
            return;
        }

        // 3. 指定 ID 目标 (Container, Storage, LINK, etc.)
        const target = Game.getObjectById(targetId);
        if (!target) {
            console.log("[Harvest] ❌ 找不到存储目标: " + targetId + " (Creep: " + creep.name + ")");
            // 找不到目标，强制结束任务
            this._completeTask(creep);
            return;
        }

        const result = creep.transfer(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
        } else if (result === OK) {
            // 转移成功后完成任务
            this._completeTask(creep);
        }
    },

    /**
     * 任务完成并自清理
     * @private
     */
    _completeTask: function(creep) {
        const taskboard = require('lib.AP.taskboard');
        const taskRoom = creep.memory.taskRoom || creep.room.name;
        // 使用更新后的 removeTask API，传入 creep.name 进行精准删除
        taskboard.removeTask(taskRoom, 'Creeps', creep.name);
        
        // 清理自身内存
        creep.memory.taskType = null;
        creep.memory.taskData = null;
        creep.memory.taskRoom = null;
        creep.memory.working = false;
    }
};

module.exports = taskHarvest;
