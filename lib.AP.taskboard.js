/**
 * lib.AP.taskboard.js
 * 任务看板库，负责提供任务相关的 API。
 * 路径：Memory.Taskboard.Task.Creeps.[房间名] / Memory.Taskboard.Task.Buildings.[房间名]
 */

const libAPTaskboard = {
    /**
     * 确保房间内存结构存在
     * @private
     */
    _ensureRoom: function(category, roomName) {
        if (!Memory.Taskboard.Task[category][roomName]) {
            Memory.Taskboard.Task[category][roomName] = [];
        }
    },

    /**
     * 创建任务 (内部基础方法)
     * @private
     */
    _addTask: function(category, roomName, type, data) {
        this._ensureRoom(category, roomName);
        // 为了支持多个同类型任务且支持优先级排序，使用数组存储
        if (!Array.isArray(Memory.Taskboard.Task[category][roomName])) {
            Memory.Taskboard.Task[category][roomName] = [];
        }
        
        Memory.Taskboard.Task[category][roomName].push({
            type: type,
            data: data,
            createdTime: Game.time,
            takenBy: null // 标记任务是否已被领取
        });
        // console.log("[Taskboard] ✅ " + category + " 任务创建成功: " + type + " 在房间 " + roomName);
    },

    /**
     * 删除任务 (通过索引、类型或领取者删除)
     * @param {string} roomName 房间名
     * @param {string} category 'Creeps' 或 'Buildings'
     * @param {string|number} typeOrIndexOrName 任务类型、数组索引或领取者姓名 (仅限 Creeps)
     */
    removeTask: function(roomName, category, typeOrIndexOrName) {
        if (Memory.Taskboard && Memory.Taskboard.Task && Memory.Taskboard.Task[category] && Memory.Taskboard.Task[category][roomName]) {
            const tasks = Memory.Taskboard.Task[category][roomName];
            if (!Array.isArray(tasks)) return;

            if (typeof typeOrIndexOrName === 'number') {
                tasks.splice(typeOrIndexOrName, 1);
            } else {
                // 如果是 Creeps 类别，先尝试通过 takenBy 删除（精确匹配）
                if (category === 'Creeps') {
                    const index = tasks.findIndex(t => t.takenBy === typeOrIndexOrName);
                    if (index !== -1) {
                        tasks.splice(index, 1);
                        return;
                    }
                }
                // 如果没找到，则按类型删除（全匹配）
                Memory.Taskboard.Task[category][roomName] = tasks.filter(t => t.type !== typeOrIndexOrName);
            }
        }
    },

    /**
     * 获取指定房间的任务列表（封装 Memory 深度访问，避免 15+ 处重复写法）
     * @param {string} roomName 房间名
     * @param {string} category 'Creeps' 或 'Buildings'
     * @returns {Array} 任务数组，无数据时返回空数组
     */
    getTasks: function(roomName, category) {
        return (Memory.Taskboard && Memory.Taskboard.Task && Memory.Taskboard.Task[category] && Memory.Taskboard.Task[category][roomName]) || [];
    },

    /**
     * Creeps 任务 API
     */
    creeps: {
        harvest: function(roomName, sourceId, targetId) {
            if (!roomName || !sourceId || !targetId) {
                console.log("[Taskboard] ❌ Error: harvest 任务参数缺失 (roomName: " + roomName + ", sourceId: " + sourceId + ", targetId: " + targetId + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'harvest', { sourceId: sourceId, targetId: targetId });
        },

        upgrade: function(roomName, targetId) {
            if (!roomName || !targetId) {
                console.log("[Taskboard] ❌ Error: upgrade 任务参数缺失 (roomName: " + roomName + ", targetId: " + targetId + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'upgrade', { targetId: targetId });
        },

        build: function(roomName, targetId) {
            if (!roomName || !targetId) {
                console.log("[Taskboard] ❌ Error: build 任务参数缺失 (roomName: " + roomName + ", targetId: " + targetId + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'build', { targetId: targetId });
        },

        repair: function(roomName, targetId) {
            if (!roomName || !targetId) {
                console.log("[Taskboard] ❌ Error: repair 任务参数缺失 (roomName: " + roomName + ", targetId: " + targetId + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'repair', { targetId: targetId });
        },

        carry: function(roomName, fromId, toId, resourceType) {
            if (!roomName || !fromId || !toId || !resourceType) {
                console.log("[Taskboard] ❌ Error: carry 任务参数缺失 (roomName: " + roomName + ", fromId: " + fromId + ", toId: " + toId + ", resourceType: " + resourceType + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'carry', { fromId: fromId, toId: toId, resourceType: resourceType });
        },

        attack: function(roomName, targetRoomName) {
            if (!roomName || !targetRoomName) {
                console.log("[Taskboard] ❌ Error: attack 任务参数缺失 (roomName: " + roomName + ", targetRoomName: " + targetRoomName + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'attack', { targetRoomName: targetRoomName });
        },

        police: function(roomName, posOrAuto) {
            if (!roomName || !posOrAuto) {
                console.log("[Taskboard] ❌ Error: police 任务参数缺失 (roomName: " + roomName + ", posOrAuto: " + posOrAuto + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'police', { posOrAuto: posOrAuto });
        },

        sign: function(roomName, targetRoomName, signText) {
            if (!roomName || !targetRoomName || signText === undefined) {
                console.log("[Taskboard] ❌ Error: sign 任务参数缺失 (roomName: " + roomName + ", targetRoomName: " + targetRoomName + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'sign', { targetRoomName: targetRoomName, signText: signText });
        },

        claimupgrade: function(roomName, targetRoomName, sourceId) {
            if (!roomName || !targetRoomName || !sourceId) {
                console.log("[Taskboard] ❌ Error: claimupgrade 任务参数缺失 (roomName: " + roomName + ", targetRoomName: " + targetRoomName + ", sourceId: " + sourceId + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'claimupgrade', { targetRoomName: targetRoomName, sourceId: sourceId });
        },

        claimbuild: function(roomName, targetRoomName, sourceId) {
            if (!roomName || !targetRoomName || !sourceId) {
                console.log("[Taskboard] ❌ Error: claimbuild 任务参数缺失 (roomName: " + roomName + ", targetRoomName: " + targetRoomName + ", sourceId: " + sourceId + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'claimbuild', { targetRoomName: targetRoomName, sourceId: sourceId });
        },

        globalcarry: function(roomName, fromRoom, toRoom, fromId, toId, resourceType) {
            if (!roomName || !fromRoom || !toRoom || !fromId || !toId || !resourceType) {
                console.log("[Taskboard] ❌ Error: globalcarry 任务参数缺失 (roomName: " + roomName + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'globalcarry', { 
                fromRoom: fromRoom, 
                toRoom: toRoom, 
                fromId: fromId, 
                toId: toId, 
                resourceType: resourceType 
            });
        },

        boost: function(roomName, labId, bodyPart) {
            if (!roomName || !labId || !bodyPart) {
                console.log("[Taskboard] ❌ Error: boost 任务参数缺失 (roomName: " + roomName + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'boost', { labId: labId, bodyPart: bodyPart });
        },

        claim: function(roomName, targetRoomName) {
            if (!roomName || !targetRoomName) {
                console.log("[Taskboard] ❌ Error: claim 任务参数缺失 (roomName: " + roomName + ", targetRoomName: " + targetRoomName + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'claim', { targetRoomName: targetRoomName });
        },

        reserve: function(roomName, targetRoomName) {
            if (!roomName || !targetRoomName) {
                console.log("[Taskboard] ❌ Error: reserve 任务参数缺失 (roomName: " + roomName + ", targetRoomName: " + targetRoomName + ")");
                return;
            }
            libAPTaskboard._addTask('Creeps', roomName, 'reserve', { targetRoomName: targetRoomName });
        }
    },

    /**
     * Buildings 任务 API
     */
    buildings: {
        produce: function(roomName, resourceType) {
            if (!roomName || !resourceType) {
                console.log("[Taskboard] ❌ Error: produce 任务参数缺失 (roomName: " + roomName + ", resourceType: " + resourceType + ")");
                return;
            }
            libAPTaskboard._addTask('Buildings', roomName, 'produce', { resourceType: resourceType });
        },

        transport: function(roomName, fromRoom, toRoom, resourceType, amount) {
            if (!roomName || !fromRoom || !toRoom || !resourceType || !amount) {
                console.log("[Taskboard] ❌ Error: transport 任务参数缺失 (roomName: " + roomName + ")");
                return;
            }
            libAPTaskboard._addTask('Buildings', roomName, 'transport', { fromRoom: fromRoom, toRoom: toRoom, resourceType: resourceType, amount: amount });
        },

        marketBuy: function(roomName, resourceType, amount) {
            if (!roomName || !resourceType || !amount) {
                console.log("[Taskboard] ❌ Error: marketBuy 任务参数缺失 (roomName: " + roomName + ")");
                return;
            }
            libAPTaskboard._addTask('Buildings', roomName, 'marketBuy', { resourceType: resourceType, amount: amount });
        },

        marketSell: function(roomName, resourceType, amount, useOrder) {
            if (!roomName || !resourceType || !amount || useOrder === undefined) {
                console.log("[Taskboard] ❌ Error: marketSell 任务参数缺失 (roomName: " + roomName + ")");
                return;
            }
            libAPTaskboard._addTask('Buildings', roomName, 'marketSell', { 
                resourceType: resourceType, 
                amount: amount, 
                useOrder: !!useOrder 
            });
        },

        automarket: function(roomName) {
            if (!roomName) {
                console.log("[Taskboard] ❌ Error: automarket 任务参数缺失 (roomName: " + roomName + ")");
                return;
            }
            libAPTaskboard._addTask('Buildings', roomName, 'automarket', {});
        },

        /**
         * 核弹攻击任务
         * @param {string} roomName 执行任务的房间
         * @param {string} targetRoomName 目标房间
         */
        nukeattack: function(roomName, targetRoomName) {
            if (!roomName || !targetRoomName) {
                console.log("[Taskboard] ❌ Error: nukeattack 任务参数缺失 (targetRoomName: " + targetRoomName + ")");
                return;
            }
            libAPTaskboard._addTask('Buildings', roomName, 'nukeattack', { targetRoomName: targetRoomName });
        },

        /**
         * 发布Spawn任务（支持Strategy集成，4参数版本）
         * @param {string} roomName 房间名
         * @param {string} model Creep型号
         * @param {string|number} priority 优先级或能量值
         * @param {Object} data 附加数据（可选）
         */
        spawn: function(roomName, model, priority, data) {
            if (!roomName || !model) {
                console.log("[Taskboard] ❌ Error: spawn 任务参数缺失 (roomName: " + roomName + ", model: " + model + ")");
                return;
            }
            libAPTaskboard._addTask('Buildings', roomName, 'spawn', {
                model: model,
                priority: priority,
                data: data || {},
                requestedTime: Game.time
            });
        },

        linktransport: function(roomName) {
            if (!roomName) {
                console.log("[Taskboard] ❌ Error: linktransport 任务参数缺失 (roomName: " + roomName + ")");
                return;
            }
            libAPTaskboard._addTask('Buildings', roomName, 'linktransport', {});
        },

        boost: function(roomName, bodyPart) {
            if (!roomName || !bodyPart) {
                console.log("[Taskboard] ❌ Error: boost 任务参数缺失 (roomName: " + roomName + ")");
                return;
            }
            libAPTaskboard._addTask('Buildings', roomName, 'boost', { bodyPart: bodyPart });
        }
    },

    /**
     * Strategy 任务 API (全局决策AI)
     */
    strategy: {
        needCreeps: function(roomName, options) {
            if (!roomName || !options || !options.model || !options.count) return;
            libAPTaskboard._addTask('Strategy', roomName, 'need_creeps', {
                model: options.model,
                count: options.count,
                priority: options.priority || 'harvest',
                data: options.data || {},
                refreshInterval: options.refreshInterval || 100
            });
        },
        marketAction: function(roomName, action, resource, amount) {
            if (typeof ENABLE_MARKET !== 'undefined' && !ENABLE_MARKET) return;
            libAPTaskboard._addTask('Strategy', roomName, 'market_action', {
                action: action, resource: resource, amount: amount
            });
        },
        labProduction: function(roomName, compound, targetAmount) {
            libAPTaskboard._addTask('Strategy', roomName, 'lab_production', {
                compound: compound, targetAmount: targetAmount
            });
        },
        cleanExpired: function(roomName, maxAge) {
            if (!Memory.Taskboard?.Task?.Strategy?.[roomName]) return;
            const now = Game.time;
            Memory.Taskboard.Task.Strategy[roomName] = Memory.Taskboard.Task.Strategy[roomName]
                .filter(task => (now - task.createdTime) < maxAge);
        }
    }
};

module.exports = libAPTaskboard;
