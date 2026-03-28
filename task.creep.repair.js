/**
 * task.creep.repair.js
 * 维修任务执行逻辑。
 * 参数：targetId (能量来源建筑 ID 或 Source ID)
 */

const taskRepair = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        if (!data || !data.targetId) return;

        // 状态切换
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄 取能');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🔧 维修');
        }

        if (creep.memory.working) {
            // 执行维修 (寻找受损建筑)
            const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
            });
            if (target) {
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else {
                // 如果没有需要维修的（非墙），尝试维修墙/刷墙，或者临时建造
                const wall = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && s.hits < 1000000
                });
                if (wall) {
                    if (creep.repair(wall) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(wall, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                } else {
                    // 完全没有可修复的建筑，任务结束
                    this._completeTask(creep);
                }
            }
        } else {
            // 从指定目标获取能量
            this._getEnergy(creep, data.targetId);
        }
    },

    /**
     * 获取能量逻辑
     * @private
     */
    _getEnergy: function(creep, targetId) {
        const target = Game.getObjectById(targetId);
        if (!target) {
            console.log("[Repair] ❌ 找不到能量来源: " + targetId + " (Creep: " + creep.name + ")");
            return;
        }

        let result;
        if (target.store) {
            result = creep.withdraw(target, RESOURCE_ENERGY);
        } else {
            result = creep.harvest(target);
        }

        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
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

module.exports = taskRepair;
