// role.policemaomao.js

// 全局攻击函数
global.maomaoattack = function(targetId) {
    const creep = Game.creeps['PoliceTangYuan'];
    if (!creep) {
        console.log('❌ PoliceTangYuan 不存在！');
        return;
    }
    
    const target = Game.getObjectById(targetId);
    if (!target) {
        console.log('❌ 目标不存在！');
        return;
    }
    
    creep.memory.attackTarget = targetId;
    creep.memory.customAttack = true;
    console.log('🚨 PoliceTangYuan 已收到指令，正在前往攻击 ' + targetId);
};

// 主运行逻辑
function run(creep) {
    // 初始化记忆
    if (!creep.memory.initialized) {
        creep.memory.initialized = true;
        creep.memory.homeRoom = creep.room.name;
        creep.say('👮 上岗');
    }
    
    // 显示状态
    displayStatus(creep);
    
    // 检查是否需要返回（自定义攻击完成后）
    if (creep.memory.customAttack && !creep.memory.attackTarget) {
        returnHome(creep);
        return;
    }
    
    // 攻击模式优先级最高
    if (creep.memory.attackTarget) {
        // 追击目标
        if (pursueTarget(creep)) {
            return;
        }
    }
    
    // 检查驻守旗帜
    const standbyFlag = Game.flags['PoliceTangYuanStandby'];
    if (standbyFlag) {
        // 在驻守旗帜的房间巡逻（限制在20格范围内）
        patrolAroundFlag(creep, standbyFlag);
        return;
    }
    
    // 默认在自己房间巡逻
    defaultPatrol(creep);
}

// 显示状态
function displayStatus(creep) {
    if (creep.memory.attackTarget) {
        creep.say('⚔️ 攻击');
    } else if (creep.memory.customAttack && creep.room.name !== creep.memory.homeRoom) {
        creep.say('🏠 回家');
    } else if (Game.flags['PoliceTangYuanStandby']) {
        creep.say('🛡️ 驻防');
    } else {
        creep.say('🔄 巡逻');
    }
}

// 在旗帜周围20格内巡逻（使用8向量移动）
function patrolAroundFlag(creep, standbyFlag) {
    const standbyRoomName = standbyFlag.pos.roomName;
    
    // 如果不在驻守房间，前往驻守房间
    if (creep.room.name !== standbyRoomName) {
        creep.moveTo(new RoomPosition(25, 25, standbyRoomName), {
            visualizePathStyle: {stroke: '#ffff00'},
            reusePath: 20
        });
        creep.say('🛡️ 去驻防');
        return;
    }
    
    // 检查是否在旗帜20格范围内
    const distanceToFlag = creep.pos.getRangeTo(standbyFlag);
    
    // 如果距离旗帜超过20格，返回旗帜附近
    if (distanceToFlag > 20) {
        creep.moveTo(standbyFlag, {
            visualizePathStyle: {stroke: '#ffff00'},
            reusePath: 10,
            range: 15 // 移动到距离旗帜15格以内
        });
        creep.say('🛡️ 回范围');
        return;
    }
    
    // 已经在20格范围内，先寻找敌人
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
        const target = creep.pos.findClosestByRange(hostiles);
        creep.memory.attackTarget = target.id;
        creep.say('⚔️ 发现敌情');
        return;
    }
    
    // 没有敌人，在20格范围内使用8向量移动巡逻
    if (!creep.memory.wanderDirection || Game.time % 30 === 0) {
        const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, 
                          BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        creep.memory.wanderDirection = directions[Math.floor(Math.random() * directions.length)];
    }
    
    // 检查如果朝这个方向移动，是否还在20格范围内
    const nextPos = getPositionInDirection(creep.pos, creep.memory.wanderDirection);
    const nextDistance = getDistance(nextPos, standbyFlag.pos);
    
    // 如果下一步会超出20格范围，选择一个相反方向或重新选择
    if (nextDistance > 20) {
        // 选择反向或随机方向
        const reverseDirection = (creep.memory.wanderDirection + 4) % 8 || 8;
        creep.memory.wanderDirection = reverseDirection;
    }
    
    // 移动
    const result = creep.move(creep.memory.wanderDirection);
    if (result === ERR_NO_PATH) {
        delete creep.memory.wanderDirection;
    }
    
    // 偶尔随机改变方向
    if (Math.random() < 0.05) {
        delete creep.memory.wanderDirection;
    }
}

// 计算某个方向移动后的位置
function getPositionInDirection(pos, direction) {
    const offsets = {
        [TOP]: {x: 0, y: -1},
        [TOP_RIGHT]: {x: 1, y: -1},
        [RIGHT]: {x: 1, y: 0},
        [BOTTOM_RIGHT]: {x: 1, y: 1},
        [BOTTOM]: {x: 0, y: 1},
        [BOTTOM_LEFT]: {x: -1, y: 1},
        [LEFT]: {x: -1, y: 0},
        [TOP_LEFT]: {x: -1, y: -1}
    };
    
    const offset = offsets[direction];
    return new RoomPosition(pos.x + offset.x, pos.y + offset.y, pos.roomName);
}

// 计算两点之间的距离（简化版，不跨房间）
function getDistance(pos1, pos2) {
    if (pos1.roomName !== pos2.roomName) {
        return Infinity; // 不同房间视为无限远
    }
    return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
}

// 默认巡逻（在自己房间，使用8向量移动）
function defaultPatrol(creep) {
    // 在自己房间寻找敌人
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
        const target = creep.pos.findClosestByRange(hostiles);
        creep.memory.attackTarget = target.id;
        return;
    }
    
    // 没有敌人，使用8向量随机移动
    if (!creep.memory.wanderDirection || Game.time % 30 === 0) {
        const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, 
                          BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        creep.memory.wanderDirection = directions[Math.floor(Math.random() * directions.length)];
    }
    
    const result = creep.move(creep.memory.wanderDirection);
    if (result === ERR_NO_PATH) {
        delete creep.memory.wanderDirection;
    }
    
    // 偶尔随机改变方向
    if (Math.random() < 0.05) {
        delete creep.memory.wanderDirection;
    }
}

// 追击目标（优化版 - 重用路径，提前预判）
function pursueTarget(creep) {
    const target = Game.getObjectById(creep.memory.attackTarget);
    
    if (!target) {
        // 目标已死或不存在
        clearTarget(creep);
        return false;
    }
    
    // 检查攻击类型
    const hasRangedAttack = creep.getActiveBodyparts(RANGED_ATTACK) > 0;
    const hasAttack = creep.getActiveBodyparts(ATTACK) > 0;
    
    // 计算距离
    const distance = creep.pos.getRangeTo(target);
    
    // 如果有远程攻击能力，优先使用
    if (hasRangedAttack) {
        // 如果距离在3格以内，进行远程攻击
        if (distance <= 3) {
            // 多目标攻击：攻击目标及其附近的敌人
            const hostilesNearby = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3);
            if (hostilesNearby.length > 1) {
                creep.rangedMassAttack();
            } else {
                creep.rangedAttack(target);
            }
            
            // 如果距离过近，后退保持距离
            if (distance < 2) {
                const direction = creep.pos.getDirectionTo(target);
                creep.move((direction + 4) % 8);
                return true;
            }
        }
        
        // 追击敌人 - 使用优化的路径
        chaseWithSmartPathing(creep, target, 3);
    } 
    // 如果有近战攻击能力
    else if (hasAttack) {
        // 如果已经贴近敌人，进行攻击
        if (distance <= 1) {
            creep.attack(target);
        }
        
        // 追击敌人
        chaseWithSmartPathing(creep, target, 1);
    }
    // 只有移动部件
    else {
        // 冲撞敌人
        chaseWithSmartPathing(creep, target, 1);
    }
    
    return true;
}

// 智能追击路径（重用路径，减少CPU消耗）
function chaseWithSmartPathing(creep, target, range) {
    // 如果目标在同一个房间
    if (creep.room.name === target.room.name) {
        // 使用高度重用的路径，减少CPU消耗
        creep.moveTo(target, {
            visualizePathStyle: {stroke: '#ff0000'},
            reusePath: 3,  // 重用路径3次，平衡性能和反应速度
            ignoreCreeps: false,
            range: range,
            maxOps: 1000  // 降低最大操作数，提高速度
        });
    } 
    // 跨房间追击
    else {
        // 使用跨房间路径，重用路径更多
        creep.moveTo(target, {
            visualizePathStyle: {stroke: '#ff0000'},
            reusePath: 10,  // 跨房间路径重用更多
            ignoreCreeps: true,  // 跨房间时忽略其他creep
            range: range,
            maxOps: 2000
        });
    }
}

// 清除目标
function clearTarget(creep) {
    delete creep.memory.attackTarget;
    delete creep.memory.customAttack;
    
    // 清除巡逻方向，让巡逻重新选择方向
    delete creep.memory.wanderDirection;
    
    // 检查是否还有敌人
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
        // 还有敌人，继续攻击
        const target = creep.pos.findClosestByRange(hostiles);
        creep.memory.attackTarget = target.id;
        creep.say('⚔️ 下一个');
        return;
    }
    
    // 返回驻守或巡逻
    if (Game.flags['PoliceTangYuanStandby']) {
        creep.say('🛡️ 回驻防');
    } else {
        creep.say('🔄 巡逻');
    }
}

// 返回家园
function returnHome(creep) {
    const homeRoom = creep.memory.homeRoom || creep.room.name;
    
    if (creep.room.name === homeRoom) {
        // 已经在家，检查是否有驻守旗帜
        if (Game.flags['PoliceTangYuanStandby']) {
            creep.say('🛡️ 去驻防');
        } else {
            creep.say('🔄 巡逻');
        }
        return;
    }
    
    // 返回家园
    const exitDir = creep.room.findExitTo(homeRoom);
    const exit = creep.pos.findClosestByRange(exitDir);
    if (exit) {
        creep.moveTo(exit, {
            visualizePathStyle: {stroke: '#00ff00'},
            reusePath: 10,
            ignoreCreeps: true
        });
    }
}

// 导出模块
module.exports = {
    run: run
};