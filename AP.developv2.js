/**
 * AP.developv2.js - 小房间(5x5模板)策略路由器
 */
const strategyCache = {};

/**
 * 紧急模式：房间无creep时触发，优先恢复采能能力（与v1共享逻辑）
 */
function checkEmergencyMode(room) {
    const creepCount = room.find(FIND_MY_CREEPS).length;
    const cap = room.energyCapacityAvailable;
    const avail = room.energyAvailable;
    const halfCap = Math.floor(cap / 2);

    if (creepCount >= 2 && avail >= halfCap) {
        if (room.memory._emergencyMode) {
            delete room.memory._emergencyMode;
            console.log("[" + room.name + "] 🟢 紧急模式退出，creep=" + creepCount + " 能量=" + avail + "/" + cap);
        }
        return false;
    }

    if (creepCount === 0 || (avail < Math.floor(cap / 4) && creepCount < 3)) {
        if (!room.memory._emergencyMode) {
            room.memory._emergencyMode = Game.time;
            console.log("[" + room.name + "] 🔴 紧急模式激活！creep=" + creepCount + " 能量=" + avail + "/" + cap);
        }
    } else if (!room.memory._emergencyMode) {
        return false;
    }

    const taskboard = require('lib.AP.taskboard');

    if (Memory.Taskboard && Memory.Taskboard.Task) {
        if (Memory.Taskboard.Task.Strategy && Memory.Taskboard.Task.Strategy[room.name]) {
            Memory.Taskboard.Task.Strategy[room.name] = [];
        }
        if (Memory.Taskboard.Task.Buildings && Memory.Taskboard.Task.Buildings[room.name]) {
            Memory.Taskboard.Task.Buildings[room.name] =
                (Memory.Taskboard.Task.Buildings[room.name] || []).filter(t => t.type !== 'spawn');
        }
    }

    const targetCreeps = 8;
    const needCount = Math.min(targetCreeps - creepCount, 3);
    if (needCount > 0 && avail >= 200) {
        for (let i = 0; i < needCount; i++) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI', count: 1,
                priority: 'harvest',
                data: { bodySize: 'small', urgent: true, emergencyMode: true }
            });
        }
    }

    return true;
}

function getStrategy(rcl) {
    const key = 'v2_' + rcl;
    if (!strategyCache[key]) {
        // 小房间(5x5)策略映射：每个RCL都有明确映射
        const strategyMap = {
            1: 'AP.developv2.L4',   // RCL 1-3: 冷启动/早期，复用L4策略
            2: 'AP.developv2.L4',
            3: 'AP.developv2.L4',
            4: 'AP.developv2.L4',   // RCL 4: 刚建Storage
            5: 'AP.developv2.L5',   // RCL 5: Storage稳定运行
            6: 'AP.developv2.L5',   // RCL 6: 解锁Terminal/Lab，但小房间策略不变
            7: 'AP.developv2.max',  // RCL 7: 高级建筑就绪
            8: 'AP.developv2.max'   // RCL 8: 终极
        };
        const path = strategyMap[rcl];
        if (path) {
            try { strategyCache[key] = require(path); }
            catch (e) { console.log("[DevelopV2] ERROR:", e); strategyCache[key] = null; }
        } else { strategyCache[key] = null; }
    }
    return strategyCache[key];
}

const DevelopV2 = {
    run: function() {
        for (const rn in Game.rooms) {
            const room = Game.rooms[rn];
            if (!room.controller || !room.controller.my || room.memory.layoutType !== '5x5') continue;

            // 紧急模式优先：无creep时跳过所有正常策略
            if (checkEmergencyMode(room)) continue;

            const s = getStrategy(room.controller.level);
            if (s && s.run) { try { s.run(room); } catch (e) { console.log("[DevelopV2] ERROR:", e.message); } }
        }
    },
    clearCache: function() { for (const k in strategyCache) delete strategyCache[k]; }
};
module.exports = DevelopV2;
