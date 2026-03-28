/**
 * task.creep.globalcarry.js
 * 跨房间运输任务执行逻辑。
 * 参数：fromRoom, toRoom, fromId, toId, resourceType
 */

const taskGlobalCarry = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        if (!data || !data.fromRoom || !data.toRoom || !data.fromId || !data.toId || !data.resourceType) return;

        // 状态切换：完成一次跨房间搬运循环（清空背包）则结束任务
        if (creep.memory.working && creep.store.getUsedCapacity() === 0) {
            this._completeTask(creep);
            return;
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🚚 去送货');
        }

        if (creep.memory.working) {
            // 送货逻辑：跨房间
            if (creep.room.name !== data.toRoom) {
                const pos = new RoomPosition(25, 25, data.toRoom);
                creep.moveTo(pos, { visualizePathStyle: { stroke: '#ffffff' } });
            } else {
                const target = Game.getObjectById(data.toId);
                if (target) {
                    const resType = data.resourceType === 'ALL' ? Object.keys(creep.store)[0] : data.resourceType;
                    if (creep.transfer(target, resType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }
            }
        } else {
            // 取货逻辑：跨房间
            if (creep.room.name !== data.fromRoom) {
                const pos = new RoomPosition(25, 25, data.fromRoom);
                creep.moveTo(pos, { visualizePathStyle: { stroke: '#ffaa00' } });
            } else {
                const source = Game.getObjectById(data.fromId);
                if (source) {
                    const resType = data.resourceType === 'ALL' ? Object.keys(source.store)[0] : data.resourceType;
                    if (creep.withdraw(source, resType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                }
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

module.exports = taskGlobalCarry;
