/**
 * main.js - 新 AGE AI 核心入口
 */
const modules = require('module.references');

const ENABLE_MARKET = true;   // 市场默认开启（新世界模式需要首单启动资金）
const DEBUG_LOG = false;      // 详细日志开关（生产环境关闭以节省CPU）

module.exports.loop = function () {
    var step = 'init';
    try {
        // 0. 初始化用户任务发送器
        STEP = 'User.tasksender';
        if (!Game.tasksender) Game.tasksender = require('User.tasksender');

        // 1. 系统维护与数据刷新
        STEP = 'memcleaner';
        modules.memcleaner.run();

        // 1.5 安全模式自动启动（保命逻辑）
        STEP = 'safeModeCheck';
        const myRooms = [];
        for (const rn in Game.rooms) {
            const r = Game.rooms[rn];
            if (r.controller && r.controller.my) myRooms.push(r);
        }
        // 仅当只有1个房间且RCL<=3时才触发（早期保命）
        if (myRooms.length === 1) {
            const room = myRooms[0];
            if (room.controller.level <= 3) {
                // 20000 tick 时间锁，避免一直尝试浪费CPU
                if (!Memory.lastSafeModeAttempt || Game.time - Memory.lastSafeModeAttempt > 20000) {
                    const enemies = room.find(FIND_HOSTILE_CREEPS);
                    if (enemies.length > 0) {
                        // 检查敌人是否有攻击性部件或WORK（WORK可以拆建筑）
                        const dangerous = enemies.some(c =>
                            c.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK || p.type === WORK)
                        );
                        if (dangerous) {
                            Memory.lastSafeModeAttempt = Game.time;
                            const result = room.controller.activateSafeMode();
                            if (result === OK) {
                                console.log("[SafeMode] 🛡️ 安全模式已启动！(" + room.name + ")");
                            } else {
                                console.log("[SafeMode] ⚠️ 启动失败: " + result + " (" + room.name + ")");
                            }
                        }
                    }
                }
            }
        }

        // 2. 全局决策AI运行
        STEP = 'developv1';
        modules.developv1.run();
        STEP = 'developv2';
        modules.developv2.run();
        STEP = 'claim';
        modules.claim.run();
        STEP = 'fight';
        modules.fight.run();

        // 3. 任务处理器
        STEP = 'taskhandler';
        modules.taskhandler.run();

        // 4. 自动化基建控制
        STEP = 'autobuild';
        modules.autobuild.run();

        // 5. 任务调度
        STEP = 'roleDispatcher';
        modules.roleDispatcher.run();

        // 6. 建筑逻辑
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            const spawns = room.find(FIND_MY_SPAWNS);
            for (const spawn of spawns) {
                STEP = 'buildingSpawn';
                modules.buildingSpawn.run(spawn);
            }

            if (room.terminal) {
                STEP = 'buildingTerminal';
                modules.buildingTerminal.run(room.terminal);
                STEP = 'automarket';
                modules.automarket.run(roomName);
            }

            STEP = 'buildingTower';
            modules.buildingTower.run(room);
            STEP = 'buildingLab';
            modules.buildingLab.run(room);
            STEP = 'buildingFactory';
            modules.buildingFactory.run(room);
            STEP = 'buildingNuker';
            modules.buildingNuker.run(room);
            STEP = 'buildingLink';
            modules.buildingLink.run(room);
        }

        // 7. 调试输出
        if (Game.time % 100 === 0) {
            console.log("--- 帝国概况 Tick: " + Game.time + " ---");
            console.log("GCL: " + Game.gcl.level + " (" + (Game.gcl.progress / Game.gcl.progressTotal * 100).toFixed(2) + "%)");
            console.log("Creeps: " + Object.keys(Game.creeps).length);
        }
    } catch (e) {
        console.log("[Main] 异常 @" + STEP + " | " + (e.message || String(e)) + " | stack: " + (e.stack || 'none'));
    }
};
