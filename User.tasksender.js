/**
 * User.tasksender.js
 * 用户任务发送器，提供全局函数用于手动发布任务
 * 用于调试和测试底层模块
 */

const modules = require('module.references');

const UserTasksender = {
    /**
     * 发布 Creep 任务
     * @param {string} roomName 房间名
     * @param {string} taskType 任务类型
     * @param {Object} data 任务数据
     */
    creepTask: function(roomName, taskType, data) {
        if (!roomName || !taskType) {
            console.log("[UserTasksender] ❌ 参数缺失: roomName 和 taskType 是必需的");
            return;
        }

        const validTypes = [
            'harvest', 'upgrade', 'build', 'repair', 'carry',
            'attack', 'police', 'sign', 'claim', 'reserve',
            'claimupgrade', 'claimbuild', 'globalcarry', 'boost'
        ];

        if (validTypes.indexOf(taskType) === -1) {
            console.log("[UserTasksender] ❌ 无效的任务类型: " + taskType);
            console.log("有效类型: " + validTypes.join(', '));
            return;
        }

        switch (taskType) {
            case 'harvest':
                modules.taskboard.creeps.harvest(roomName, data.sourceId, data.targetId);
                break;
            case 'upgrade':
                modules.taskboard.creeps.upgrade(roomName, data.targetId);
                break;
            case 'build':
                modules.taskboard.creeps.build(roomName, data.targetId);
                break;
            case 'repair':
                modules.taskboard.creeps.repair(roomName, data.targetId);
                break;
            case 'carry':
                modules.taskboard.creeps.carry(roomName, data.fromId, data.toId, data.resourceType);
                break;
            case 'attack':
                modules.taskboard.creeps.attack(roomName, data.targetRoomName);
                break;
            case 'police':
                modules.taskboard.creeps.police(roomName, data.posOrAuto);
                break;
            case 'sign':
                modules.taskboard.creeps.sign(roomName, data.targetRoomName, data.signText);
                break;
            case 'claim':
                modules.taskboard.creeps.claim(roomName, data.targetRoomName);
                break;
            case 'reserve':
                modules.taskboard.creeps.reserve(roomName, data.targetRoomName);
                break;
            case 'claimupgrade':
                modules.taskboard.creeps.claimupgrade(roomName, data.targetRoomName, data.sourceId);
                break;
            case 'claimbuild':
                modules.taskboard.creeps.claimbuild(roomName, data.targetRoomName, data.sourceId);
                break;
            case 'globalcarry':
                modules.taskboard.creeps.globalcarry(roomName, data.fromRoom, data.toRoom, data.fromId, data.toId, data.resourceType);
                break;
            case 'boost':
                modules.taskboard.creeps.boost(roomName, data.labId, data.bodyPart);
                break;
        }

        console.log("[UserTasksender] ✅ Creep 任务已创建: " + taskType + " 在房间 " + roomName);
    },

    /**
     * 发布 Buildings 任务
     * @param {string} roomName 房间名
     * @param {string} taskType 任务类型
     * @param {Object} data 任务数据
     */
    buildingTask: function(roomName, taskType, data) {
        if (!roomName || !taskType) {
            console.log("[UserTasksender] ❌ 参数缺失: roomName 和 taskType 是必需的");
            return;
        }

        const validTypes = [
            'produce', 'transport', 'marketBuy', 'marketSell',
            'automarket', 'nukeattack', 'spawn', 'linktransport', 'boost'
        ];

        if (validTypes.indexOf(taskType) === -1) {
            console.log("[UserTasksender] ❌ 无效的任务类型: " + taskType);
            console.log("有效类型: " + validTypes.join(', '));
            return;
        }

        switch (taskType) {
            case 'produce':
                modules.taskboard.buildings.produce(roomName, data.resourceType);
                break;
            case 'transport':
                modules.taskboard.buildings.transport(roomName, data.fromRoom, data.toRoom, data.resourceType, data.amount);
                break;
            case 'marketBuy':
                modules.taskboard.buildings.marketBuy(roomName, data.resourceType, data.amount);
                break;
            case 'marketSell':
                modules.taskboard.buildings.marketSell(roomName, data.resourceType, data.amount, data.useOrder);
                break;
            case 'automarket':
                modules.taskboard.buildings.automarket(roomName);
                break;
            case 'nukeattack':
                modules.taskboard.buildings.nukeattack(roomName, data.targetRoomName);
                break;
            case 'spawn':
                modules.taskboard.buildings.spawn(roomName, data.model, data.priority || 'harvest', { energy: data.energy || 200 });
                break;
            case 'linktransport':
                modules.taskboard.buildings.linktransport(roomName);
                break;
            case 'boost':
                modules.taskboard.buildings.boost(roomName, data.bodyPart);
                break;
        }

        console.log("[UserTasksender] ✅ Building 任务已创建: " + taskType + " 在房间 " + roomName);
    },

    /**
     * 删除任务
     * @param {string} roomName 房间名
     * @param {string} category 'Creeps' 或 'Buildings'
     * @param {string|number} typeOrIndex 任务类型或索引
     */
    removeTask: function(roomName, category, typeOrIndex) {
        if (!roomName || !category) {
            console.log("[UserTasksender] ❌ 参数缺失: roomName 和 category 是必需的");
            return;
        }

        if (category !== 'Creeps' && category !== 'Buildings') {
            console.log("[UserTasksender] ❌ 无效的类别: " + category);
            console.log("有效类别: 'Creeps', 'Buildings'");
            return;
        }

        modules.taskboard.removeTask(roomName, category, typeOrIndex);
        console.log("[UserTasksender] ✅ 任务已删除: " + category + " 在房间 " + roomName);
    },

    /**
     * 查看房间任务
     * @param {string} roomName 房间名
     * @param {string} category 'Creeps' 或 'Buildings' 或 'all'
     */
    listTasks: function(roomName, category) {
        if (!roomName) {
            console.log("[UserTasksender] ❌ 参数缺失: roomName 是必需的");
            return;
        }

        if (!Memory.Taskboard || !Memory.Taskboard.Task) {
            console.log("[UserTasksender] ❌ 任务看板未初始化");
            return;
        }

        if (category === 'all' || category === 'Creeps') {
            const creepTasks = Memory.Taskboard.Task.Creeps[roomName] || [];
            console.log("--- 📋 Creep 任务 (" + roomName + ") ---");
            if (creepTasks.length === 0) {
                console.log("无任务");
            } else {
                creepTasks.forEach((task, index) => {
                    const takenBy = task.takenBy ? "已领取: " + task.takenBy : "未领取";
                    console.log(index + ". " + task.type + " - " + takenBy + " (创建时间: " + task.createdTime + ")");
                });
            }
        }

        if (category === 'all' || category === 'Buildings') {
            const buildingTasks = Memory.Taskboard.Task.Buildings[roomName] || [];
            console.log("--- 📋 Building 任务 (" + roomName + ") ---");
            if (buildingTasks.length === 0) {
                console.log("无任务");
            } else {
                buildingTasks.forEach((task, index) => {
                    const takenBy = task.takenBy ? "已领取: " + task.takenBy : "未领取";
                    console.log(index + ". " + task.type + " - " + takenBy + " (创建时间: " + task.createdTime + ")");
                });
            }
        }
    },

    /**
     * 清空房间所有任务
     * @param {string} roomName 房间名
     * @param {string} category 'Creeps' 或 'Buildings' 或 'all'
     */
    clearTasks: function(roomName, category) {
        if (!roomName) {
            console.log("[UserTasksender] ❌ 参数缺失: roomName 是必需的");
            return;
        }

        if (!Memory.Taskboard || !Memory.Taskboard.Task) {
            console.log("[UserTasksender] ❌ 任务看板未初始化");
            return;
        }

        if (category === 'all' || category === 'Creeps') {
            const creepTasks = Memory.Taskboard.Task.Creeps[roomName] || [];
            const count = creepTasks.length;
            Memory.Taskboard.Task.Creeps[roomName] = [];
            console.log("[UserTasksender] ✅ 已清空 " + count + " 个 Creep 任务 (" + roomName + ")");
        }

        if (category === 'all' || category === 'Buildings') {
            const buildingTasks = Memory.Taskboard.Task.Buildings[roomName] || [];
            const count = buildingTasks.length;
            Memory.Taskboard.Task.Buildings[roomName] = [];
            console.log("[UserTasksender] ✅ 已清空 " + count + " 个 Building 任务 (" + roomName + ")");
        }
    },

    /**
     * 处决所有空闲 creep（没有任务的），自刎归天
     * @param {string} roomName 房间名（可选，不传则处决所有房间的空闲 creep）
     */
    cleancreep: function(roomName) {
        let creeps;
        if (roomName) {
            const room = Game.rooms[roomName];
            if (!room || !room.controller || !room.controller.my) {
                console.log("[UserTasksender] ❌ 无效的房间: " + roomName);
                return;
            }
            creeps = room.find(FIND_MY_CREEPS);
        } else {
            creeps = Game.creeps;
        }

        let count = 0;
        for (const name in creeps) {
            const creep = creeps[name];
            const taskType = creep.memory.taskType;
            // 没有任务、或者是 unibot 空闲状态的，都算空闲
            if (!taskType || taskType === 'unibot' || !creep.memory.taskData) {
                creep.suicide();
                count++;
                console.log("[UserTasksender] ⚔️ 处决空闲 creep: " + creep.name);
            }
        }

        console.log("[UserTasksender] ✅ 处决完成，共清理 " + count + " 个空闲 creep");
    },

    /**
     * 显示帮助信息
     */
    help: function() {
        console.log("--- 📖 UserTasksender 帮助 ---");
        console.log("全局对象: Game.tasksender");
        console.log("");
        console.log("📝 Creep 任务类型:");
        console.log("  harvest, upgrade, build, repair, carry, attack, police, sign, claim, reserve, claimupgrade, claimbuild, globalcarry, boost");
        console.log("");
        console.log("🏢 Building 任务类型:");
        console.log("  produce, transport, marketBuy, marketSell, automarket, nukeattack, spawn, linktransport, boost");
        console.log("");
        console.log("🔧 可用方法:");
        console.log("  Game.tasksender.creepTask(roomName, taskType, data)");
        console.log("  Game.tasksender.buildingTask(roomName, taskType, data)");
        console.log("  Game.tasksender.removeTask(roomName, category, typeOrIndex)");
        console.log("  Game.tasksender.listTasks(roomName, category)");
        console.log("  Game.tasksender.clearTasks(roomName, category)");
        console.log("  Game.tasksender.cleancreep([roomName])  - 处决所有空闲 creep");
        console.log("  Game.tasksender.help()");
        console.log("");
        console.log("📌 示例:");
        console.log("  Game.tasksender.creepTask('W1N1', 'harvest', { sourceId: 'sourceId', targetId: 'base' })");
        console.log("  Game.tasksender.buildingTask('W1N1', 'spawn', { model: 'CommonI', energy: 300 })");
        console.log("  Game.tasksender.listTasks('W1N1', 'all')");
        console.log("  Game.tasksender.removeTask('W1N1', 'Creeps', 0)");
        console.log("  Game.tasksender.clearTasks('W1N1', 'all')");
        console.log("  Game.tasksender.cleancreep()           - 处决所有房间的空闲 creep");
        console.log("  Game.tasksender.cleancreep('W1N1')     - 只处决 W1N1 的空闲 creep");
        console.log("---------------------------");
    }
};

module.exports = UserTasksender;
