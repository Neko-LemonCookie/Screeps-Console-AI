/**
 * task.creep.claimupgrade.js
 * 远程占领并升级任务执行逻辑。
 * 参数：targetRoomName, sourceId
 */

const taskHelper = require('lib.AP.taskHelper');

const taskClaimUpgrade = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        if (!data || !data.targetRoomName || !data.sourceId) return;

        // 跨房间移动
        if (creep.room.name !== data.targetRoomName) {
            const pos = new RoomPosition(25, 25, data.targetRoomName);
            creep.moveTo(pos, { visualizePathStyle: { stroke: '#ffffff' } });
            return;
        }

        // 任务结束判定：目标房间有 spawn 后任务结束
        const spawns = creep.room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_SPAWN });
        if (spawns.length > 0) {
            taskHelper.completeTask(creep);
            return;
        }

        // 状态切换
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄 采能');
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
            // 从指定 Source 采集能量
            const source = Game.getObjectById(data.sourceId);
            if (source) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
        }
    },

};

module.exports = taskClaimUpgrade;
