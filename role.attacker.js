// role.attacker.js - 攻击者角色（包含破墙、攻击核心、攻击Spawn、攻击控制器）
var roleAttacker = {
    // 主运行函数
    run: function(creep) {
        // 如果未分配目标房间，则待机
        if (!creep.memory.targetRoom) {
            creep.say('💤待命');
            return;
        }

        // 如果不在目标房间，则持续前往
        if (creep.room.name !== creep.memory.targetRoom) {
            this._moveToTargetRoom(creep);
            return;
        }

        // 已到达目标房间，按优先级执行战斗
        this._executeCombatWithPriority(creep);
    },

    // 持续移动到目标房间
    _moveToTargetRoom: function(creep) {
        creep.say('🚀进军');
        let exitDir = creep.room.findExitTo(creep.memory.targetRoom);
        if (exitDir < 0) {
            creep.say('❌无路');
            return;
        }
        let exit = creep.pos.findClosestByRange(exitDir);
        creep.moveTo(exit, {
            reusePath: 5,
            visualizePathStyle: { stroke: '#ff0000' }
        });
    },

    // 【核心战斗逻辑】优先级：核心/Spawn > 敌方单位 > 破控制器周围的墙 > 控制器 > 挡路墙
    _executeCombatWithPriority: function(creep) {
        const targetRoom = Game.rooms[creep.memory.targetRoom];
        if (!targetRoom) return;

        // 1. 【最高优先级】Invader Core 和 敌方 Spawn（两者不会共存，先后检查即可）
        // 先检查 Invader Core
        const enemyCore = targetRoom.find(FIND_HOSTILE_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_INVADER_CORE
        });
        if (enemyCore.length > 0) {
            let core = enemyCore[0];
            if (creep.attack(core) === ERR_NOT_IN_RANGE) {
                this._smartMoveTo(creep, core);
            }
            creep.say('💥核心');
            return;
        }

        // 再检查敌方 Spawn
        const enemySpawns = targetRoom.find(FIND_HOSTILE_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_SPAWN
        });
        if (enemySpawns.length > 0) {
            let targetSpawn = creep.pos.findClosestByRange(enemySpawns);
            if (creep.attack(targetSpawn) === ERR_NOT_IN_RANGE) {
                this._smartMoveTo(creep, targetSpawn);
            }
            creep.say('💥爆spawn');
            return;
        }

        // 2. 【次优先级】攻击其他敌方单位
        let hostiles = targetRoom.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length > 0) {
            let target = creep.pos.findClosestByRange(hostiles);
            if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                this._smartMoveTo(creep, target);
            }
            creep.say('⚔️清兵');
            return;
        }

        // 3. 【控制器周围的墙】检查控制器周围是否有墙，并优先拆除
        let controller = targetRoom.controller;
        if (controller && !controller.my) {
            // 放弃攻击受保护的新玩家控制器
            if (controller.level === 1 && controller.progress === 0) {
                creep.say('🛡️受保护');
                delete creep.memory.targetRoom;
                return;
            }
            
            // 检查控制器周围2格内是否有墙
            const wallsNearController = this._findWallsNearController(creep, controller, 2);
            if (wallsNearController.length > 0) {
                // 攻击控制器周围的所有墙（用 dismantle）
                this._attackAllWallsNearController(creep, wallsNearController);
                creep.say('🧱拆围');
                return; // 拆墙期间不执行后续
            }
        }

        // 4. 攻击控制器
        if (controller && !controller.my) {
            if (creep.attackController(controller) === ERR_NOT_IN_RANGE) {
                this._smartMoveTo(creep, controller);
            }
            creep.say('🎯夺控');
            return;
        }

        // 5. 攻击挡路的墙（低血量墙或关键路径上的墙）
        const blockingWalls = this._findBlockingWalls(creep);
        if (blockingWalls.length > 0) {
            let closestWall = creep.pos.findClosestByRange(blockingWalls);
            if (creep.dismantle(closestWall) === ERR_NOT_IN_RANGE) {
                creep.moveTo(closestWall, {
                    reusePath: 0,
                    maxOps: 2000,
                    visualizePathStyle: { stroke: '#ff9900' }
                });
            }
            creep.say('🧱破墙');
            return;
        }

        // 6. 所有目标清除完毕
        creep.say('✅完胜');
    },

    // 【查找控制器周围的墙】
    _findWallsNearController: function(creep, controller, range) {
        const targetRoom = Game.rooms[creep.memory.targetRoom];
        if (!targetRoom) return [];

        return targetRoom.find(FIND_STRUCTURES, {
            filter: (structure) => 
                structure.structureType === STRUCTURE_WALL &&
                structure.pos.getRangeTo(controller) <= range
        });
    },

    // 【攻击控制器周围的所有墙】（使用 dismantle）
    _attackAllWallsNearController: function(creep, walls) {
        // 如果当前正在攻击的墙已经被摧毁，选择下一个墙
        if (creep.memory.attackingWallId) {
            const wall = Game.getObjectById(creep.memory.attackingWallId);
            if (!wall || wall.hits <= 0) {
                delete creep.memory.attackingWallId;
            }
        }
        
        // 如果没有当前目标墙，选择一面墙（优先选血量最低的快速突破）
        if (!creep.memory.attackingWallId) {
            const sortedWalls = _.sortBy(walls, w => w.hits);
            if (sortedWalls.length > 0) {
                creep.memory.attackingWallId = sortedWalls[0].id;
            }
        }
        
        // 攻击目标墙
        if (creep.memory.attackingWallId) {
            const wall = Game.getObjectById(creep.memory.attackingWallId);
            if (wall && wall.hits > 0) {
                if (creep.dismantle(wall) === ERR_NOT_IN_RANGE) {
                    this._smartMoveTo(creep, wall);
                }
                return true;
            }
        }
        
        return false;
    },

    // 【检查所有墙是否已被摧毁】
    _checkAllWallsDestroyed: function(walls) {
        for (const wall of walls) {
            if (wall && wall.hits > 0) {
                return false;
            }
        }
        return true;
    },

    // 【智能移动：遇到墙阻挡时尝试拆除】
    _smartMoveTo: function(creep, target) {
        const moveResult = creep.moveTo(target, {
            reusePath: 5,
            maxOps: 1000,
            visualizePathStyle: { stroke: '#ff0000' }
        });

        // 如果移动失败或路径被阻挡，检查附近是否有可拆的墙
        if (moveResult === ERR_NO_PATH || moveResult === ERR_INVALID_TARGET) {
            const nearbyWalls = creep.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: (s) => s.structureType === STRUCTURE_WALL && s.hits <= 5
            });
            
            if (nearbyWalls.length > 0) {
                const closestWall = creep.pos.findClosestByRange(nearbyWalls);
                // 注意：拆墙必须用 dismantle
                if (creep.dismantle(closestWall) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(closestWall);
                }
                creep.say('🧱通路');
                return;
            }
        }
    },

    // 【寻找挡路的墙】（低血量且靠近关键建筑或控制器的墙）
    _findBlockingWalls: function(creep) {
        const targetRoom = Game.rooms[creep.memory.targetRoom];
        if (!targetRoom) return [];

        const lowHpWalls = targetRoom.find(FIND_STRUCTURES, {
            filter: (structure) => 
                structure.structureType === STRUCTURE_WALL && 
                structure.hits <= 5
        });

        // 优先攻击靠近敌方关键建筑的墙
        const enemyStructures = targetRoom.find(FIND_HOSTILE_STRUCTURES, {
            filter: (s) => [STRUCTURE_SPAWN, STRUCTURE_TOWER, STRUCTURE_EXTENSION].includes(s.structureType)
        });
        
        const criticalWalls = [];
        if (enemyStructures.length > 0) {
            for (const wall of lowHpWalls) {
                for (const structure of enemyStructures) {
                    if (wall.pos.getRangeTo(structure) <= 3) {
                        criticalWalls.push(wall);
                        break;
                    }
                }
            }
        }
        
        // 如果没找到关键墙，找靠近控制器的墙
        if (criticalWalls.length === 0 && lowHpWalls.length > 0) {
            const controller = targetRoom.controller;
            if (controller) {
                return lowHpWalls.filter(wall => 
                    wall.pos.getRangeTo(controller) <= 10
                );
            }
        }
        
        return criticalWalls.length > 0 ? criticalWalls : lowHpWalls;
    },

    // 【指派任务】为所有攻击者设置目标房间
    assignMission: function(roomName) {
        _.filter(Game.creeps, c => c.memory.role === 'attacker').forEach(creep => {
            creep.memory.targetRoom = roomName;
            creep.say('🎯新目标');
        });
        console.log(`已指派所有攻击者攻击 ${roomName}，将自动破墙`);
    }
};

module.exports = roleAttacker;