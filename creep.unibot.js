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
        if (!model) return;

        // 优先在生成房间或当前房间寻找任务
        const roomName = creep.memory.spawnRoom || creep.room.name;
        
        // 如果已经有任务了，调度器本不该分发给 unibot，但这里做个兜底
        if (creep.memory.taskType) return;

        // 获取该房间的所有 Creeps 任务
        if (!Memory.Taskboard || !Memory.Taskboard.Task || !Memory.Taskboard.Task.Creeps || !Memory.Taskboard.Task.Creeps[roomName]) {
            return;
        }

        const tasks = Memory.Taskboard.Task.Creeps[roomName];
        if (!Array.isArray(tasks)) return;

        // 获取该模型对应的任务优先级列表
        const priorityList = this._getPriorityList(model);
        if (!priorityList) return;

        // 寻找符合条件的任务
        let bestTask = null;
        let bestTaskIndex = -1;
        let bestPriorityIndex = Infinity;

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            
            // 任务已被领取，跳过
            if (task.takenBy) continue;

            // 检查模型是否允许接收该任务
            if (!this._canAcceptTask(model, task.type)) continue;

            // 获取该任务在优先级列表中的位置
            const priorityIndex = priorityList.indexOf(task.type);
            if (priorityIndex === -1) continue;

            // 如果找到优先级更高的任务，或者优先级相同但创建时间更早的任务
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

        // 领取任务
        if (bestTask) {
            this._assignTask(creep, bestTask, roomName, bestTaskIndex);
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
