/**
 * module.roleDispatcher.js (更名为任务调度器)
 * 负责根据 Creep 内存中的任务类型分发到对应的任务执行模块。
 */

const modules = require('module.references');

// 任务类型到执行模块的映射
const taskMap = {
    'harvest': modules.taskHarvest,
    'upgrade': modules.taskUpgrade,
    'build': modules.taskBuild,
    'repair': modules.taskRepair,
    'carry': modules.taskCarry,
    'claimupgrade': modules.taskClaimUpgrade,
    'claimbuild': modules.taskClaimBuild,
    'globalcarry': modules.taskGlobalCarry,
    'attack': modules.taskAttack,
    'police': modules.taskPolice,
    'sign': modules.taskSign,
    'claim': modules.taskClaim,
    'reserve': modules.taskReserve,
    'boost': modules.taskBoost
};

module.exports = {
    /**
     * 运行任务调度逻辑
     */
    run: function() {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];

            // 如果 Creep 正在孵化，跳过
            if (creep.spawning) continue;

            // 获取任务类型 (优先从 memory.taskType 获取)
            const taskType = creep.memory.taskType;

            if (taskType) {
                // 如果定义了任务类型，则尝试分发
                const taskModule = taskMap[taskType];
                if (taskModule && typeof taskModule.run === 'function') {
                    taskModule.run(creep);
                } else {
                    // 只有定义了任务但找不到模块时才报错
                    console.log("[Dispatcher] ❌ 任务未定义或模块丢失: " + taskType + " (Creep: " + name + ")");
                }
            } else {
                // 没有分配任务是常见现象，统一调度为 unibot 进行接单逻辑
                if (modules.unibot && typeof modules.unibot.run === 'function') {
                    modules.unibot.run(creep);
                } else {
                    // 如果连 unibot 模块都找不到，这属于系统配置错误
                    if (Game.time % 10 === 0) {
                        console.log("[Dispatcher] 🚨 关键错误: 找不到 unibot 基础调度模块");
                    }
                }
            }
        }
    }
};
