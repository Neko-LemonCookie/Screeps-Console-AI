/**
 * main.js - 新 AGE AI 核心入口
 * 基于任务看板 (Taskboard) 与 自动化控制 (AP) 架构重构。
 */

const modules = require('module.references');

module.exports.loop = function () {
    // 0. 初始化用户任务发送器（全局对象）
    if (!Game.tasksender) {
        Game.tasksender = require('User.tasksender');
    }
    // 1. 系统维护与数据刷新 (每 tick 起点)
    // 包含：内存初始化、死 Creep 清理、任务解绑、全局缓存刷新
    modules.memcleaner.run();

    // 2. 建筑模板生成 (由 AP.autobuild 处理)
    // 包含：城市中心模板生成、外围结构（容器、道路、墙）生成
    // 注意：已移至 AP.autobuild 中处理，避免重复调用

    // 3. 任务处理器 (AP.taskhandler)
    // 包含：根据任务情况生成 creep 和处理工厂生产流程
    modules.taskhandler.run();

    // 4. 自动化基建控制 (AP.autobuild)
    // 包含：城市中心、扩展区、外围容器、道路、墙的自动建设与修复
    modules.autobuild.run();

    // 4. 任务调度 (Dispatcher)
    // 包含：根据 taskType 分发 Creep 逻辑，或进入 unibot 自动领单
    modules.roleDispatcher.run();

    // 5. 建筑逻辑 (Buildings)
    // 包含：Spawn 领单孵化、Tower 防御、Market 自动套利等
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;

        // 5.1 Spawn 逻辑
        const spawns = room.find(FIND_MY_SPAWNS);
        for (const spawn of spawns) {
            modules.buildingSpawn.run(spawn);
        }

        // 5.2 自动市场套利 (如果有 Terminal)
        if (room.terminal) {
            modules.buildingTerminal.run(room.terminal);
            modules.automarket.run(roomName);
        }
        
        // 5.3 Tower 逻辑
        modules.buildingTower.run(room);

        // 5.4 Lab 逻辑
        modules.buildingLab.run(room);

        // 5.5 Factory 逻辑
        modules.buildingFactory.run(room);

        // 5.6 Nuker 逻辑
        modules.buildingNuker.run(room);

        // 5.7 Link 逻辑 (新体系暂不自动调用，保留兼容)
        modules.buildingLink.run(room);
    }

    // 6. 资源统计与调试输出 (可选)
    if (Game.time % 100 === 0) {
        console.log("--- 📊 帝国概况 Tick: " + Game.time + " ---");
        console.log("GCL: " + Game.gcl.level + " (" + (Game.gcl.progress / Game.gcl.progressTotal * 100).toFixed(2) + "%)");
        console.log("Creeps: " + Object.keys(Game.creeps).length);
    }
};
