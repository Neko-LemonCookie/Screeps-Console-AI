// role.mineralCollector.js - 基于claimer的跨房间移动逻辑
var roleClaimer = require('role.claimer');

var roleMineralCollector = {
    run: function(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            creep.say('❌无目标');
            return;
        }

        // 如果记忆中没有arrived标志，则初始化
        if (creep.memory.arrived === undefined) {
            creep.memory.arrived = false;
            creep.memory.homeRoom = creep.memory.homeRoom || creep.room.name;
        }

        // 如果记忆中没有hauling标志，则初始化
        if (creep.memory.hauling === undefined) {
            creep.memory.hauling = false;
        }

        // 状态管理：只在正确的时间切换状态
        this._updateState(creep);

        // 1. 如果尚未"抵达"目标房间，则移动过去（采集状态下）
        if (!creep.memory.hauling && !creep.memory.arrived) {
            // 检查是否已进入目标房间
            if (creep.room.name === targetRoom) {
                creep.memory.arrived = true;
                creep.say('✅到达');
            } else {
                // 使用claimer的移动逻辑
                roleClaimer._moveToRoom(creep, targetRoom);
                return; // 在移动过程中直接返回
            }
        }

        // 2. 如果是运输状态且不在主房间，返回主房间
        if (creep.memory.hauling && creep.room.name !== creep.memory.homeRoom) {
            creep.say('🏠回家');
            roleClaimer._moveToRoom(creep, creep.memory.homeRoom);
            return; // 在移动过程中直接返回
        }

        // 3. 已抵达正确房间，执行工作逻辑
        this._workLoop(creep);
    },

    /** 智能状态更新 */
    _updateState: function(creep) {
        // 检查是否在正确的房间进行状态切换
        const isInTargetRoom = creep.room.name === creep.memory.targetRoom;
        const isInHomeRoom = creep.room.name === creep.memory.homeRoom;

        // 运输状态下且没有资源 -> 切换到采集
        if (creep.memory.hauling && creep.store.getUsedCapacity() === 0) {
            // 只有在主房间时才切换状态，避免在路上切换
            if (isInHomeRoom) {
                creep.memory.hauling = false;
                creep.memory.arrived = false; // 需要重新前往目标房间
                creep.say('⚡采集');
            }
        }
        // 采集状态下且资源满了 -> 切换到运输
        else if (!creep.memory.hauling && creep.store.getFreeCapacity() === 0) {
            // 只有在目标房间时才切换状态，避免在路上切换
            if (isInTargetRoom) {
                creep.memory.hauling = true;
                creep.memory.arrived = false; // 离开目标房间
                creep.say('🚚运输');
            }
        }
    },

    /** 工作循环 */
    _workLoop: function(creep) {
        if (creep.memory.hauling) {
            this._unloadResources(creep);
        } else {
            this._collectMineral(creep);
        }
    },

    /** 采集矿物 */
    _collectMineral: function(creep) {
        // 查找矿物
        let deposit = this._findDeposit(creep);
        if (!deposit) {
            deposit = this._findNewDeposit(creep);
            if (!deposit) {
                creep.say('❌无矿物');
                // 在房间内巡逻寻找
                if (!creep.memory.patrolTarget || Game.time % 50 === 0) {
                    creep.memory.patrolTarget = {
                        x: Math.floor(Math.random() * 40) + 5,
                        y: Math.floor(Math.random() * 40) + 5
                    };
                }
                const target = creep.memory.patrolTarget;
                creep.moveTo(target.x, target.y, { 
                    visualizePathStyle: { stroke: '#aaaaff' },
                    reusePath: 8
                });
                return;
            }
        }

        // 采集矿物
        const result = creep.harvest(deposit);
        
        switch(result) {
            case OK:
                // 每5tick显示一次采集状态
                if (Game.time % 5 === 0) {
                    creep.say(`⛏️ ${creep.store.getUsedCapacity()}`);
                }
                break;
            case ERR_NOT_IN_RANGE:
                creep.moveTo(deposit, {
                    visualizePathStyle: { stroke: '#ffaa00' },
                    range: 1
                });
                break;
            case ERR_NOT_ENOUGH_RESOURCES:
                delete creep.memory.depositId;
                creep.say('💨枯竭');
                break;
            case ERR_BUSY:
                // 等待冷却，每10tick显示一次
                if (Game.time % 10 === 0) {
                    creep.say(`⏳ ${deposit.cooldown}s`);
                }
                break;
            default:
                console.log(`${creep.name} 采集错误: ${result}`);
                delete creep.memory.depositId;
        }
    },

    /** 寻找目标矿物 */
    _findDeposit: function(creep) {
        if (creep.memory.depositId) {
            const deposit = Game.getObjectById(creep.memory.depositId);
            if (deposit && deposit.room && deposit.room.name === creep.room.name) {
                return deposit;
            }
            delete creep.memory.depositId;
        }
        return null;
    },

    /** 寻找新矿物 */
    _findNewDeposit: function(creep) {
        const deposits = creep.room.find(FIND_DEPOSITS);
        if (deposits.length > 0) {
            // 选择最近的矿物
            const closestDeposit = creep.pos.findClosestByRange(deposits);
            if (closestDeposit) {
                creep.memory.depositId = closestDeposit.id;
                creep.memory.depositPos = {
                    x: closestDeposit.pos.x,
                    y: closestDeposit.pos.y,
                    roomName: closestDeposit.pos.roomName
                };
                return closestDeposit;
            }
        }
        
        // 也查找POWER BANK
        const powerBanks = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_POWER_BANK
        });
        
        if (powerBanks.length > 0) {
            const closestPowerBank = creep.pos.findClosestByRange(powerBanks);
            if (closestPowerBank) {
                creep.memory.depositId = closestPowerBank.id;
                creep.memory.depositPos = {
                    x: closestPowerBank.pos.x,
                    y: closestPowerBank.pos.y,
                    roomName: closestPowerBank.pos.roomName
                };
                creep.say('⚡电力');
                return closestPowerBank;
            }
        }
        
        return null;
    },

    /** 卸载资源 */
    _unloadResources: function(creep) {
        // 寻找存储目标
        const target = this._findStorageTarget(creep);
        if (!target) {
            creep.say('❌无存储');
            return;
        }
        
        // 卸载所有类型的资源
        for (const resourceType in creep.store) {
            if (creep.store[resourceType] > 0) {
                const result = creep.transfer(target, resourceType);
                
                if (result === OK) {
                    creep.say(`📦 ${resourceType}`);
                    break;
                } else if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {
                        visualizePathStyle: { stroke: '#ffffff' },
                        range: 1
                    });
                    break;
                } else if (result === ERR_FULL) {
                    creep.say('📦满');
                    delete creep.memory.lastStorageTarget;
                    break;
                }
            }
        }
    },

    /** 寻找存储目标 */
    _findStorageTarget: function(creep) {
        const room = creep.room;
        
        // 优先使用 Storage
        if (room.storage) {
            return room.storage;
        }
        
        // 其次使用 Terminal
        if (room.terminal) {
            return room.terminal;
        }
        
        // 使用 Container
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        if (containers.length > 0) {
            return creep.pos.findClosestByRange(containers);
        }
        
        // 使用 Spawn
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length > 0) {
            return spawns[0];
        }
        
        return null;
    }
};

module.exports = roleMineralCollector;