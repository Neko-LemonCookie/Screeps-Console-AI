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

    const isActive = !!room.memory._emergencyMode;
    const activeSince = room.memory._emergencyMode || 0;
    const duration = Game.time - activeSince;

    // 强制超时退出（500tick足够造出多个creep了）
    if (isActive && duration > 500) {
        delete room.memory._emergencyMode;
        delete room.memory._isEmergencyMode;
        console.log("[" + room.name + "] 🟢 紧急模式强制退出(超时)，creep=" + creepCount);
        return false;
    }

    // 正常退出：有足够人手且能量不太差（25%即可，不再要求50%）
    if (isActive && creepCount >= 2 && avail >= Math.floor(cap / 4)) {
        delete room.memory._emergencyMode;
        delete room.memory._isEmergencyMode;
        console.log("[" + room.name + "] 🟢 紧急模式退出，creep=" + creepCount + " 能量=" + avail + "/" + cap);
        return false;
    }

    // 触发条件：只有真没人的时候才激活（不再因临时能量低谷误触！）
    if (!isActive && creepCount === 0) {
        room.memory._emergencyMode = Game.time;
        console.log("[" + room.name + "] 🔴 紧急模式激活！creep=0 能量=" + avail + "/" + cap);
    } else if (!isActive) {
        return false; // 有人且未激活 → 走正常策略
    }

    // ====== 紧急模式执行 ======
    const taskboard = require('lib.AP.taskboard');

    // 标记紧急状态，让taskhandler的Path B跳过
    room.memory._isEmergencyMode = true;

    // 清除旧任务（每5tick一次，避免每tick重置）
    if (Game.time % 5 === 0) {
        if (Memory.Taskboard && Memory.Taskboard.Task) {
            if (Memory.Taskboard.Task.Strategy && Memory.Taskboard.Task.Strategy[room.name]) {
                Memory.Taskboard.Task.Strategy[room.name] = [];
            }
            if (Memory.Taskboard.Task.Buildings && Memory.Taskboard.Task.Buildings[room.name]) {
                Memory.Taskboard.Task.Buildings[room.name] =
                    (Memory.Taskboard.Task.Buildings[room.name] || []).filter(t => t.type !== 'spawn');
            }
        }
    }

    // 按实际可用能量动态决定体型（不再硬编码small！）
    const targetCreeps = 8;
    const needCount = Math.min(targetCreeps - creepCount, 2);
    if (needCount > 0 && avail >= 200) {
        let bodySize = 'small';
        if (avail >= 800) bodySize = 'large';
        else if (avail >= 400) bodySize = 'medium';

        for (let i = 0; i < needCount; i++) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI', count: 1,
                priority: 'harvest',
                data: { bodySize: bodySize, urgent: true, emergencyMode: true }
            });
        }
    }

    return true;
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
