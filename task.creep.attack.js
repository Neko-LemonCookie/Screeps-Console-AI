/**
 * task.creep.attack.js
 * 攻击任务执行逻辑。
 * 尊重原有 role.attacker.js 的完整优先级战斗逻辑。
 * 参数：targetRoomName
 */

const taskHelper = require('lib.AP.taskHelper');

const taskAttack = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        if (!data || !data.targetRoomName) {
            creep.say('💤待命');
            return;
        }

        // 如果不在目标房间，则持续前往
        if (creep.room.name !== data.targetRoomName) {
            this._moveToTargetRoom(creep, data.targetRoomName);
            return;
        }

        // 已到达目标房间，按优先级执行战斗
        this._executeCombatWithPriority(creep, data.targetRoomName);
    },

    /** 持续移动到目标房间 */
    _moveToTargetRoom: function(creep, targetRoomName) {
        creep.say('🚀进军');
        let exitDir = creep.room.findExitTo(targetRoomName);
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

    /** 【核心战斗逻辑】优先级：核心/Spawn > 敌方单位 > 破控制器周围的墙 > 控制器 > 挡路墙 */
    _executeCombatWithPriority: function(creep, targetRoomName) {
        const targetRoom = Game.rooms[targetRoomName];
        if (!targetRoom) return;

        // 1. 【最高优先级】Invader Core 和 敌方 Spawn
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

        // 3. 【控制器周围的墙】拆除控制器周围墙壁
        let controller = targetRoom.controller;
        if (controller && !controller.my) {
            if (controller.level === 1 && controller.progress === 0) {
                creep.say('🛡️受保护');
                return;
            }
            
            const wallsNearController = this._findWallsNearController(targetRoom, controller, 2);
            if (wallsNearController.length > 0) {
                this._attackAllWallsNearController(creep, wallsNearController);
                creep.say('🧱拆围');
                return;
            }
        }

        // 4. 攻击控制器：在走到夺控那一步时结束任务
        if (controller && !controller.my) {
            taskHelper.completeTask(creep);
            return;
        }

        // 5. 攻击挡路的墙
        const blockingWalls = this._findBlockingWalls(targetRoom, creep);
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

        creep.say('✅完胜');
    },

    _findWallsNearController: function(room, controller, range) {
        return room.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_WALL && s.pos.getRangeTo(controller) <= range
        });
    },

    _attackAllWallsNearController: function(creep, walls) {
        if (creep.memory.attackingWallId) {
            const wall = Game.getObjectById(creep.memory.attackingWallId);
            if (!wall || wall.hits <= 0) delete creep.memory.attackingWallId;
        }
        
        if (!creep.memory.attackingWallId) {
            const sortedWalls = _.sortBy(walls, w => w.hits);
            if (sortedWalls.length > 0) creep.memory.attackingWallId = sortedWalls[0].id;
        }
        
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

    _smartMoveTo: function(creep, target) {
        const moveResult = creep.moveTo(target, {
            reusePath: 5,
            maxOps: 1000,
            visualizePathStyle: { stroke: '#ff0000' }
        });

        if (moveResult === ERR_NO_PATH || moveResult === ERR_INVALID_TARGET) {
            const nearbyWalls = creep.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: (s) => s.structureType === STRUCTURE_WALL && s.hits <= 5
            });
            if (nearbyWalls.length > 0) {
                const closestWall = creep.pos.findClosestByRange(nearbyWalls);
                if (creep.dismantle(closestWall) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(closestWall);
                }
                creep.say('🧱通路');
            }
        }
    },

    _findBlockingWalls: function(room, creep) {
        const lowHpWalls = room.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_WALL && s.hits <= 5
        });

        const enemyStructures = room.find(FIND_HOSTILE_STRUCTURES, {
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
        
        if (criticalWalls.length === 0 && lowHpWalls.length > 0) {
            const controller = room.controller;
            if (controller) {
                return lowHpWalls.filter(wall => wall.pos.getRangeTo(controller) <= 10);
            }
        }
        
        // 如果没有任何攻击目标，且房间内也没有任何敌对建筑/单位，说明任务完成
        if (criticalWalls.length === 0 && lowHpWalls.length === 0) {
            const hostileAny = room.find(FIND_HOSTILE_STRUCTURES).length > 0 || room.find(FIND_HOSTILE_CREEPS).length > 0;
            if (!hostileAny) {
                taskHelper.completeTask(creep);
            }
        }
        
        return criticalWalls.length > 0 ? criticalWalls : lowHpWalls;
    },

};

module.exports = taskAttack;
