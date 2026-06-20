/**
 * main.js - 新 AGE AI 核心入口
 */
const modules = require('module.references');

const ENABLE_MARKET = true;   // 市场默认开启（新世界模式需要首单启动资金）
const DEBUG_LOG = false;      // 详细日志开关（生产环境关闭以节省CPU）

module.exports.loop = function () {
    // 0. 初始化用户任务发送器
    if (!Game.tasksender) Game.tasksender = require('User.tasksender');
    
    // 1. 系统维护与数据刷新
    modules.memcleaner.run();

    // 1.5 WASM模块初始化（仅首次执行，后续tick自动跳过）
    modules.wasmLoader.initAll();

    // 2. 【新增】全局决策AI运行
    modules.developv1.run();
    modules.developv2.run();
    modules.claim.run();
    modules.fight.run();

    // 3. 任务处理器
    modules.taskhandler.run();

    // 4. 自动化基建控制
    modules.autobuild.run();

    // 5. 任务调度
    modules.roleDispatcher.run();

    // 6. 建筑逻辑
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;

        const spawns = room.find(FIND_MY_SPAWNS);
        for (const spawn of spawns) modules.buildingSpawn.run(spawn);

        if (room.terminal) {
            modules.buildingTerminal.run(room.terminal);
            modules.automarket.run(roomName);
        }
        
        modules.buildingTower.run(room);
        modules.buildingLab.run(room);
        modules.buildingFactory.run(room);
        modules.buildingNuker.run(room);
        modules.buildingLink.run(room);
    }

    // 7. 调试输出
    if (Game.time % 100 === 0) {
        console.log("--- 📊 帝国概况 Tick: " + Game.time + " ---");
        console.log("GCL: " + Game.gcl.level + " (" + (Game.gcl.progress / Game.gcl.progressTotal * 100).toFixed(2) + "%)");
        console.log("Creeps: " + Object.keys(Game.creeps).length);
    }
};
