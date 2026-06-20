/**
 * AP.memcleaner.js
 * 负责内存初始化、失效内存清理以及系统数据查询存入 global。
 */

const search = require('lib.AP.search');

const APMemcleaner = {
    /**
     * 运行清理与初始化逻辑
     */
    run: function() {
        // 1. 内存初始化
        this._initMemory();

        // 2. 清理失效内存
        this._cleanDeadCreeps();
        this._syncTaskboard();

        // 3. 重建缺失的 creep 内存
        this._rebuildCreepMemory();

        // 4. 查询所有需要查询的东西并存入 global
        this._refreshGlobalCache();
    },

    /**
     * 统一内存初始化
     * @private
     */
    _initMemory: function() {
        // 任务看板初始化
        if (!Memory.Taskboard) Memory.Taskboard = {};
        if (!Memory.Taskboard.Task) Memory.Taskboard.Task = { Creeps: {}, Buildings: {}, Strategy: {} };

        // 自动市场初始化
        if (!Memory.AutoMarket) {
            Memory.AutoMarket = {
                settings: { minCredits: 50000, maxSingleTrade: 1000, minProfitMargin: 1.05, energyValue: 7, scanInterval: 50 },
                statistics: { totalProfit: 0, tradesCount: 0 }
            };
        }

        // 生成统计初始化
        if (!Memory.SpawnCreep) Memory.SpawnCreep = { statistics: { totalSpawned: 0 } };
    },

    /**
     * 清理已死亡 Creep 的内存
     * @private
     */
    _cleanDeadCreeps: function() {
        for (const name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
    },

    /**
     * 同步清理任务看板
     * @private
     */
    _syncTaskboard: function() {
        if (!Memory.Taskboard || !Memory.Taskboard.Task) return;
        for (const category in Memory.Taskboard.Task) {
            const roomTasks = Memory.Taskboard.Task[category];
            if (!roomTasks) continue;
            for (const roomName in roomTasks) {
                const tasks = roomTasks[roomName];
                if (!Array.isArray(tasks)) continue;
                for (const task of tasks) {
                    if (task.takenBy && !Game.creeps[task.takenBy]) {
                        task.takenBy = null;
                    }
                }
            }
        }
    },

    /**
     * 重建缺失的 creep 内存
     * @private
     */
    _rebuildCreepMemory: function() {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (!Memory.creeps[name]) {
                // 从名字中提取型号
                const model = this._extractModelFromName(name);
                
                // 检查是否有任务的 takenBy 指向这个 creep
                const taskInfo = this._findTaskByTakenBy(name);
                
                // 重建内存结构
                Memory.creeps[name] = {
                    spawnRoom: creep.room.name,
                    model: model,
                    taskType: taskInfo ? taskInfo.type : null,
                    taskData: taskInfo ? taskInfo.data : null,
                    taskRoom: taskInfo ? taskInfo.room : null,
                    working: false,
                    spawnTime: Game.time
                };
                console.log("[MemCleaner] 🔧 重建了 Creep 内存: " + name + (taskInfo ? " (恢复任务: " + taskInfo.type + ")" : ""));
            } else {
                // 检查关键字段是否缺失
                const memory = Memory.creeps[name];
                if (!memory.spawnRoom) memory.spawnRoom = creep.room.name;
                if (!memory.model) memory.model = this._extractModelFromName(name);
                if (memory.taskType === undefined) memory.taskType = null;
                if (memory.taskData === undefined) memory.taskData = null;
                if (memory.taskRoom === undefined) memory.taskRoom = null;
                if (memory.working === undefined) memory.working = false;
                if (!memory.spawnTime) memory.spawnTime = Game.time;
            }
        }
    },

    /**
     * 查找 takenBy 指向指定 creep 的任务
     * @private
     */
    _findTaskByTakenBy: function(creepName) {
        // 检查 Creeps 任务
        if (Memory.Taskboard && Memory.Taskboard.Task && Memory.Taskboard.Task.Creeps) {
            for (const roomName in Memory.Taskboard.Task.Creeps) {
                const tasks = Memory.Taskboard.Task.Creeps[roomName];
                if (tasks) {
                    for (const task of tasks) {
                        if (task.takenBy === creepName) {
                            return {
                                type: task.type,
                                data: task.data,
                                room: roomName
                            };
                        }
                    }
                }
            }
        }
        
        // 检查 Buildings 任务
        if (Memory.Taskboard && Memory.Taskboard.Task && Memory.Taskboard.Task.Buildings) {
            for (const roomName in Memory.Taskboard.Task.Buildings) {
                const tasks = Memory.Taskboard.Task.Buildings[roomName];
                if (tasks) {
                    for (const task of tasks) {
                        if (task.takenBy === creepName) {
                            return {
                                type: task.type,
                                data: task.data,
                                room: roomName
                            };
                        }
                    }
                }
            }
        }
        
        return null;
    },

    /**
     * 从 creep 名字中提取型号
     * @private
     */
    _extractModelFromName: function(name) {
        // 从名字中提取前缀，例如 "CM1_123" -> "CM1"
        const parts = name.split('_');
        if (parts.length > 0) {
            const prefix = parts[0];
            // 根据前缀映射到完整型号
            const prefixToModel = {
                'CM1': 'CommonI',
                'CR1': 'CarrierI',
                'AT1': 'AttackerI',
                'CL1': 'ClaimerI'
            };
            if (prefixToModel[prefix]) {
                return prefixToModel[prefix];
            }
        }
        // 默认型号
        return 'CommonI';
    },

    /**
     * 刷新全系统 Global 缓存 (高耗能查询由此处统一执行一次)
     * @private
     */
    _refreshGlobalCache: function() {
        const allCreepCounts = search.fetch.allCreepCounts();

        global.SearchCache = {
            gcl: search.fetch.gcl(),
            rooms: {}
        };

        // 遍历所有可见房间进行数据拉取
        for (const roomName in Game.rooms) {
            global.SearchCache.rooms[roomName] = {
                rcl: search.fetch.rcl(roomName),
                creepCounts: allCreepCounts[roomName] || { total: 0 },
                structures: search.fetch.structures(roomName),
                sources: search.fetch.sources(roomName),
                minerals: search.fetch.minerals(roomName),
                constructionSites: search.fetch.constructionSites(roomName)
            };
        }
    }
};

module.exports = APMemcleaner;
