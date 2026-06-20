/**
 * task.creep.upgrade.js
 * 升级控制器任务执行逻辑。
 * 参数：targetId (能量来源建筑 ID 或 Source ID)
 */

const taskHelper = require('lib.AP.taskHelper');

const taskUpgrade = {
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

        // 状态切换：完成一次升级循环（背包空）则结束任务
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            taskHelper.completeTask(creep);
            return;
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('⚡ 升级');
        }

        if (creep.memory.working) {
            // 执行升级
            if (creep.room.controller) {
                if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
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
            console.log("[Upgrade] ❌ 找不到能量来源: " + targetId + " (Creep: " + creep.name + ")，自动清理任务");
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
        }
    },

    /**
     * autoAssign: 动态查找能量来源
     * 优先级: source > storage > container > link
     * @private
     */
    _findEnergySource: function(creep) {
        const room = creep.room;
        // 1. Source (含能量)
        const sources = room.find(FIND_SOURCES);
        for (const src of sources) {
            if (src.energy > 0) return src;
        }
        // 2. Storage
        if (room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) return room.storage;
        // 3. Container
        const containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
        if (containers.length > 0) return containers[0];
        // 4. Link
        const links = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
        if (links.length > 0) return links[0];
        return null;
    },

};

module.exports = taskUpgrade;
