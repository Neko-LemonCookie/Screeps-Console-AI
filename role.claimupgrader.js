// role.claimUpgrader.js - 远征升级者（支持已控制房间，优化CPU消耗，修复路径问题，自动避开敌占房间）

var roleClaimUpgrader = {
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
                    ignoreCreeps: false
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
        if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.upgrading = false;
        }
        if (!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
            creep.memory.upgrading = true;
        }

        if (creep.memory.upgrading) {
            this._doUpgrade(creep);
        } else {
            this._harvestEnergySimple(creep);
        }
    },

    /** 简化版能量采集（低CPU消耗） */
    _harvestEnergySimple: function(creep) {
        if (creep.store.getFreeCapacity() === 0) {
            creep.memory.upgrading = true;
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
                        ignoreCreeps: true,
                        visualizePathStyle: { stroke: '#ffff00' }
                    });
                } else if (result === OK) {
                    if (creep.store.getFreeCapacity() === 0) {
                        creep.memory.upgrading = true;
                    }
                }
            }
        } else {
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

    /** 升级控制器（仅支持已拥有房间） */
    _doUpgrade: function(creep) {
        var controller = creep.room.controller;
        if (!controller) {
            return;
        }

        var isOwnedByUs = controller.my;
        
        if (isOwnedByUs) {
            if (creep.store[RESOURCE_ENERGY] === 0) {
                creep.memory.upgrading = false;
                return;
            }
            
            var result = creep.upgradeController(controller);
            if (result === OK) {
                if (creep.store[RESOURCE_ENERGY] === 0) {
                    creep.memory.upgrading = false;
                }
            } else if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(controller, {
                    reusePath: 10,
                    ignoreCreeps: true,
                    visualizePathStyle: { stroke: '#00ff00' },
                    range: 3
                });
            }
        } else {
            // creep.say('🏠回家');
            if (creep.memory.originRoom && creep.memory.originRoom !== creep.room.name) {
                creep.memory.arrived = false;
                this._moveToRoomSafe(creep, creep.memory.originRoom);
            } else {
                creep.move(Math.floor(Math.random() * 7));
            }
        }
    }
};

module.exports = roleClaimUpgrader;