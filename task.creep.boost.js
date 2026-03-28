/**
 * task.creep.boost.js
 * Creep 强化任务逻辑
 * 任务结束条件：成功接受强化 或 目标 LAB 任务已结束
 */

module.exports = {
    /**
     * 执行强化任务
     * @param {Creep} creep 
     * @param {Object} data { labId: string, bodyPart: string }
     */
    run: function(creep, data) {
        const lab = Game.getObjectById(data.labId);
        if (!lab) {
            this._completeTask(creep);
            return;
        }

        // 检查目标 LAB 是否还在进行属于该 Creep 的 Boost 任务
        const buildingTasks = (Memory.Taskboard && Memory.Taskboard.Task.Buildings[creep.room.name]) || [];
        const hasBoostTask = buildingTasks.some(t => t.type === 'boost' && t.takenBy === data.labId && t.data.bodyPart === data.bodyPart);
        if (!hasBoostTask) {
            this._completeTask(creep);
            return;
        }

        // 检查是否已经完成强化 (寻找对应的强化后的部件)
        const isBoosted = creep.body.some(p => p.type === data.bodyPart && p.boost);
        if (isBoosted) {
            this._completeTask(creep);
            return;
        }

        // 移动到 LAB 旁边
        if (creep.pos.isNearTo(lab)) {
            // 等待 LAB 执行 boostCreep(creep)
            // 不需要自己调用，building.lab.js 会负责调用
        } else {
            creep.moveTo(lab, { visualizePathStyle: { stroke: '#ffffff' } });
        }
    },

    /**
     * 结束任务并清理内存
     * @private
     */
    _completeTask: function(creep) {
        const taskboard = require('lib.AP.taskboard');
        taskboard.removeTask(creep.room.name, 'Creeps', creep.name);
        creep.memory.taskType = null;
        creep.memory.taskData = null;
    }
};
