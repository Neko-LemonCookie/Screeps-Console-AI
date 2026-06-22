/**
 * task.creep.repair.js
 * 维修任务执行逻辑。
 * 参数：targetId (能量来源建筑 ID 或 Source ID)
 */

const taskHelper = require('lib.AP.taskHelper');

const taskRepair = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        if (!data) return;

        // autoAssign: 动态分配能量来源
        if (data.autoAssign) {
            const source = this._findEnergySource(creep);
            if (source) {
                creep.memory.taskData = { targetId: source.id };
            } else {
                return; // 没有可用能量来源
            }
            return this.run(creep);
        }

        if (!data.targetId) return;

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
            // 执行维修：普通建筑优先，墙/堡垒放最后（因为墙上限3亿无底洞）
            const damaged = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
            });
            const walls = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && s.hits < 1000000
            });

            // 普通建筑按血量从低到修（最惨的先修）
            if (damaged.length > 0) {
                damaged.sort((a, b) => a.hits - b.hits);
                const target = damaged[0];
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else if (walls.length > 0) {
                // 没有普通建筑需要修了，才修墙（也按血量从低到高）
                walls.sort((a, b) => a.hits - b.hits);
                const wall = walls[0];
                if (creep.repair(wall) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(wall, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else {
                // 完全没有可修复的建筑，任务结束
                taskHelper.completeTask(creep);
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
            console.log("[Repair] ❌ 找不到能量来源: " + targetId + " (Creep: " + creep.name + ")，自动清理任务");
            taskHelper.completeTask(creep);
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
        } else if (result !== OK) {
            // 能量来源无效，切换为autoAssign重试
            console.log("[Repair] ❌ 无法获取能量: " + result + " (Creep: " + creep.name + ")，切换autoAssign");
            creep.memory.taskData = { autoAssign: true };
        }
    },

    /**
     * autoAssign: 动态查找能量来源
     * @private
     */
    _findEnergySource: function(creep) {
        const room = creep.room;
        const sources = room.find(FIND_SOURCES);
        for (const src of sources) { if (src.energy > 0) return src; }
        if (room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) return room.storage;
        const containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
        if (containers.length > 0) return containers[0];
        return null;
    },

};

module.exports = taskRepair;
