// 全局函数 - 设置搬运猫的路线
global.catlink = function(roomName1, storageId1, roomName2, storageId2) {
    if (!Memory.TangYuanLonelyCat) {
        Memory.TangYuanLonelyCat = {};
    }
    if (!Memory.TangYuanLonelyCat.CuteCat) {
        Memory.TangYuanLonelyCat.CuteCat = {};
    }
    
    Memory.TangYuanLonelyCat.CuteCat.room1 = roomName1;
    Memory.TangYuanLonelyCat.CuteCat.storage1 = storageId1;
    Memory.TangYuanLonelyCat.CuteCat.room2 = roomName2;
    Memory.TangYuanLonelyCat.CuteCat.storage2 = storageId2;
    
    console.log('CuteCat路线已设置：' + roomName1 + ' ↔ ' + roomName2);
};

// CuteCat角色逻辑
var roleCutecat = {
    /** @param {Creep} creep **/
    run: function(creep) {
        // 检查内存中是否有搬运路线设置
        if (!Memory.TangYuanLonelyCat || !Memory.TangYuanLonelyCat.CuteCat) {
            creep.say('🐱无路线');
            return;
        }
        
        var config = Memory.TangYuanLonelyCat.CuteCat;
        var room1Name = config.room1;
        var storageId1 = config.storage1;
        var room2Name = config.room2;
        var storageId2 = config.storage2;
        
        // 获取存储对象（假设永恒存在）
        var storage1 = Game.getObjectById(storageId1);
        var storage2 = Game.getObjectById(storageId2);
        
        // 计算两个存储的能量差异
        var energy1 = storage1.store[RESOURCE_ENERGY] || 0;
        var energy2 = storage2.store[RESOURCE_ENERGY] || 0;
        
        // 决定搬运方向：从能量多的存储搬到能量少的存储
        var sourceStorage, targetStorage;
        var sourceRoom, targetRoom;
        
        if (energy1 > energy2 + 50) { // 加50的阈值，避免来回搬运
            sourceStorage = storage1;
            targetStorage = storage2;
            sourceRoom = room1Name;
            targetRoom = room2Name;
        } else if (energy2 > energy1 + 50) {
            sourceStorage = storage2;
            targetStorage = storage1;
            sourceRoom = room2Name;
            targetRoom = room1Name;
        } else {
            creep.say('🐱平衡');
            // 如果能量平衡，原地休息
            if (creep.fatigue > 0) {
                creep.moveTo(creep.pos.x + 1, creep.pos.y);
            }
            return;
        }
        
        // 执行搬运逻辑
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.working = false;
            creep.say('🐱取能量');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() == 0) {
            creep.memory.working = true;
            creep.say('🐱存能量');
        }
        
        if (!creep.memory.working) {
            // 前往源存储取能量
            if (creep.room.name !== sourceRoom) {
                creep.moveTo(new RoomPosition(25, 25, sourceRoom), {
                    visualizePathStyle: {stroke: '#ffaa00'}
                });
            } else {
                var result = creep.withdraw(sourceStorage, RESOURCE_ENERGY);
                if (result == ERR_NOT_IN_RANGE) {
                    creep.moveTo(sourceStorage, {
                        visualizePathStyle: {stroke: '#ffaa00'}
                    });
                }
            }
        } else {
            // 前往目标存储存能量
            if (creep.room.name !== targetRoom) {
                creep.moveTo(new RoomPosition(25, 25, targetRoom), {
                    visualizePathStyle: {stroke: '#00ff00'}
                });
            } else {
                var result = creep.transfer(targetStorage, RESOURCE_ENERGY);
                if (result == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetStorage, {
                        visualizePathStyle: {stroke: '#00ff00'}
                    });
                }
            }
        }
    }
};

module.exports = roleCutecat;