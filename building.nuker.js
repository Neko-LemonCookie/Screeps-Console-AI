/**
 * building.nuker.js
 * Nuker 运行逻辑：发射核弹攻击目标房间
 * 任务结束条件：发射成功
 */

module.exports = {
    /**
     * 运行指定房间的 Nuker
     * @param {Room} room 
     */
    run: function(room) {
        const search = require('lib.AP.search');
        const nukerId = search.get.structure(room.name, 'nuker');
        const nuker = nukerId ? Game.getObjectById(nukerId) : null;
        if (!nuker) return;
        if (nuker.cooldown > 0) return;

        // 获取任务
        const taskboard = require('lib.AP.taskboard');
        const tasks = (Memory.Taskboard && Memory.Taskboard.Task.Buildings[room.name]) || [];
        
        // 1. 优先寻找已领取的任务
        let nukeTaskIndex = tasks.findIndex(t => t.type === 'nukeattack' && t.takenBy === nuker.id);
        
        // 2. 如果没有锁定的任务，尝试按时间顺序领取最早的且资源充足的任务
        if (nukeTaskIndex === -1) {
            const unclaimedTasks = tasks
                .map((t, index) => ({ task: t, index: index }))
                .filter(item => item.task.type === 'nukeattack' && item.task.takenBy === null)
                .sort((a, b) => a.task.createdTime - b.task.createdTime);

            for (const item of unclaimedTasks) {
                // 检查资源充足性 (5000 GHO2 + 300,000 Energy)
                const hasGHO2 = nuker.store[RESOURCE_GHODIUM] >= 5000;
                const hasEnergy = nuker.store[RESOURCE_ENERGY] >= 300000;
                
                if (hasGHO2 && hasEnergy) {
                    item.task.takenBy = nuker.id;
                    nukeTaskIndex = item.index;
                    break;
                }
            }
        }

        if (nukeTaskIndex === -1) return;
        const task = tasks[nukeTaskIndex];
        const targetRoomName = task.data.targetRoomName;

        // 3. 计算攻击位置
        const calc = require('lib.AP.calculate_claim');
        const targetPos = calc.getNukeTarget(targetRoomName);

        if (!targetPos) {
            // 无法找到攻击目标（可能没有视野或房间已废弃）
            // 注意：这里建议保留任务，等待有视野后再处理，或者可以设置一个超时
            return;
        }

        // 4. 执行发射
        const res = nuker.launchNuke(targetPos);
        if (res === OK) {
            console.log(`[Nuker] 🚀 Launching nuke from ${room.name} to ${targetRoomName} at (${targetPos.x}, ${targetPos.y})`);
            // 发射成功，立即结束任务
            taskboard.removeTask(room.name, 'Buildings', nukeTaskIndex);
        } else if (res === ERR_NOT_ENOUGH_RESOURCES) {
            // 资源中途不足（通常不会发生，因为有准入检查），等待补充
        } else {
            // 其他错误（如距离过远）
            console.log(`[Nuker] ❌ Launch error: ${res}`);
        }
    }
};
