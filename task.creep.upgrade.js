/**
 * task.creep.upgrade.js
 * 升级控制器任务执行逻辑。
 * 参数：targetId (能量来源建筑 ID 或 Source ID)
 */

const taskUpgrade = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        if (!data || !data.targetId) return;

        // 状态切换：完成一次升级循环（背包空）则结束任务
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            this._completeTask(creep);
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
            console.log("[Upgrade] ❌ 找不到能量来源: " + targetId + " (Creep: " + creep.name + ")");
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

module.exports = taskUpgrade;
