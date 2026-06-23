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
        const rcl = spawn.room.controller ? spawn.room.controller.level : 0;
        
        // 获取该房间的所有 Buildings 任务
        if (!Memory.Taskboard || !Memory.Taskboard.Task || !Memory.Taskboard.Task.Buildings || !Memory.Taskboard.Task.Buildings[roomName]) {
            return;
        }

        const tasks = Memory.Taskboard.Task.Buildings[roomName];
        if (!Array.isArray(tasks)) return;

        // 过滤出 spawn 类型的任务且未被领取
        const spawnTasks = tasks.filter(t => t.type === 'spawn' && !t.takenBy);
        if (spawnTasks.length === 0) return;

        // 【绝对硬上限】最后防线：不管队列里有多少任务，房间creep总数（含孵化中）不超过上限
        const ABSOLUTE_CAPS = { CommonI: 20, CarrierI: 10, AttackerI: 6, ClaimerI: 4 };
        const roomCreeps = spawn.room.find(FIND_MY_CREEPS);
        const spawningCount = roomCreeps.filter(c => c.spawning).length;
        const activeCount = roomCreeps.length - spawningCount;

        // 按型号统计
        const modelCounts = { CommonI: 0, CarrierI: 0, AttackerI: 0, ClaimerI: 0 };
        for (const c of roomCreeps) {
            if (!c.spawning && c.memory.model && modelCounts[c.memory.model] !== undefined) {
                modelCounts[c.memory.model]++;
            }
        }
        // 加上正在孵化的（从spawn任务的data中获取）
        for (const st of tasks) {
            if (st.type === 'spawn' && st.takenBy) {
                const m = st.data && st.data.model;
                if (m && modelCounts[m] !== undefined) modelCounts[m]++;
            }
        }

        // 总数绝对上限：活跃+孵化中不超过30，总数不超过35
        if (roomCreeps.length >= 35) return;

        // 2. 接单顺序：攻击型(AttackerI) > 通用型(CommonI) > 搬运型(CarrierI) > 其他(ClaimerI)
        const priority = ['AttackerI', 'CommonI', 'CarrierI', 'ClaimerI'];
        
        let bestTask = null;
        let bestTaskIndex = -1;
        let bestTaskEnergy = 200;
        let minPriorityIndex = Infinity;

        const adapter = require('adapter.wasm_spawncreep');

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            // 过滤出 spawn 类型的任务且未被领取
            if (task.type !== 'spawn' || task.takenBy) continue;
            
            const model = task.data.model;
            // 3. 用固定模板能量值判断，不够就跳过（不传动态值）
            var taskEnergy = task.data.energy;
            if (!taskEnergy || typeof taskEnergy !== 'number') {
                // 没有固定能量值时从模板获取
                switch (model) {
                    case 'CommonI': taskEnergy = adapter.calcBodyCost(adapter.getCommonIBody(9999)); break;
                    case 'CarrierI': taskEnergy = adapter.calcBodyCost(adapter.getCarrierIBody(9999)); break;
                    case 'AttackerI': taskEnergy = adapter.calcBodyCost(adapter.getAttackerIBody(9999)); break;
                    case 'ClaimerI': taskEnergy = adapter.calcBodyCost(adapter.getClaimerIBody(9999)); break;
                    default: taskEnergy = 200; break;
                }
            }
            if (!taskEnergy) taskEnergy = 200;

            // RCL3以下禁止生成AttackerI
            if (model === 'AttackerI' && rcl < 4) continue;

            // 【绝对硬上限】该型号已达上限，跳过
            if (modelCounts[model] >= ABSOLUTE_CAPS[model]) continue;

            if (spawn.room.energyAvailable < taskEnergy) continue;

            const pIndex = priority.indexOf(model);
            const currentPriority = pIndex === -1 ? 99 : pIndex;

            if (currentPriority < minPriorityIndex) {
                minPriorityIndex = currentPriority;
                bestTask = task;
                bestTaskIndex = i;
                bestTaskEnergy = taskEnergy;
            } else if (currentPriority === minPriorityIndex) {
                // 如果同一类型有多个单，接创建时间最早的那一个
                if (bestTask && task.createdTime < bestTask.createdTime) {
                    bestTask = task;
                    bestTaskIndex = i;
                    bestTaskEnergy = taskEnergy;
                }
            }
        }

        // 4. 执行接单与生成
        if (bestTask) {
            // 在生成前先标记，避免多 spawn 时造成重复生成
            bestTask.takenBy = spawn.name;

            const result = spawncreep.spawn(spawn, bestTask.data.model, bestTaskEnergy);

            if (result === OK) {
                // 5. 生成后在内存中删除该任务（使用 takenBy 精准删除，避免索引漂移）
                taskboard.removeTask(roomName, 'Buildings', spawn.name);
            } else {
                // 如果生成失败，重置标记
                bestTask.takenBy = null;
                // 只记录非-6（能量不足）的错误，-6是正常等待
                if (result !== -6 && Game.time % 50 === 0) {
                    console.log("[Spawn] ❌ 生成失败: " + result + " (" + bestTask.data.model + ")");
                }
            }
        }
    }
};

module.exports = buildingSpawn;
