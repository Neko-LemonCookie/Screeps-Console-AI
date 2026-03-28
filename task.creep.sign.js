/**
 * task.creep.sign.js
 * 签名任务执行逻辑。
 * 参数：targetRoomName, signText
 */

const taskSign = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        if (!data || !data.targetRoomName || data.signText === undefined) return;

        // 跨房间移动
        if (creep.room.name !== data.targetRoomName) {
            const pos = new RoomPosition(25, 25, data.targetRoomName);
            creep.moveTo(pos, { visualizePathStyle: { stroke: '#ffffff' } });
            return;
        }

        // 到达目标房间，寻找控制器
        const controller = creep.room.controller;
        if (!controller) {
            console.log("[Sign] ❌ 房间内找不到控制器: " + data.targetRoomName);
            return;
        }

        // 执行签名
        const result = creep.signController(controller, data.signText);
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
        } else if (result === OK) {
            this._completeTask(creep);
        } else {
            // 如果签名已经一致，也算完成
            if (controller.sign && controller.sign.text === data.signText) {
                this._completeTask(creep);
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

module.exports = taskSign;
