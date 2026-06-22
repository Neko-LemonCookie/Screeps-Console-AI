/**
 * creep.unibot.js
 * 通用接单逻辑模块。
 * 负责从 Taskboard 寻找合适的任务并分配给 Creep。
 */

const unibot = {
    /**
     * 运行接单逻辑
     * @param {Creep} creep 
     */
    run: function(creep) {
        const model = creep.memory.model;

        // 如果已经有任务了，不重复分配
        if (creep.memory.taskType) return;

        // 优先在生成房间或当前房间寻找任务
        const roomName = creep.memory.spawnRoom || creep.room.name;

        // 获取该房间的所有 Creeps 任务
        let tasks = [];
        if (Memory.Taskboard && Memory.Taskboard.Task && Memory.Taskboard.Task.Creeps && Memory.Taskboard.Task.Creeps[roomName]) {
            const raw = Memory.Taskboard.Task.Creeps[roomName];
            if (Array.isArray(raw)) tasks = raw;
        }

        // 有model时尝试接单
        if (model) {
            const priorityList = this._getPriorityList(model);
            if (priorityList && tasks.length > 0) {
                let bestTask = null;
                let bestTaskIndex = -1;
                let bestPriorityIndex = Infinity;

                for (let i = 0; i < tasks.length; i++) {
                    const task = tasks[i];
                    if (task.takenBy) continue;
                    if (!this._canAcceptTask(model, task.type)) continue;
                    const priorityIndex = priorityList.indexOf(task.type);
                    if (priorityIndex === -1) continue;
                    if (priorityIndex < bestPriorityIndex) {
                        bestPriorityIndex = priorityIndex;
                        bestTask = task;
                        bestTaskIndex = i;
                    } else if (priorityIndex === bestPriorityIndex) {
                        if (bestTask && task.createdTime < bestTask.createdTime) {
                            bestTask = task;
                            bestTaskIndex = i;
                        }
                    }
                }

                if (bestTask) {
                    this._assignTask(creep, bestTask, roomName, bestTaskIndex);
                    return;
                }
            }
        }

        // ====== 最终兜底：无任务可接 → 走到spawn回收 ======
        // 不管是没model、没任务数据、还是任务全被抢光了，都走这里
        const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
        if (spawn) {
            if (creep.pos.isEqualTo(spawn.pos)) {
                const res = spawn.recycleCreep(creep);
                if (res === OK) console.log("[" + creep.room.name + "] ♻️ 回收: " + creep.name);
                else if (res !== ERR_BUSY) console.log("[" + creep.room.name + "] ♻️ 回收失败: " + res + " (Creep: " + creep.name + ")");
            } else {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ff0000' } });
            }
        }
    },

    /**
     * 获取不同模型的任务优先级
     * @private
     */
    _getPriorityList: function(model) {
        switch (model) {
            case 'CommonI':
                // harvest > repair > build > upgrade > sign > carry (包含 claim 变体)
                return ['harvest', 'claimupgrade', 'claimbuild', 'repair', 'build', 'upgrade', 'sign', 'carry', 'globalcarry'];
            case 'CarrierI':
                // carry > sign
                return ['carry', 'globalcarry', 'sign'];
            case 'AttackerI':
                // police > sign > attack
                return ['police', 'sign', 'attack'];
            case 'ClaimerI':
                // claim > reserve
                return ['claim', 'reserve'];
            default:
                return null;
        }
    },

    /**
     * 检查模型是否允许接收特定任务
     * @private
     */
    _canAcceptTask: function(model, taskType) {
        if (taskType === 'sign') return true; // sign 任何模型都可接

        if (model === 'CommonI') {
            const commonTasks = ['harvest', 'upgrade', 'build', 'repair', 'claimupgrade', 'claimbuild', 'carry', 'globalcarry'];
            return commonTasks.indexOf(taskType) !== -1;
        }

        if (model === 'CarrierI') {
            const carrierTasks = ['carry', 'globalcarry'];
            return carrierTasks.indexOf(taskType) !== -1;
        }

        if (model === 'AttackerI') {
            const attackerTasks = ['police', 'attack'];
            return attackerTasks.indexOf(taskType) !== -1;
        }

        if (model === 'ClaimerI') {
            const claimerTasks = ['claim', 'reserve'];
            return claimerTasks.indexOf(taskType) !== -1;
        }

        return false;
    },

    /**
     * 分配任务并标记
     * @private
     */
    _assignTask: function(creep, task, roomName, index) {
        // 标记任务已被领取 (内存锁定)
        task.takenBy = creep.name;

        // 更新 Creep 内存
        creep.memory.taskType = task.type;
        creep.memory.taskData = task.data;
        creep.memory.taskRoom = roomName;
        creep.memory.taskIndex = index; // 记录索引方便后续可能的同步

        if (typeof DEBUG_LOG !== 'undefined' && DEBUG_LOG) {
            console.log("[" + roomName + "] 📥 Creep " + creep.name + " (" + creep.memory.model + ") 领受任务: " + task.type);
        }
    }
};

module.exports = unibot;
