/**
 * AP.developv1.js - 大房间(9x9模板)策略路由器
 */

const strategyCache = {};

/**
 * 紧急模式：房间无creep时触发，优先恢复采能能力
 * 清除所有非收获者任务，批量生成CommonI直到能量恢复到容量一半
 */
function checkEmergencyMode(room) {
    const creepCount = room.find(FIND_MY_CREEPS).length;
    const cap = room.energyCapacityAvailable;
    const avail = room.energyAvailable;
    const halfCap = Math.floor(cap / 2);

    // 已有足够creep且能量过半 → 正常退出紧急模式
    if (creepCount >= 2 && avail >= halfCap) {
        if (room.memory._emergencyMode) {
            delete room.memory._emergencyMode;
            console.log("[" + room.name + "] 🟢 紧急模式退出，creep=" + creepCount + " 能量=" + avail + "/" + cap);
        }
        return false;
    }

    // 触发条件：无creep 或 能量严重不足（<容量的1/4）且creep太少
    if (creepCount === 0 || (avail < Math.floor(cap / 4) && creepCount < 3)) {
        if (!room.memory._emergencyMode) {
            room.memory._emergencyMode = Game.time;
            console.log("[" + room.name + "] 🔴 紧急模式激活！creep=" + creepCount + " 能量=" + avail + "/" + cap);
        }
    } else if (!room.memory._emergencyMode) {
        return false; // 不满足紧急条件且未激活
    }

    // ====== 紧急模式执行 ======
    const taskboard = require('lib.AP.taskboard');

    // 1. 清除该房间所有旧策略任务和spawn任务，避免冲突
    if (Memory.Taskboard && Memory.Taskboard.Task) {
        if (Memory.Taskboard.Task.Strategy && Memory.Taskboard.Task.Strategy[room.name]) {
            Memory.Taskboard.Task.Strategy[room.name] = [];
        }
        if (Memory.Taskboard.Task.Buildings && Memory.Taskboard.Task.Buildings[room.name]) {
            // 只清除spawn任务，保留produce/market等其他建筑任务
            Memory.Taskboard.Task.Buildings[room.name] =
                (Memory.Taskboard.Task.Buildings[room.name] || []).filter(t => t.type !== 'spawn');
        }
    }

    // 2. 按当前实际可用能量生成CommonI任务（动态体型）
    const targetCreeps = 8;
    const currentCreeps = creepCount;
    const needCount = Math.min(targetCreeps - currentCreeps, 3); // 每次最多补3个避免队列爆炸
    if (needCount > 0 && avail >= 200) {
        for (let i = 0; i < needCount; i++) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI', count: 1,
                priority: 'harvest',
                data: { bodySize: 'small', urgent: true, emergencyMode: true }
            });
        }
    }

    return true; // 告诉调用方跳过正常策略
}

function getStrategy(rcl) {
    const key = 'v1_' + rcl;
    if (!strategyCache[key]) {
        // RCL到策略文件的映射表（每个RCL都有明确映射，避免fallback到null）
        const strategyMap = {
            1: 'AP.developv1.L3',   // RCL 1-3: 冷启动，无Storage
            2: 'AP.developv1.L3',
            3: 'AP.developv1.L3',
            4: 'AP.developv1.L5',   // RCL 4: 刚建Storage，进入中期策略
            5: 'AP.developv1.L5',   // RCL 5-6: 中期，Storage稳定
            6: 'AP.developv1.L5',
            7: 'AP.developv1.L7',   // RCL 7: 后期，Terminal/Lab/Factory
            8: 'AP.developv1.max'    // RCL 8: 终极形态
        };
        const strategyPath = strategyMap[rcl];
        if (strategyPath) {
            try { strategyCache[key] = require(strategyPath); }
            catch (e) { console.log("[DevelopV1] ERROR: 加载失败: " + strategyPath, e); strategyCache[key] = null; }
        } else { strategyCache[key] = null; }
    }
    return strategyCache[key];
}

const DevelopV1 = {
    run: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;
            if (room.memory.layoutType !== '9x9') continue;

            // 紧急模式优先：无creep时跳过所有正常策略，全力恢复采能
            if (checkEmergencyMode(room)) continue;

            const rcl = room.controller.level;
            const strategy = getStrategy(rcl);
            if (strategy && strategy.run) {
                try { strategy.run(room); }
                catch (e) { console.log("[DevelopV1] ERROR: 执行错误 (" + roomName + " RCL" + rcl + "):", e.message); }
            }
        }
    },
    clearCache: function() { for (const key in strategyCache) delete strategyCache[key]; }
};

module.exports = DevelopV1;
;
