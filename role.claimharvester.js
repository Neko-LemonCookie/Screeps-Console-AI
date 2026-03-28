// role.claimharvester.js - 远程收割者（预定房间采集）

// 引入通用模块
const commonUtils = require('common.utils');
const energyManager = require('common.energy');
const buildManager = require('common.build');

var roleClaimHarvester = {
    /** @param {Creep} creep **/
    run: function(creep) {
        // 获取目标房间，如果没有则待命
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            creep.say('❓无目标');
            return;
        }

        const moveOpts = commonUtils.getMoveOpts({
            maxOps: 800, // 跨房间路径计算需要更多ops
        });
        
        // 状态管理
        if (creep.memory.harvesting && creep.store.getFreeCapacity() === 0) {
            creep.memory.harvesting = false;
            creep.say('🏠返回');
        }
        if (!creep.memory.harvesting && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.harvesting = true;
            creep.say('🚀远征');
        }
        
        // 采集状态：前往目标房间采集
        if (creep.memory.harvesting) {
            this._harvestFromTargetRoom(creep, targetRoom, moveOpts);
        } 
        // 存储状态：返回出生房间存储
        else {
            this._depositInHomeRoom(creep, moveOpts);
        }
    },
    
    /** 前往目标房间采集能量 */
    _harvestFromTargetRoom: function(creep, targetRoom, moveOpts) {
        // 如果不在目标房间，先移动到目标房间
        if (creep.room.name !== targetRoom) {
            // 方法1: 直接移动到目标房间的某个位置（推荐，更简单）
            const targetPos = new RoomPosition(25, 25, targetRoom);
            const moveResult = creep.moveTo(targetPos, moveOpts);
            
            // 如果移动失败，可能是路径计算问题，尝试重置路径
            if (moveResult === ERR_NO_PATH || moveResult === ERR_INVALID_TARGET) {
                delete creep.memory._move;
                creep.say('🔄重置路径');
                creep.moveTo(targetPos, moveOpts);
            }
            return;
        }
        
        // 已在目标房间，寻找能量源采集
        energyManager.harvestEnergy(creep, moveOpts);
    },
    
    /** 返回出生房间存储能量 */
    _depositInHomeRoom: function(creep, moveOpts) {
        const homeRoom = creep.memory.homeRoom;
        if (!homeRoom) {
            creep.say('❓无家');
            return;
        }
        
        // 如果不在出生房间，先返回
        if (creep.room.name !== homeRoom) {
            // 直接移动到出生房间的中央位置
            const homePos = new RoomPosition(25, 25, homeRoom);
            const moveResult = creep.moveTo(homePos, moveOpts);
            
            // 如果移动失败，重置路径
            if (moveResult === ERR_NO_PATH || moveResult === ERR_INVALID_TARGET) {
                delete creep.memory._move;
                creep.say('🔄重置路径');
                creep.moveTo(homePos, moveOpts);
            }
            return;
        }
        
        // 已在出生房间，寻找存储目标
        
        // 1. 优先找容器（因为通常离spawn较近，且容易存满）
        const containerTarget = energyManager.findAnyContainerToFill(creep);
        if (containerTarget) {
            if (energyManager.transferEnergy(creep, containerTarget, moveOpts)) {
                return;
            }
        }
        
        // 2. 找存储（Storage）
        const storageTarget = energyManager.findStorage(creep);
        if (storageTarget) {
            if (energyManager.transferEnergy(creep, storageTarget, moveOpts)) {
                return;
            }
        }
        
        // 3. 如果容器和存储都满了，找spawn或extension
        const spawnExtTarget = energyManager.findSpawnOrExtension(creep);
        if (spawnExtTarget) {
            if (energyManager.transferEnergy(creep, spawnExtTarget, moveOpts)) {
                return;
            }
        }
        
        // 4. 如果所有目标都满了，那就升级控制器
        buildManager.upgradeController(creep, moveOpts);
    }
};

module.exports = roleClaimHarvester;