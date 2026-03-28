// role.claimer.js - 专职占领者（支持攻击被占领或预定的控制器）
var roleClaimer = {
    /**
     * 生成示例：必须包含 CLAIM 部件，建议[CLAIM, MOVE, MOVE]提高续航
     * Game.spawns['Spawn1'].spawnCreep([CLAIM, MOVE, MOVE], 'Claimer1', {
     *   memory: { role: 'claimer', targetRoom: 'W1N2', arrived: false }
     * });
     * 
     * 注意：占领行为受 GCL 限制，请确保你的 GCL 等级允许占领新房间。
     * 当遇到被其他玩家占领或被预定的控制器时，会自动执行 attackController 削减降级时间或预定时间。
     */
    run: function(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            creep.say('❌无目标');
            return;
        }

        // 如果记忆中没有arrived标志，则初始化
        if (creep.memory.arrived === undefined) creep.memory.arrived = false;

        // 1. 如果尚未“抵达”目标房间，则移动过去
        if (!creep.memory.arrived) {
            if (creep.room.name === targetRoom) {
                creep.memory.arrived = true;
                creep.say('🎯抵达');
            } else {
                this._moveToRoom(creep, targetRoom);
                return;
            }
        }

        // 2. 已抵达目标房间，执行占领/攻击逻辑
        this._doClaimOrAttack(creep);
    },

    _moveToRoom: function(creep, targetRoomName) {
        creep.say('🚀移动');
        const targetPos = new RoomPosition(25, 25, targetRoomName);
        creep.moveTo(targetPos, {
            visualizePathStyle: { stroke: '#ffaa00' },
            reusePath: 8,
            maxOps: 2000,
            ignoreCreeps: false
        });
    },

    _doClaimOrAttack: function(creep) {
        const controller = creep.room.controller;
        if (!controller) {
            creep.say('❌无控制器');
            creep.memory.arrived = false; // 重置状态，允许重新寻找
            return;
        }

        // 检查控制器状态
        const isOwned = controller.owner && !controller.my;
        const isReserved = controller.reservation && controller.reservation.username !== creep.owner.username;

        // 如果被他人占领或被他人预定，优先攻击控制器
        if (isOwned || isReserved) {
            this._attackController(creep, controller);
            return;
        }

        // 如果控制器无主且无预定，则尝试占领
        if (!controller.owner && !controller.reservation) {
            this._claimController(creep, controller);
            return;
        }

        // 如果已被自己占领或预定（正常情况下不会到达这里），则无事可做
        creep.say('✅已完成');
        creep.memory.missionCompleted = true;
    },

    _attackController: function(creep, controller) {
        const attackResult = creep.attackController(controller);
        if (attackResult === OK) {
            creep.say('⚔️攻击成功');
            // 攻击后控制器进入冷却，一段时间内无法再次攻击
        } else if (attackResult === ERR_NOT_IN_RANGE) {
            creep.say('🏃接近');
            creep.moveTo(controller, { range: 1, visualizePathStyle: { stroke: '#ff0000' } });
        } else if (attackResult === ERR_BUSY) {
            creep.say('⏳冷却中');
            // 攻击冷却期间，可以等待，也可以尝试移动或做其他事（比如清理附近威胁）
            // 这里简单等待，如果距离远则移动到附近
            if (creep.pos.getRangeTo(controller) > 1) {
                creep.moveTo(controller, { range: 1 });
            }
        } else if (attackResult === ERR_NO_BODYPART) {
            creep.say('❌无CLAIM');
            // 不应该发生，因为生成时保证了有CLAIM
        } else {
            creep.say('攻击错误:' + attackResult);
        }
    },

    _claimController: function(creep, controller) {
        const claimResult = creep.claimController(controller);
        if (claimResult === OK) {
            creep.say('✅占领成功');
            creep.memory.missionCompleted = true;
            // 占领成功后，此creep通常会自动死亡，因为房间控制器所有者已变更
        } else if (claimResult === ERR_NOT_IN_RANGE) {
            creep.say('🏃接近');
            creep.moveTo(controller, { range: 1, visualizePathStyle: { stroke: '#00ff00' } });
        } else if (claimResult === ERR_GCL_NOT_ENOUGH) {
            creep.say(`❌GCL不足`);
            creep.memory.missionCompleted = true;
        } else if (claimResult === ERR_INVALID_TARGET) {
            // 控制器正在被升级或处于冷却中，尝试预定作为备选
            this._reserveController(creep, controller);
        } else {
            creep.say('占领错误:' + claimResult);
        }
    },

    _reserveController: function(creep, controller) {
        const reserveResult = creep.reserveController(controller);
        if (reserveResult === OK) {
            creep.say('📌预定成功');
        } else if (reserveResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, { range: 1 });
        } else {
            creep.say('预定错误:' + reserveResult);
        }
    }
};

module.exports = roleClaimer;