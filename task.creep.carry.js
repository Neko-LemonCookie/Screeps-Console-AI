/**
 * task.creep.carry.js
 * 基础运输任务执行逻辑。
 * 参数：fromId, toId, resourceType
 */

const taskHelper = require('lib.AP.taskHelper');

const taskCarry = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        if (!data || !data.fromId || !data.toId || !data.resourceType) return;

        // 状态切换：完成一次搬运循环（送达并清空背包）则结束任务
        if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
            taskHelper.completeTask(creep);
            return;
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('📦 送货');
        }

        if (creep.memory.working) {
            // 送货逻辑
            const target = Game.getObjectById(data.toId);
            if (!target) {
                console.log("[Carry] ❌ 找不到目标建筑: " + data.toId + "，自动清理任务");
                taskHelper.completeTask(creep);
                return;
            }

            // 转移所有资源或指定资源
            const resType = data.resourceType === 'ALL' ? Object.keys(creep.store)[0] : data.resourceType;
            if (creep.transfer(target, resType) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else {
            // 取货逻辑
            const source = Game.getObjectById(data.fromId);
            if (!source) {
                console.log("[Carry] ❌ 找不到源建筑: " + data.fromId + "，自动清理任务");
                taskHelper.completeTask(creep);
                return;
            }

            const resType = data.resourceType === 'ALL' ? Object.keys(source.store)[0] : data.resourceType;
            if (creep.withdraw(source, resType) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    },

};

module.exports = taskCarry;
