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
        if (!data || !data.targetId) return;

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
            // 如果是建筑，使用 withdraw
            result = creep.withdraw(target, RESOURCE_ENERGY);
        } else {
            // 如果是 Source，使用 harvest
            result = creep.harvest(target);
        }

        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    },

};

module.exports = taskUpgrade;
