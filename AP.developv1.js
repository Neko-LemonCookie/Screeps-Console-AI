/**
 * AP.developv1.js - 大房间(9x9模板)策略路由器
 */

const strategyCache = {};

function getStrategy(rcl) {
    const key = 'v1_' + rcl;
    if (!strategyCache[key]) {
        // RCL到策略文件的映射表（每个RCL都有明确映射，避免fallback到null）
        const strategyMap = {
            3: 'AP.developv1.L3',   // RCL 3-4: 早期，无Storage
            4: 'AP.developv1.L3',
            5: 'AP.developv1.L5',   // RCL 5-6: 中期，有Storage无Terminal/Lab
            6: 'AP.developv1.L5',
            7: 'AP.developv1.L7',   // RCL 7: 后期，有Terminal/Lab/Factory
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
            if (!room.controller?.my) continue;
            if (room.memory.layoutType !== '9x9') continue;
            const rcl = room.controller.level;
            const strategy = getStrategy(rcl);
            if (strategy?.run) {
                try { strategy.run(room); }
                catch (e) { console.log("[DevelopV1] ERROR: 执行错误 (" + roomName + " RCL" + rcl + "):", e.message); }
            }
        }
    },
    clearCache: function() { for (const key in strategyCache) delete strategyCache[key]; }
};

module.exports = DevelopV1;
