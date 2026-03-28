// role.claimBuilder.js - 远程建造者（跨房间建造，自动避开敌占房间）

var roleClaimBuilder = {
    run: function(creep) {
        var targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            return;
        }

        if (creep.memory.arrived === undefined) creep.memory.arrived = false;

        if (!creep.memory.arrived) {
            if (creep.room.name === targetRoom) {
                creep.memory.arrived = true;
                // 清除路径缓存
                delete creep.memory._route;
                delete creep.memory._routeStep;
            } else {
                this._moveToRoomSafe(creep, targetRoom);
                return;
            }
        }

        this._workLoop(creep);
    },

    /** 安全房间间移动（自动避开敌占房间） */
    _moveToRoomSafe: function(creep, targetRoomName) {
        // 如果已有路径缓存且路径最后一个房间是目标房间，则继续使用
        if (!creep.memory._route || creep.memory._route[creep.memory._route.length - 1] !== targetRoomName) {
            // 重新计算安全路径
            const route = Game.map.findRoute(creep.room.name, targetRoomName, {
                routeCallback: (roomName, fromRoomName) => {
                    // 检查房间是否被敌人占领
                    const room = Game.rooms[roomName];
                    if (room && room.controller && room.controller.owner && !room.controller.my) {
                        // 敌对房间，不可通过
                        return Infinity;
                    }
                    // 默认权重
                    return 1;
                }
            });

            if (route !== ERR_NO_PATH) {
                creep.memory._route = route.map(r => r.room);
                creep.memory._routeStep = 0;
            } else {
                // 无安全路径，回退到直接移动（可能会冒险）
                creep.moveTo(new RoomPosition(25, 25, targetRoomName), {
                    reusePath: 8,
                    maxOps: 2000,
                    ignoreCreeps: false,
                    plainCost: 2,
                    swampCost: 10,
                    maxRooms: 16
                });
                return;
            }
        }

        const route = creep.memory._route;
        let step = creep.memory._routeStep;

        // 如果当前房间就是路径中当前步的房间，则说明已经到达该步，前进到下一步
        if (creep.room.name === route[step]) {
            creep.memory._routeStep++;
            step++;
        }

        // 如果已经走完所有步，说明到达目标房间
        if (step >= route.length) {
            delete creep.memory._route;
            delete creep.memory._routeStep;
            // 再次检查是否真的到达目标房间（理论上应该是）
            if (creep.room.name !== targetRoomName) {
                // 没到？重新计算
                this._moveToRoomSafe(creep, targetRoomName);
            }
            return;
        }

        // 移动到下一个房间的出口
        const nextRoom = route[step];
        const exitDir = creep.room.findExitTo(nextRoom);
        if (exitDir >= 0) {
            const exit = creep.pos.findClosestByRange(exitDir);
            if (exit) {
                creep.moveTo(exit, {
                    reusePath: 5,
                    visualizePathStyle: { stroke: '#ffaa00' }
                });
            } else {
                // 找不到出口，重新计算路径
                delete creep.memory._route;
            }
        } else {
            // 无法找到出口，重新计算
            delete creep.memory._route;
        }
    },

    /** 工作循环（核心） */
    _workLoop: function(creep) {
        if (creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.building = false;
        }
        if (!creep.memory.building && creep.store.getFreeCapacity() == 0) {
            creep.memory.building = true;
        }

        if (creep.memory.building) {
            this._doBuild(creep);
        } else {
            this._harvestEnergySimple(creep);
        }
    },

    /** 简化版能量采集 */
    _harvestEnergySimple: function(creep) {
        if (creep.store.getFreeCapacity() === 0) {
            creep.memory.building = true;
            return;
        }
        
        const sources = creep.room.find(FIND_SOURCES_ACTIVE);
        if (sources.length > 0) {
            const source = creep.pos.findClosestByRange(sources);
            if (source) {
                const result = creep.harvest(source);
                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, {
                        reusePath: 5,
                        ignoreCreeps: false,
                        visualizePathStyle: { stroke: '#ffff00' }
                    });
                } else if (result === OK) {
                    if (creep.store.getFreeCapacity() === 0) {
                        creep.memory.building = true;
                    }
                }
            }
        } else {
            // 没有活跃source，返回origin或随机移动
            if (creep.room.controller && !creep.room.controller.my) {
                if (creep.memory.originRoom && creep.memory.originRoom !== creep.room.name) {
                    creep.memory.arrived = false;
                    this._moveToRoomSafe(creep, creep.memory.originRoom);
                } else {
                    creep.move(Math.floor(Math.random() * 7));
                }
            }
        }
    },

    /** 建造工作（优先建造Spawn） */
    _doBuild: function(creep) {
        // 优先建造Spawn
        let spawnSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: (site) => site.structureType === STRUCTURE_SPAWN
        });
        
        if (spawnSites.length > 0) {
            let target = spawnSites[0];
            let result = creep.build(target);
            
            if (result === OK) {
                // 成功建造
            } else if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    reusePath: 8,
                    ignoreCreeps: false,
                    visualizePathStyle: { stroke: '#ffffff' }
                });
            }
            return;
        }
        
        // 没有Spawn工地时，建造其他结构
        let target = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);
        if (target) {
            let result = creep.build(target);
            
            if (result === OK) {
                // 成功建造
            } else if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    reusePath: 8,
                    ignoreCreeps: false,
                    visualizePathStyle: { stroke: '#ffffff' }
                });
            }
        } else {
            // 没有工地，开始修理
            this._doRepair(creep);
        }
    },
    
    /** 修理功能（备用） */
    _doRepair: function(creep) {
        let repairTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_SPAWN ||
                        structure.structureType === STRUCTURE_CONTAINER ||
                        structure.structureType === STRUCTURE_ROAD) &&
                       structure.hits < structure.hitsMax * 0.8;
            }
        });
        
        if (repairTarget) {
            let result = creep.repair(repairTarget);
            
            if (result === OK) {
                // 成功修理
            } else if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(repairTarget, {
                    reusePath: 10,
                    ignoreCreeps: false,
                    visualizePathStyle: { stroke: '#ffaa00' }
                });
            }
        } else {
            // 没有东西可修理，开始升级控制器
            this._doUpgrade(creep);
        }
    },
    
    /** 升级控制器（最后选择） */
    _doUpgrade: function(creep) {
        var controller = creep.room.controller;
        if (!controller) {
            return;
        }

        var isOwnedByUs = controller.my;
        
        if (isOwnedByUs) {
            var result = creep.upgradeController(controller);
            if (result === OK) {
                // 成功升级
            } else if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(controller, {
                    reusePath: 8,
                    ignoreCreeps: false,
                    visualizePathStyle: { stroke: '#9900ff' }
                });
            }
        }
    }
};

module.exports = roleClaimBuilder;