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
        let data = creep.memory.taskData;
        // 【修复】taskData 为空直接清任务，不要留着 taskType 站着不动
        if (!data) {
            taskHelper.completeTask(creep);
            return;
        }

        // autoAssign: 动态分配 source 和 target
        // 【修复】只有第一次分配或当前source枯竭时才重新计算，避免挖一半换矿点
        let needReassign = false;
        if (data.autoAssign) {
            if (!data.sourceId || !data.targetId || !creep.memory._lastSourceAssign) {
                needReassign = true;
            } else {
                // 检查当前 source 是否枯竭
                const currentSource = Game.getObjectById(data.sourceId);
                if (currentSource && currentSource.energy === 0) {
                    needReassign = true;
                }
            }
        }
        
        if (needReassign) {
                const sources = creep.room.find(FIND_SOURCES);
                const spawns = creep.room.find(FIND_MY_SPAWNS);
                const spawn = spawns.length > 0 ? spawns[0] : null;
                
                let bestSource = null;
                
                if (spawn && sources.length > 0) {
                    // 按离 spawn 的直线距离排序
                    const sortedSources = sources.slice().sort((a, b) => {
                        return spawn.pos.getRangeTo(a) - spawn.pos.getRangeTo(b);
                    });
                    
                    // 逐个寻路测试，第一个能到达的就选
                    for (const src of sortedSources) {
                        const path = spawn.pos.findPathTo(src, {
                            ignoreCreeps: true,
                            maxOps: 500,
                            plainCost: 2,
                            swampCost: 10
                        });
                        if (path && path.length > 0) {
                            bestSource = src;
                            break;
                        }
                    }
                    
                    // 兜底：所有都找不到路径就选最近的那个
                    if (!bestSource) {
                        bestSource = sortedSources[0];
                    }
                } else if (sources.length > 0) {
                    // 没有 spawn，随便选第一个
                    bestSource = sources[0];
                }

                if (bestSource) {
                    creep.memory.taskData = { sourceId: bestSource.id, targetId: 'base', autoAssign: true };
                    creep.memory._lastSourceAssign = Game.time;
                } else {
                    // 【新增】如果没有可用 source，尝试使用默认 source（第一个 source）
                    if (sources.length > 0) {
                        console.log("[Harvest] ⚠️  autoAssign 失败，使用默认 source: " + sources[0].id);
                        creep.memory.taskData = { sourceId: sources[0].id, targetId: 'base', autoAssign: true };
                        creep.memory._lastSourceAssign = Game.time;
                    } else {
                        // 【新增】如果没有 source，清理任务并返回
                        console.log("[Harvest] ❌ 房间没有能量源，清理任务: " + creep.name);
                        taskHelper.completeTask(creep);
                        return;
                    }
                }
                // 重新获取最新的 data
                data = creep.memory.taskData;
        }

        if (!data.sourceId || !data.targetId) {
            console.log("[Harvest] ❌ 任务数据不完整: sourceId=" + data.sourceId + ", targetId=" + data.targetId + " (Creep: " + creep.name + ")");
            taskHelper.completeTask(creep);
            return;
        }

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
            creep.moveTo(source, { 
                reusePath: 10,
                visualizePathStyle: { stroke: '#ffaa00' } 
            });
        } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
            // 【修复】source 能量耗尽，移到旁边等着刷新，别站路中间挡道
            if (!creep.pos.isNearTo(source)) {
                creep.moveTo(source, { 
                    reusePath: 5,
                    visualizePathStyle: { stroke: '#aaaaaa' } 
                });
            }
            creep.say('⏳ 等刷新');
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
                creep.moveTo(smartTarget, { 
                    reusePath: 10,
                    visualizePathStyle: { stroke: '#00ff00' } 
                });
            } else if (result === OK) {
                // 存入容器后不清除任务！继续采矿循环（working状态切换回false后会继续采）
                creep.memory.working = false;
                creep.say('⚡ 采集');
            }
            return;
        }

        // 4. 没有容器时的原有逻辑：送往base或指定目标
        if (targetId === 'base') {
            // 【优化】缓存存储目标，避免每tick都findClosestByPath耗CPU
            let target = null;
            if (creep.memory._depositTargetId) {
                target = Game.getObjectById(creep.memory._depositTargetId);
                // 缓存失效：目标不存在或满了，重新找
                if (!target || target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    target = null;
                    delete creep.memory._depositTargetId;
                }
            }
            
            if (!target) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: function(s) {
                        return (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
                               s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
                if (target) {
                    creep.memory._depositTargetId = target.id;
                }
            }
            
            if (target) {
                var result2 = creep.transfer(target, RESOURCE_ENERGY);
                if (result2 === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { 
                        reusePath: 10,
                        visualizePathStyle: { stroke: '#ffffff' } 
                    });
                } else if (result2 === OK) {
                    delete creep.memory._depositTargetId; // 存完清空缓存
                    taskHelper.completeTask(creep);
                }
            } else {
        // 【新增】base 满了，尝试寻找其他存储目标
        var fallback = null;
        if (creep.memory._fallbackTargetId) {
            fallback = Game.getObjectById(creep.memory._fallbackTargetId);
            if (!fallback || fallback.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                fallback = null;
                delete creep.memory._fallbackTargetId;
            }
        }
        
        if (!fallback) {
            fallback = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: function(s) {
                    return (s.structureType === STRUCTURE_CONTAINER ||
                            s.structureType === STRUCTURE_STORAGE ||
                            s.structureType === STRUCTURE_LINK) &&
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            if (fallback) {
                creep.memory._fallbackTargetId = fallback.id;
            }
        }

        if (fallback) {
            var result3 = creep.transfer(fallback, RESOURCE_ENERGY);
            if (result3 === ERR_NOT_IN_RANGE) {
                creep.moveTo(fallback, { 
                    reusePath: 10,
                    visualizePathStyle: { stroke: '#ffffff' } 
                });
            } else if (result3 === OK) {
                delete creep.memory._fallbackTargetId;
                taskHelper.completeTask(creep);
            }
        } else {
            // 所有存储目标都满了，不放弃而是切换到其他有用任务
            const sites = creep.room.find(FIND_CONSTRUCTION_SITES);
            if (sites.length > 0) {
                // 有工地：切换为建造任务
                const taskboard = require('lib.AP.taskboard');
                taskboard.removeTask(creep.room.name, 'Creeps', creep.name);
                taskboard.creeps.build(creep.room.name, sites[0].id);
                const roomTasks = Memory.Taskboard.Task.Creeps[creep.room.name];
                const newTask = roomTasks[roomTasks.length - 1];
                if (newTask) {
                    newTask.takenBy = creep.name;
                    creep.memory.taskType = 'build';
                    creep.memory.taskData = { targetId: sites[0].id };
                    creep.memory.working = undefined;
                    creep.say('🔨 改建造');
                }
            } else if (creep.room.controller && creep.room.controller.my) {
                // 没工地：切换为升级任务
                const taskboard2 = require('lib.AP.taskboard');
                taskboard2.removeTask(creep.room.name, 'Creeps', creep.name);
                taskboard2.creeps.upgrade(creep.room.name, creep.room.controller.id);
                const roomTasks2 = Memory.Taskboard.Task.Creeps[creep.room.name];
                const newTask2 = roomTasks2[roomTasks2.length - 1];
                if (newTask2) {
                    newTask2.takenBy = creep.name;
                    creep.memory.taskType = 'upgrade';
                    // upgrade任务的targetId是能量来源（source/storage/container），不是控制器
                    // 控制器由upgrade模块内部自动获取creep.room.controller
                    creep.memory.taskData = { autoAssign: true };
                    creep.memory.working = undefined;
                    creep.say('⬆️ 改升级');
                }
            } else {
                // 真的没事可做才清理任务
                console.log("[Harvest] ❌ 存储满且无替代任务，清理: " + creep.name);
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
            creep.moveTo(idTarget, { 
                reusePath: 10,
                visualizePathStyle: { stroke: '#ffffff' } 
            });
        } else if (result4 === OK) {
            taskHelper.completeTask(creep);
        }
    },

};

module.exports = taskHarvest;
