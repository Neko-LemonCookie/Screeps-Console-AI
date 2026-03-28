/**
 * task.creep.carry.js
 * 基础运输任务执行逻辑。
 * 参数：fromId, toId, resourceType
 */

const taskCarry = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        if (!data || !data.fromId || !data.toId || !data.resourceType) return;

        // 状态切换：完成一次搬运循环（送达并清空背包）则结束任务
        if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
            this._completeTask(creep);
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
                console.log("[Carry] ❌ 找不到目标建筑: " + data.toId);
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
                console.log("[Carry] ❌ 找不到源建筑: " + data.fromId);
                return;
            }

            const resType = data.resourceType === 'ALL' ? Object.keys(source.store)[0] : data.resourceType;
            if (creep.withdraw(source, resType) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
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

module.exports = taskCarry;
