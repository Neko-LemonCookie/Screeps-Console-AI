/**
 * task.creep.sign.js
 * 签名任务执行逻辑。
 * 参数：targetRoomName, signText
 */

const taskHelper = require('lib.AP.taskHelper');

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
            taskHelper.completeTask(creep);
        } else {
            // 如果签名已经一致，也算完成
            if (controller.sign && controller.sign.text === data.signText) {
                taskHelper.completeTask(creep);
            }
        }
    },

};

module.exports = taskSign;
