/**
 * task.creep.claim.js
 * 占领任务执行逻辑。
 * 任务类型：claim
 * 参数：targetRoomName
 */

const taskHelper = require('lib.AP.taskHelper');

const taskClaim = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        if (!data || !data.targetRoomName) return;

        // 如果不在目标房间，先移动过去
        if (creep.room.name !== data.targetRoomName) {
            const pos = new RoomPosition(25, 25, data.targetRoomName);
            creep.moveTo(pos, { visualizePathStyle: { stroke: '#ffffff' } });
            return;
        }

        // 到达目标房间，寻找控制器
        const controller = creep.room.controller;
        if (!controller) {
            console.log("[Claim] ❌ 房间内找不到控制器: " + data.targetRoomName);
            return;
        }

        // 任务结束判定
        if (controller.my) {
            taskHelper.completeTask(creep);
            return;
        }

        // 执行占领
        const result = creep.claimController(controller);
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
        }
    },

};

module.exports = taskClaim;
