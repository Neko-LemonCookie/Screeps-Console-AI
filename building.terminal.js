/**
 * building.terminal.js
 * 终端管理建筑逻辑。
 * 负责从 Taskboard 领取 Building 类的终端任务并执行。
 * 任务优先级：marketBuy > transport > automarket > marketSell
 */

const modules = require('module.references');

const buildingTerminal = {
    /**
     * @param {StructureTerminal} terminal 
     */
    run: function(terminal) {
        const roomName = terminal.room.name;
        
        // 获取该房间的所有 Buildings 任务
        if (!Memory.Taskboard || !Memory.Taskboard.Task || !Memory.Taskboard.Task.Buildings || !Memory.Taskboard.Task.Buildings[roomName]) {
            return;
        }

        const tasks = Memory.Taskboard.Task.Buildings[roomName];
        if (!Array.isArray(tasks)) return;

        // 1. 检查是否已有锁定的任务
        let activeTaskIndex = tasks.findIndex(t => t.takenBy === terminal.id);
        
        // 2. 如果没有锁定任务，尝试领取新任务
        if (activeTaskIndex === -1) {
            const priority = ['marketBuy', 'transport', 'automarket', 'marketSell'];
            let bestTask = null;
            let bestTaskIndex = -1;
            let minPriorityIndex = Infinity;

            for (let i = 0; i < tasks.length; i++) {
                const task = tasks[i];
                const taskType = task.type;
                
                // 只处理终端相关的任务类型
                if (!priority.includes(taskType)) continue;
                
                // 检查是否已被其他终端领取
                if (task.takenBy && task.takenBy !== terminal.id) continue;

                const pIndex = priority.indexOf(taskType);
                const currentPriority = pIndex === -1 ? 99 : pIndex;

                if (currentPriority < minPriorityIndex) {
                    minPriorityIndex = currentPriority;
                    bestTask = task;
                    bestTaskIndex = i;
                } else if (currentPriority === minPriorityIndex) {
                    // 如果同一优先级有多个任务，接创建时间最早的那一个
                    if (bestTask && task.createdTime < bestTask.createdTime) {
                        bestTask = task;
                        bestTaskIndex = i;
                    }
                }
            }

            // 3. 执行接单逻辑（根据不同任务类型检查条件）
            if (bestTask) {
                const canAccept = this._checkTaskConditions(terminal, bestTask);
                if (canAccept) {
                    bestTask.takenBy = terminal.id;
                    activeTaskIndex = bestTaskIndex;
                }
            }
        }

        // 4. 执行任务
        if (activeTaskIndex !== -1) {
            const task = tasks[activeTaskIndex];
            const taskType = task.type;
            const shouldRemove = this._executeTask(terminal, task);
            
            if (shouldRemove) {
                modules.taskboard.removeTask(roomName, 'Buildings', activeTaskIndex);
            }
        }
    },

    /**
     * 检查任务接单条件
     * @private
     */
    _checkTaskConditions: function(terminal, task) {
        const taskType = task.type;
        const data = task.data;

        switch (taskType) {
            case 'marketBuy':
                // marketBuy: 有足够信用点时才接单
                if (Game.market.credits < data.amount * 10) {
                    return false;
                }
                break;

            case 'transport':
                // transport: 有足够数量物品时才传输
                const stock = terminal.store[data.resourceType] || 0;
                if (stock < data.amount) {
                    return false;
                }
                break;

            case 'automarket':
                // automarket: 在现有信用点 > 安全限额时才接单
                const autoMarketSettings = Memory.AutoMarket && Memory.AutoMarket.settings;
                const minCredits = autoMarketSettings ? autoMarketSettings.minCredits : 0;
                if (Game.market.credits <= minCredits) {
                    return false;
                }
                break;

            case 'marketSell':
                // marketSell: 有足够物品数量时才接单
                const sellStock = terminal.store[data.resourceType] || 0;
                if (sellStock < data.amount) {
                    return false;
                }
                break;

            default:
                break;
        }

        return true;
    },

    /**
     * 执行任务并返回是否应该删除任务
     * @private
     */
    _executeTask: function(terminal, task) {
        const taskType = task.type;
        const data = task.data;
        const roomName = terminal.room.name;

        switch (taskType) {
            case 'marketBuy':
                // marketBuy: 任务结束条件是买够目标数额
                const buyResult = modules.market.marketBuy(roomName, data.resourceType, data.amount);
                return buyResult === OK;

            case 'transport':
                // transport: 任务结束条件是传输成功
                const transportResult = modules.market.transport(roomName, data.fromRoom, data.toRoom, data.resourceType, data.amount);
                return transportResult === OK;

            case 'automarket':
                // automarket: 任务结束条件是现有信用点 < 安全限额 或 目标任务已被删除
                const minCredits = (Memory.AutoMarket && Memory.AutoMarket.settings && Memory.AutoMarket.settings.minCredits) || 0;
                if (Game.market.credits <= minCredits) {
                    return true;
                }
                // 检查任务是否还存在
                const tasks = Memory.Taskboard.Task.Buildings[roomName];
                const taskExists = tasks && tasks.some(t => t === task);
                if (!taskExists) {
                    return true;
                }
                // 执行自动市场逻辑
                modules.automarket.run(roomName);
                return false;

            case 'marketSell':
                // marketSell: 任务结束条件是挂单成功 或 挂单失败 或 卖掉指定数额（非挂单模式）
                const sellResult = modules.market.marketSell(roomName, data.resourceType, data.amount, data.useOrder);
                if (sellResult === OK) {
                    return true;
                }
                if (sellResult === ERR_NOT_ENOUGH_RESOURCES) {
                    // 挂单失败（信用点不够），输出日志
                    console.log("[Terminal] ❌ 挂单失败: 信用点不足 (资源: " + data.resourceType + ", 数量: " + data.amount + ")");
                    return true;
                }
                if (sellResult === ERR_NAME_EXISTS) {
                    // 已有相同挂单，任务完成
                    return true;
                }
                return false;

            default:
                break;
        }

        return false;
    }
};

module.exports = buildingTerminal;