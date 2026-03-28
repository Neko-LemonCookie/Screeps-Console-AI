/**
 * building.factory.js
 * Factory 运行逻辑：根据 produce 任务进行生产
 * 任务结束标志：原料不足以再次生产
 */

module.exports = {
    /**
     * 运行指定房间的 Factory
     * @param {Room} room 
     */
    run: function(room) {
        const search = require('lib.AP.search');
        const factoryId = search.get.structure(room.name, 'factory');
        const factory = factoryId ? Game.getObjectById(factoryId) : null;
        if (!factory) return;
        if (factory.cooldown > 0) return;

        // 获取任务
        const taskboard = require('lib.AP.taskboard');
        const tasks = (Memory.Taskboard && Memory.Taskboard.Task.Buildings[room.name]) || [];
        
        // 1. 优先寻找已经锁定的 produce 任务 (一旦锁定，必须保持直到结束)
        let produceTaskIndex = tasks.findIndex(t => t.type === 'produce' && t.takenBy === factory.id);
        
        // 2. 如果没有锁定的任务，尝试领取一个最早且“目前可执行”的任务
        if (produceTaskIndex === -1) {
            const unclaimedTasks = tasks
                .map((t, index) => ({ task: t, index: index }))
                .filter(item => item.task.type === 'produce' && item.task.takenBy === null)
                .sort((a, b) => a.task.createdTime - b.task.createdTime);

            for (const item of unclaimedTasks) {
                const resourceType = item.task.data.resourceType;
                const recipe = COMMODITIES[resourceType];
                if (recipe) {
                    let canProduceNow = true;
                    for (const component in recipe.components) {
                        if (factory.store[component] < recipe.components[component]) {
                            canProduceNow = false;
                            break;
                        }
                    }
                    // 只有当前原料充足时才接任务
                    if (canProduceNow) {
                        item.task.takenBy = factory.id;
                        produceTaskIndex = item.index;
                        if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
                        Memory.rooms[room.name].factoryWaitTimer = 50;
                        break;
                    }
                } else {
                    // 无效配方，接了后由后续逻辑直接删
                    item.task.takenBy = factory.id;
                    produceTaskIndex = item.index;
                    break;
                }
            }
        }
        
        if (produceTaskIndex === -1) return;
        const task = tasks[produceTaskIndex];
        const resourceType = task.data.resourceType;

        // 3. 检查原料并尝试生产
        const recipe = COMMODITIES[resourceType];
        if (!recipe) {
            // 无效配方，直接删除
            taskboard.removeTask(room.name, 'Buildings', produceTaskIndex);
            delete Memory.rooms[room.name].factoryWaitTimer;
            return;
        }

        let hasResources = true;
        for (const component in recipe.components) {
            if (factory.store[component] < recipe.components[component]) {
                hasResources = false;
                break;
            }
        }

        if (hasResources) {
            // 原料充足，尝试生产并重置计时器
            const res = factory.produce(resourceType);
            if (res === OK) {
                Memory.rooms[room.name].factoryWaitTimer = 50;
            } else if (res === ERR_INVALID_ARGS) {
                taskboard.removeTask(room.name, 'Buildings', produceTaskIndex);
                delete Memory.rooms[room.name].factoryWaitTimer;
            } else if (res === ERR_NOT_ENOUGH_RESOURCES) {
                // 理论上不会走到这里，因为前面检查过了，但为了稳健性做递减
                Memory.rooms[room.name].factoryWaitTimer--;
            }
        } else {
            // 原料不足，开始/继续 50 tick 等待
            if (Memory.rooms[room.name].factoryWaitTimer === undefined) {
                Memory.rooms[room.name].factoryWaitTimer = 50;
            }
            Memory.rooms[room.name].factoryWaitTimer--;

            // 只有当计时器归零且确实没原料时，才放弃任务
            if (Memory.rooms[room.name].factoryWaitTimer <= 0) {
                taskboard.removeTask(room.name, 'Buildings', produceTaskIndex);
                delete Memory.rooms[room.name].factoryWaitTimer;
            }
        }
    }
};
