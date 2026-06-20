/**
 * building.spawn.js
 * 孵化管理建筑逻辑。
 * 负责从 Taskboard 领取 Building 类的 spawn 任务并执行生成。
 */

const spawncreep = require('lib.AP.spawncreep');
const taskboard = require('lib.AP.taskboard');

const buildingSpawn = {
    /**
     * @param {StructureSpawn} spawn 
     */
    run: function(spawn) {
        // 1. 如果正在生成，直接返回
        if (spawn.spawning) return;

        const roomName = spawn.room.name;
        
        // 获取该房间的所有 Buildings 任务
        if (!Memory.Taskboard || !Memory.Taskboard.Task || !Memory.Taskboard.Task.Buildings || !Memory.Taskboard.Task.Buildings[roomName]) {
            return;
        }

        const tasks = Memory.Taskboard.Task.Buildings[roomName];
        if (!Array.isArray(tasks)) return;

        // 过滤出 spawn 类型的任务且未被领取
        const spawnTasks = tasks.filter(t => t.type === 'spawn' && !t.takenBy);
        if (spawnTasks.length === 0) return;

        // 2. 接单顺序：攻击型(AttackerI) > 通用型(CommonI) > 搬运型(CarrierI) > 其他(ClaimerI)
        const priority = ['AttackerI', 'CommonI', 'CarrierI', 'ClaimerI'];
        
        let bestTask = null;
        let bestTaskIndex = -1;
        let minPriorityIndex = Infinity;

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            // 过滤出 spawn 类型的任务且未被领取
            if (task.type !== 'spawn' || task.takenBy) continue;
            
            const model = task.data.model;
            const requiredEnergy = task.data.energy;

            // 3. 检查房间内当前可用能量是否足够
            if (spawn.room.energyAvailable < requiredEnergy) continue;

            const pIndex = priority.indexOf(model);
            const currentPriority = pIndex === -1 ? 99 : pIndex;

            if (currentPriority < minPriorityIndex) {
                minPriorityIndex = currentPriority;
                bestTask = task;
                bestTaskIndex = i;
            } else if (currentPriority === minPriorityIndex) {
                // 如果同一类型有多个单，接创建时间最早的那一个
                if (bestTask && task.createdTime < bestTask.createdTime) {
                    bestTask = task;
                    bestTaskIndex = i;
                }
            }
        }

        // 4. 执行接单与生成
        if (bestTask) {
            // 在生成前先标记，避免多 spawn 时造成重复生成
            bestTask.takenBy = spawn.name;

            const result = spawncreep.spawn(spawn, bestTask.data.model, bestTask.data.energy);

            if (result === OK) {
                // 5. 生成后在内存中删除该任务（使用 takenBy 精准删除，避免索引漂移）
                taskboard.removeTask(roomName, 'Buildings', spawn.name);
            } else {
                // 如果生成失败，重置标记并输出错误信息
                bestTask.takenBy = null;
                console.log("[Spawn] ❌ 生成失败: " + result + " (Creep: " + bestTask.data.model + ", 能量: " + bestTask.data.energy + ", 可用: " + spawn.room.energyAvailable + ")");
            }
        }
    }
};

module.exports = buildingSpawn;
