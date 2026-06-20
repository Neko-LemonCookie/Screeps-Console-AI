/**
 * AP.developv2.js - 小房间(5x5模板)策略路由器
 */
const strategyCache = {};

function getStrategy(rcl) {
    const key = 'v2_' + rcl;
    if (!strategyCache[key]) {
        // 小房间(5x5)策略映射：每个RCL都有明确映射
        const strategyMap = {
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
            const s = getStrategy(room.controller.level);
            if (s && s.run) { try { s.run(room); } catch (e) { console.log("[DevelopV2] ERROR:", e.message); } }
        }
    },
    clearCache: function() { for (const k in strategyCache) delete strategyCache[k]; }
};
module.exports = DevelopV2;
