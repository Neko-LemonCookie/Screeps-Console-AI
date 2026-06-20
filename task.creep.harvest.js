/**
 * task.creep.harvest.js
 * 采集任务执行逻辑。
 * 参数：sourceId (Source/Mineral), targetId (ID/'base'/'ground')
 */

const taskHelper = require('lib.AP.taskHelper');

const taskHarvest = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        if (!data) return;

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
                return; // 没有可用 source
            }
            return this.run(creep); // 用新 data 重新执行
        }

        if (!data.sourceId || !data.targetId) return;

        // 0. 强化 (Boost) 检查：如果房间内有 work 强化任务，且自身 TTL 足够，则转换任务
        if (creep.ticksToLive > 1200) {
            const buildingTasks = (Memory.Taskboard && Memory.Taskboard.Task.Buildings[creep.room.name]) || [];
            // 统一使用 'work' 小写，与 taskboard.buildings.boost 创建时一致
            const boostWorkTask = buildingTasks.find(t => t.type === 'boost' && t.data && t.data.bodyPart === 'work');
            
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
            taskHelper.completeTask(creep);
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
     * 存储逻辑（智能选择目标：优先Container/Link，其次base/Storage）
     * @private
     */
    _deposit: function(creep, targetId) {
        // 1. 特殊目标：ground (原地丢弃)
        if (targetId === 'ground') {
            for (const resourceType in creep.store) {
                creep.drop(resourceType);
            }
            taskHelper.completeTask(creep);
            return;
        }

        // 2. 【新增】智能目标查找：优先找Source附近的Container/Link
        var source = Game.getObjectById(creep.memory.taskData.sourceId);
        var smartTarget = null;

        if (source) {
            // 查找Source旁边2格范围内的Container或Link
            var nearbyStructures = source.pos.findInRange(FIND_STRUCTURES, 2);
            for (var ni = 0; ni < nearbyStructures.length; ni++) {
                var ns = nearbyStructures[ni];
                if ((ns.structureType === STRUCTURE_CONTAINER || ns.structureType === STRUCTURE_LINK) &&
                    ns.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    smartTarget = ns;
                    break;  // 找到一个就够了
                }
            }
        }

        // 3. 如果找到了附近的Container/Link，往里存
        if (smartTarget) {
            var result = creep.transfer(smartTarget, RESOURCE_ENERGY);
            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(smartTarget, { visualizePathStyle: { stroke: '#00ff00' } });
            } else if (result === OK) {
                // 存入容器后不清除任务！继续采矿循环（working状态切换回false后会继续采）
                creep.memory.working = false;
                creep.say('⚡ 采集');
            }
            return;
        }

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
                // base满了，找Storage/Container
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
                }
            }
            return;
        }

        // 5. 指定ID目标
        var idTarget = Game.getObjectById(targetId);
        if (!idTarget) {
            console.log("[Harvest] ❌ 找不到存储目标: " + targetId + " (Creep: " + creep.name + ")");
            taskHelper.completeTask(creep);
            return;
        }

        var result4 = creep.transfer(idTarget, RESOURCE_ENERGY);
        if (result4 === ERR_NOT_IN_RANGE) {
            creep.moveTo(idTarget, { visualizePathStyle: { stroke: '#ffffff' } });
        } else if (result4 === OK) {
            taskHelper.completeTask(creep);
        }
    },

};

module.exports = taskHarvest;
