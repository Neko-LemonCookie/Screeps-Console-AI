/**
 * task.creep.police.js
 * 巡逻/守卫任务执行逻辑。
 * 尊重原有 role.policemaomao.js 的巡逻与追击逻辑。
 * 参数：posOrAuto ('auto' 或 'x,y,roomName')
 */

const taskPolice = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        
        // 检查任务合法性：无结束条件，但若数据丢失或任务被外部删除则清理内存
        if (!data || !data.posOrAuto) {
            this._clearTask(creep);
            return;
        }

        // 1. 优先寻找敌人并追击
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length > 0) {
            const target = creep.pos.findClosestByRange(hostiles);
            this._pursueTarget(creep, target);
            creep.say('⚔️ 发现敌情');
            return;
        }

        // 2. 没有敌人，执行巡逻逻辑
        this._patrol(creep, data.posOrAuto);
    },

    /** 追击并攻击目标 */
    _pursueTarget: function(creep, target) {
        if (creep.getActiveBodyparts(ATTACK) > 0) {
            if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
            }
        }
        if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
            if (creep.rangedAttack(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
            }
        }
    },

    /** 巡逻逻辑 */
    _patrol: function(creep, posOrAuto) {
        if (posOrAuto === 'auto') {
            // 自动模式：在房间内使用 8 向量随机漫步
            this._wander(creep);
            creep.say('🔄 巡逻');
        } else {
            // 指定坐标模式：'x,y,roomName'
            const parts = posOrAuto.split(',');
            if (parts.length === 3) {
                const targetRoom = parts[2];
                if (creep.room.name !== targetRoom) {
                    // 如果不在指定房间，移动过去
                    const pos = new RoomPosition(25, 25, targetRoom);
                    creep.moveTo(pos, { visualizePathStyle: { stroke: '#00ff00' } });
                    creep.say('🛡️ 前往驻防');
                } else {
                    const pos = new RoomPosition(parseInt(parts[0]), parseInt(parts[1]), targetRoom);
                    if (creep.pos.getRangeTo(pos) > 5) {
                        creep.moveTo(pos, { visualizePathStyle: { stroke: '#00ff00' } });
                        creep.say('🛡️ 回范围');
                    } else {
                        // 在坐标附近漫步
                        this._wander(creep, pos, 5);
                        creep.say('🛡️ 驻防');
                    }
                }
            }
        }
    },

    /** 8 向量漫步逻辑 */
    _wander: function(creep, anchorPos, range) {
        if (!creep.memory.wanderDirection || Game.time % 30 === 0) {
            const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
            creep.memory.wanderDirection = directions[Math.floor(Math.random() * directions.length)];
        }

        if (anchorPos && range) {
            // 如果指定了锚点，检查下一步是否超出范围
            const nextPos = this._getPositionInDirection(creep.pos, creep.memory.wanderDirection);
            if (nextPos.getRangeTo(anchorPos) > range) {
                // 超出范围，反向
                creep.memory.wanderDirection = (creep.memory.wanderDirection + 4) % 8 || 8;
            }
        }

        const result = creep.move(creep.memory.wanderDirection);
        if (result === ERR_NO_PATH || Math.random() < 0.05) {
            delete creep.memory.wanderDirection;
        }
    },

    _getPositionInDirection: function(pos, direction) {
        const offsets = {
            [TOP]: {x: 0, y: -1}, [TOP_RIGHT]: {x: 1, y: -1}, [RIGHT]: {x: 1, y: 0}, [BOTTOM_RIGHT]: {x: 1, y: 1},
            [BOTTOM]: {x: 0, y: 1}, [BOTTOM_LEFT]: {x: -1, y: 1}, [LEFT]: {x: -1, y: 0}, [TOP_LEFT]: {x: -1, y: -1}
        };
        const offset = offsets[direction];
        if (!offset) return pos;
        return new RoomPosition(pos.x + offset.x, pos.y + offset.y, pos.roomName);
    },

    /**
     * 清理自身任务内存
     * @private
     */
    _clearTask: function(creep) {
        creep.memory.taskType = null;
        creep.memory.taskData = null;
        creep.memory.taskRoom = null;
        creep.memory.working = false;
        delete creep.memory.wanderDirection;
    }
};

module.exports = taskPolice;
