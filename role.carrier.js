// Carrier角色模块 - 支持条件判断作用于目标或源
var roleCarrier = {
    /** @param {Creep} creep **/
    run: function(creep) {
        const roomName = creep.room.name;
        
        // 初始化内存结构
        if (!Memory.TangYuanLonelyCat) {
            Memory.TangYuanLonelyCat = {};
        }
        if (!Memory.TangYuanLonelyCat.Carrier) {
            Memory.TangYuanLonelyCat.Carrier = {};
        }
        if (!Memory.TangYuanLonelyCat.Carrier[roomName]) {
            Memory.TangYuanLonelyCat.Carrier[roomName] = { Connections: [] };
        }
        
        const connections = Memory.TangYuanLonelyCat.Carrier[roomName].Connections;
        
        // 如果没有连接，则待机
        if (connections.length === 0) {
            creep.say('💤 空闲');
            this.idleBehavior(creep);
            return;
        }
        
        // 过滤掉无效的连接（仅当源或目标对象不存在或无store时删除，条件不满足时保留）
        const validConnections = connections.filter(conn => {
            const source = Game.getObjectById(conn.sourceId);
            const target = Game.getObjectById(conn.targetId);
            // 只要对象存在且有store，就保留（即使条件不满足）
            return source && target && source.store && target.store;
        });
        
        // 更新内存中的连接列表（只删除对象不存在的连接）
        if (validConnections.length < connections.length) {
            Memory.TangYuanLonelyCat.Carrier[roomName].Connections = validConnections;
        }
        
        // 如果所有对象都不存在，待机
        if (validConnections.length === 0) {
            creep.say('💤 无有效连接');
            this.idleBehavior(creep);
            return;
        }
        
        // 如果身上有资源，优先处理
        if (creep.store.getUsedCapacity() > 0) {
            this.handleCarryingResources(creep, validConnections);
        } else {
            // 身上没有资源，寻找新任务
            this.findAndExecuteTask(creep, validConnections);
        }
    },
    
    // 解析条件字符串为结构化对象
    parseCondition: function(conditionStr) {
        if (!conditionStr) return null;
        const match = conditionStr.match(/([a-zA-Z0-9_]+)\s*([<>]=?|==|!=)\s*(\d+(?:\.\d+)?)/);
        if (!match) {
            console.log('警告: 无效的条件格式: ' + conditionStr);
            return null;
        }
        return {
            resourceType: match[1],
            operator: match[2],
            value: parseFloat(match[3])
        };
    },
    
    // 检查条件是否满足（根据 conditionTarget 选择使用 source 或 target 的资源量）
    // conditionParsed: 解析后的条件对象，conditionTarget: true 表示检查目标，false 表示检查源
    checkCondition: function(conditionParsed, conditionTarget, source, target) {
        if (!conditionParsed) return true; // 无条件视为真
        const obj = conditionTarget ? target : source;
        if (!obj || !obj.store) return false; // 对象无效
        const amount = obj.store[conditionParsed.resourceType] || 0;
        switch(conditionParsed.operator) {
            case '>': return amount > conditionParsed.value;
            case '>=': return amount >= conditionParsed.value;
            case '<': return amount < conditionParsed.value;
            case '<=': return amount <= conditionParsed.value;
            case '==': return amount === conditionParsed.value;
            case '!=': return amount !== conditionParsed.value;
            default: return false;
        }
    },
    
    // 处理携带资源的情况
    handleCarryingResources: function(creep, connections) {
        const carriedResourceType = Object.keys(creep.store)[0];
        const carriedAmount = creep.store[carriedResourceType];
        
        // 如果有当前任务，继续执行
        if (creep.memory.currentTask) {
            const task = creep.memory.currentTask;
            const source = Game.getObjectById(task.sourceId);
            const target = Game.getObjectById(task.targetId);
            
            // 检查任务是否仍然有效
            if (source && target && source.store && target.store) {
                // 检查条件是否仍然满足（根据 task.conditionTarget 选择检查对象）
                if (task.conditionParsed && !this.checkCondition(task.conditionParsed, task.conditionTarget, source, target)) {
                    // 条件不满足，将资源送回源
                    this.returnToSource(creep, source, carriedResourceType, task, connections);
                    return;
                }
                
                // 尝试递送到目标
                const transferResult = this.tryTransferToTarget(creep, target, carriedResourceType);
                
                if (transferResult === OK) {
                    // 递送成功，标记任务完成
                    this.markTaskComplete(creep, task, connections);
                    return;
                } else if (transferResult === ERR_FULL) {
                    // 目标已满，将资源送回源
                    this.returnToSource(creep, source, carriedResourceType, task, connections);
                    return;
                } else if (transferResult === ERR_NOT_IN_RANGE) {
                    // 移动到目标
                    creep.moveTo(target, {
                        visualizePathStyle: {stroke: '#00ff00'},
                        reusePath: 5
                    });
                    creep.say('📤 送' + carriedResourceType);
                    return;
                }
            }
            
            // 任务无效，清除并寻找新任务
            delete creep.memory.currentTask;
        }
        
        // 没有任务或任务无效，寻找可接收当前资源的目标
        const viableTargets = this.findViableTargets(creep, connections, carriedResourceType);
        
        if (viableTargets.length > 0) {
            // 选择最佳目标
            const bestTarget = this.selectBestTarget(viableTargets, carriedResourceType);
            const task = this.createTaskFromConnection(bestTarget.connection, carriedResourceType);
            
            creep.memory.currentTask = task;
            this.executeDelivery(creep, bestTarget.target, carriedResourceType);
        } else {
            // 没有合适的目标，送回最近的存储设施
            this.deliverToNearestStorage(creep, carriedResourceType);
        }
    },
    
    // 尝试将资源递送到目标
    tryTransferToTarget: function(creep, target, resourceType) {
        // 检查目标是否有空间
        const freeCapacity = target.store.getFreeCapacity(resourceType);
        if (freeCapacity === 0) {
            return ERR_FULL;
        }
        
        return creep.transfer(target, resourceType);
    },
    
    // 将资源送回源
    returnToSource: function(creep, source, resourceType, currentTask, connections) {
        const transferResult = creep.transfer(source, resourceType);
        
        if (transferResult === OK) {
            creep.say('↩️ 返回');
            // 清除当前任务，因为目标已满
            delete creep.memory.currentTask;
            
            // 尝试寻找房间内的下一个连接任务
            const nextTask = this.findNextTask(creep, connections, currentTask);
            if (nextTask) {
                creep.memory.currentTask = nextTask;
            }
        } else if (transferResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, {
                visualizePathStyle: {stroke: '#ff0000'},
                reusePath: 5
            });
            creep.say('↩️ 返回');
        } else if (transferResult === ERR_FULL) {
            // 源也满了，送到最近的存储设施
            this.deliverToNearestStorage(creep, resourceType);
        }
    },
    
    // 寻找并执行任务
    findAndExecuteTask: function(creep, connections) {
        // 如果有当前任务，尝试继续执行
        if (creep.memory.currentTask) {
            const task = creep.memory.currentTask;
            const source = Game.getObjectById(task.sourceId);
            const target = Game.getObjectById(task.targetId);
            
            if (source && target && source.store && target.store) {
                // 检查源是否有资源
                const hasResources = this.checkSourceHasResources(source, task.resourceType);
                
                if (hasResources) {
                    this.executeCollection(creep, source, task.resourceType, task);
                    return;
                } else {
                    // 源没有资源，寻找下一个任务
                    delete creep.memory.currentTask;
                }
            } else {
                // 任务无效，清除
                delete creep.memory.currentTask;
            }
        }
        
        // 寻找新任务
        const availableTasks = this.findAvailableTasks(connections);
        
        if (availableTasks.length === 0) {
            creep.say('💤 无任务');
            this.idleBehavior(creep);
            return;
        }
        
        // 选择最佳任务
        const bestTask = this.selectBestTask(availableTasks);
        
        if (bestTask) {
            creep.memory.currentTask = bestTask.task;
            this.executeCollection(creep, bestTask.source, bestTask.task.resourceType, bestTask.task);
        }
    },
    
    // 寻找可用的任务（根据条件筛选连接）
    findAvailableTasks: function(connections) {
        const availableTasks = [];
        
        for (let i = 0; i < connections.length; i++) {
            const conn = connections[i];
            const source = Game.getObjectById(conn.sourceId);
            const target = Game.getObjectById(conn.targetId);
            
            if (!source || !target || !source.store || !target.store) {
                continue;
            }
            
            // 检查源是否有资源
            const hasResources = this.checkSourceHasResources(source, conn.resourceType);
            if (!hasResources) {
                continue;
            }
            
            // 检查条件（根据 conditionTarget 选择检查对象）
            if (!this.checkCondition(conn.conditionParsed, conn.conditionTarget, source, target)) {
                continue;
            }
            
            // 检查目标是否有空间
            if (conn.resourceType !== 'ALL') {
                const freeCapacity = target.store.getFreeCapacity(conn.resourceType);
                if (freeCapacity === 0) {
                    continue; // 目标已满，跳过这个任务
                }
            } else {
                // ALL类型，检查总空闲容量
                if (target.store.getFreeCapacity() === 0) {
                    continue;
                }
            }
            
            // 计算任务优先级分数
            let priorityScore = 0;
            
            // 资源越多，优先级越高
            const resourceAmount = this.getSourceResourceAmount(source, conn.resourceType);
            priorityScore += resourceAmount * 0.1;
            
            // 创建时间越早，优先级越高（负值，所以时间越小分数越高）
            priorityScore -= conn.createdAt * 0.0001;
            
            availableTasks.push({
                connection: conn,
                source: source,
                target: target,
                task: {
                    sourceId: conn.sourceId,
                    targetId: conn.targetId,
                    resourceType: this.getPrimaryResourceType(source, conn.resourceType),
                    conditionParsed: conn.conditionParsed,
                    conditionTarget: conn.conditionTarget // 保存条件作用对象
                },
                priorityScore: priorityScore,
                resourceAmount: resourceAmount
            });
        }
        
        // 按优先级排序
        availableTasks.sort(function(a, b) {
            return b.priorityScore - a.priorityScore;
        });
        
        return availableTasks;
    },
    
    // 选择最佳任务
    selectBestTask: function(availableTasks) {
        if (availableTasks.length === 0) {
            return null;
        }
        
        // 优先选择资源量多的任务
        return availableTasks[0];
    },
    
    // 寻找下一个任务（当前任务完成后）
    findNextTask: function(creep, connections, completedTask) {
        // 寻找除已完成任务外的其他任务
        const otherConnections = connections.filter(function(conn) {
            return !(conn.sourceId === completedTask.sourceId && 
                    conn.targetId === completedTask.targetId &&
                    conn.resourceType === completedTask.resourceType &&
                    conn.condition === completedTask.condition &&
                    conn.conditionTarget === completedTask.conditionTarget); // 条件目标也需匹配
        });
        
        if (otherConnections.length === 0) {
            // 只有一个连接，没有其他任务
            return null;
        }
        
        // 寻找可用任务
        const availableTasks = this.findAvailableTasks(otherConnections);
        
        if (availableTasks.length === 0) {
            return null;
        }
        
        // 选择最佳任务
        const bestTask = this.selectBestTask(availableTasks);
        return bestTask ? bestTask.task : null;
    },
    
    // 检查源是否有资源
    checkSourceHasResources: function(source, resourceType) {
        if (resourceType === 'ALL') {
            // 检查是否有任何资源
            const storeKeys = Object.keys(source.store);
            for (let i = 0; i < storeKeys.length; i++) {
                const res = storeKeys[i];
                if (source.store[res] > 0) {
                    return true;
                }
            }
            return false;
        } else {
            return (source.store[resourceType] || 0) > 0;
        }
    },
    
    // 获取源中资源量
    getSourceResourceAmount: function(source, resourceType) {
        if (resourceType === 'ALL') {
            // 返回总资源量
            let total = 0;
            const storeKeys = Object.keys(source.store);
            for (let i = 0; i < storeKeys.length; i++) {
                total += source.store[storeKeys[i]];
            }
            return total;
        } else {
            return source.store[resourceType] || 0;
        }
    },
    
    // 获取主要资源类型
    getPrimaryResourceType: function(source, resourceType) {
        if (resourceType === 'ALL') {
            // 返回最多的资源类型
            let maxAmount = 0;
            let maxType = 'energy'; // 默认
            const storeKeys = Object.keys(source.store);
            for (let i = 0; i < storeKeys.length; i++) {
                const res = storeKeys[i];
                if (source.store[res] > maxAmount) {
                    maxAmount = source.store[res];
                    maxType = res;
                }
            }
            return maxType;
        } else {
            return resourceType;
        }
    },
    
    // 执行收集
    executeCollection: function(creep, source, resourceType, task) {
        if (creep.withdraw(source, resourceType) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, {
                visualizePathStyle: {stroke: '#ffaa00'},
                reusePath: 5
            });
            creep.say('🚚 取' + resourceType);
        } else {
            // 收集成功，保持任务
            creep.memory.currentTask = task;
        }
    },
    
    // 执行递送
    executeDelivery: function(creep, target, resourceType) {
        if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                visualizePathStyle: {stroke: '#00ff00'},
                reusePath: 5
            });
            creep.say('📤 送' + resourceType);
        }
    },
    
    // 寻找可接收当前资源的目标
    findViableTargets: function(creep, connections, resourceType) {
        const viableTargets = [];
        
        for (let i = 0; i < connections.length; i++) {
            const conn = connections[i];
            const target = Game.getObjectById(conn.targetId);
            
            if (!target || !target.store) {
                continue;
            }
            
            // 检查条件（根据 conditionTarget 选择检查对象，但此处只关心目标能否接收资源，因此条件如果是基于源的，可能仍需检查？）
            // 注意：在寻找可接收当前资源的目标时，我们通常只关心目标本身是否有空间以及条件是否满足。
            // 如果条件是针对源的，它可能已经在上游检查过了，但为了安全，这里也检查一次。
            // 我们调用 checkCondition 时需要传入 source 和 target，其中 source 为 conn.sourceId 对应的对象
            const source = Game.getObjectById(conn.sourceId);
            if (!source || !source.store) continue;
            if (!this.checkCondition(conn.conditionParsed, conn.conditionTarget, source, target)) {
                continue;
            }
            
            // 检查资源类型是否匹配
            if (conn.resourceType !== 'ALL' && conn.resourceType !== resourceType) {
                continue;
            }
            
            // 检查目标是否有空间接收该资源
            const freeCapacity = target.store.getFreeCapacity(resourceType);
            if (freeCapacity > 0) {
                viableTargets.push({
                    connection: conn,
                    target: target,
                    freeCapacity: freeCapacity,
                    distance: creep.pos.getRangeTo(target)
                });
            }
        }
        
        return viableTargets;
    },
    
    // 选择最佳目标
    selectBestTarget: function(viableTargets, resourceType) {
        if (viableTargets.length === 0) {
            return null;
        }
        
        // 优先选择空间大的，距离近的
        viableTargets.sort(function(a, b) {
            // 按空间容量排序（降序）
            if (b.freeCapacity !== a.freeCapacity) {
                return b.freeCapacity - a.freeCapacity;
            }
            // 按距离排序（升序）
            return a.distance - b.distance;
        });
        
        return viableTargets[0];
    },
    
    // 从连接创建任务
    createTaskFromConnection: function(connection, resourceType) {
        return {
            sourceId: connection.sourceId,
            targetId: connection.targetId,
            resourceType: resourceType,
            conditionParsed: connection.conditionParsed,
            conditionTarget: connection.conditionTarget // 保存条件作用对象
        };
    },
    
    // 标记任务完成
    markTaskComplete: function(creep, completedTask, connections) {
        // 清除当前任务
        delete creep.memory.currentTask;
        
        // 如果房间有多个连接，寻找下一个任务
        if (connections.length > 1) {
            const nextTask = this.findNextTask(creep, connections, completedTask);
            if (nextTask) {
                creep.memory.currentTask = nextTask;
            }
        }
    },
    
    // 递送到最近的存储设施
    deliverToNearestStorage: function(creep, resourceType) {
        const storage = creep.room.storage;
        const terminal = creep.room.terminal;
        
        let target = null;
        
        // 优先选择storage，然后是terminal
        if (storage && storage.store && storage.store.getFreeCapacity(resourceType) > 0) {
            target = storage;
        } else if (terminal && terminal.store && terminal.store.getFreeCapacity(resourceType) > 0) {
            target = terminal;
        }
        
        if (target) {
            if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {reusePath: 5});
                creep.say('🏪 存' + resourceType);
            } else {
                // 存储成功，清除任务
                delete creep.memory.currentTask;
            }
        } else {
            creep.say('❌ 无处存');
            this.idleBehavior(creep);
        }
    },
    
    // 待机行为
    idleBehavior: function(creep) {
        // 在房间中心附近待命
        const center = new RoomPosition(25, 25, creep.room.name);
        if (creep.pos.getRangeTo(center) > 5) {
            creep.moveTo(center, {
                visualizePathStyle: {stroke: '#ffffff'},
                reusePath: 10
            });
        }
        
        // 定期检查是否有新任务
        if (Game.time % 10 === 0) {
            const roomName = creep.room.name;
            const memoryObj = Memory.TangYuanLonelyCat;
            let connections = [];
            
            if (memoryObj && memoryObj.Carrier && memoryObj.Carrier[roomName] && memoryObj.Carrier[roomName].Connections) {
                connections = memoryObj.Carrier[roomName].Connections;
            }
            
            if (connections.length > 0 && !creep.memory.currentTask) {
                // 尝试寻找任务
                const availableTasks = this.findAvailableTasks(connections);
                if (availableTasks.length > 0) {
                    const bestTask = this.selectBestTask(availableTasks);
                    if (bestTask) {
                        creep.memory.currentTask = bestTask.task;
                    }
                }
            }
        }
    }
};

// ================== 全局函数（由玩家调用）==================

// 全局函数：添加搬运连接（无条件）
global.carry = function(roomName, sourceId, targetId, resourceType) {
    // 设置默认值
    if (resourceType === undefined) {
        resourceType = 'ALL';
    }
    
    // 验证参数
    if (!roomName || !sourceId || !targetId) {
        console.log('❌ 参数错误: carry(roomName, sourceId, targetId, resourceType)');
        return false;
    }
    
    // 动态资源类型列表：'ALL' 拼接所有官方资源类型（支持 UO 等所有化合物）
    const validResourceTypes = ['ALL'].concat(RESOURCES_ALL);
    if (!validResourceTypes.includes(resourceType)) {
        console.log('❌ 无效的资源类型: ' + resourceType);
        console.log('使用 carryhelp() 查看所有可用资源类型');
        return false;
    }
    
    const source = Game.getObjectById(sourceId);
    const target = Game.getObjectById(targetId);
    
    if (!source) {
        console.log('❌ 源对象不存在: ' + sourceId);
        return false;
    }
    
    if (!target) {
        console.log('❌ 目标对象不存在: ' + targetId);
        return false;
    }
    
    if (!source.store) {
        console.log('❌ 源对象无法存储物品: ' + sourceId);
        return false;
    }
    
    if (!target.store) {
        console.log('❌ 目标对象无法存储物品: ' + targetId);
        return false;
    }
    
    // 检查源和目标是否在同一房间
    if (source.room.name !== target.room.name) {
        console.log('❌ 源和目标不在同一房间: 源在' + source.room.name + '，目标在' + target.room.name);
        return false;
    }
    
    // 检查房间名是否匹配
    if (source.room.name !== roomName) {
        console.log('❌ 房间名不匹配: 指定' + roomName + '，实际' + source.room.name);
        return false;
    }
    
    // 初始化内存结构
    if (!Memory.TangYuanLonelyCat) {
        Memory.TangYuanLonelyCat = {};
    }
    if (!Memory.TangYuanLonelyCat.Carrier) {
        Memory.TangYuanLonelyCat.Carrier = {};
    }
    if (!Memory.TangYuanLonelyCat.Carrier[roomName]) {
        Memory.TangYuanLonelyCat.Carrier[roomName] = { Connections: [] };
    }
    
    const connections = Memory.TangYuanLonelyCat.Carrier[roomName].Connections;
    
    // 检查是否已存在完全相同的连接
    let existingIndex = -1;
    for (let i = 0; i < connections.length; i++) {
        const conn = connections[i];
        if (conn.sourceId === sourceId && 
            conn.targetId === targetId && 
            conn.resourceType === resourceType &&
            !conn.condition) { // 无条件连接
            existingIndex = i;
            break;
        }
    }
    
    if (existingIndex === -1) {
        // 添加新连接（无条件）
        connections.push({
            sourceId: sourceId,
            targetId: targetId,
            resourceType: resourceType,
            condition: null,
            conditionParsed: null,
            conditionTarget: true, // 默认设为 true（目标），虽然无条件时此字段无意义，但保持统一
            createdAt: Game.time
        });
        
        console.log('✅ 添加搬运连接: ' + roomName + ' 从 ' + sourceId + ' 到 ' + targetId + ' (' + resourceType + ')');
        return true;
    } else {
        console.log('ℹ️ 连接已存在: ' + roomName + ' 从 ' + sourceId + ' 到 ' + targetId + ' (' + resourceType + ')');
        return false;
    }
};

// 全局函数：添加带条件的搬运连接（新增布尔参数 conditionTarget，默认为 true 表示作用于目标）
global.carryif = function(roomName, sourceId, targetId, resourceType, condition, conditionTarget = true) {
    // 参数验证
    if (!roomName || !sourceId || !targetId) {
        console.log('❌ 参数错误: carryif(roomName, sourceId, targetId, resourceType, condition, conditionTarget)');
        return false;
    }
    
    // 设置默认资源类型
    if (resourceType === undefined) {
        resourceType = 'ALL';
    }
    
    // 动态资源类型列表：'ALL' 拼接所有官方资源类型（支持 UO 等所有化合物）
    const validResourceTypes = ['ALL'].concat(RESOURCES_ALL);
    if (!validResourceTypes.includes(resourceType)) {
        console.log('❌ 无效的资源类型: ' + resourceType);
        console.log('使用 carryhelp() 查看所有可用资源类型');
        return false;
    }
    
    // 验证条件格式（如果提供）
    if (condition && typeof condition === 'string') {
        const match = condition.match(/([a-zA-Z0-9_]+)\s*([<>]=?|==|!=)\s*(\d+(?:\.\d+)?)/);
        if (!match) {
            console.log('❌ 无效的条件格式: ' + condition + '，应为 "资源类型 操作符 数值"，例如 "energy >= 5000"');
            return false;
        }
    } else if (condition === undefined || condition === null) {
        // 如果没提供条件，相当于无条件，可以调用 carry
        return global.carry(roomName, sourceId, targetId, resourceType);
    }
    
    // conditionTarget 应该为布尔值，如果不是则转换为布尔值
    conditionTarget = !!conditionTarget;
    
    const source = Game.getObjectById(sourceId);
    const target = Game.getObjectById(targetId);
    
    if (!source) {
        console.log('❌ 源对象不存在: ' + sourceId);
        return false;
    }
    if (!target) {
        console.log('❌ 目标对象不存在: ' + targetId);
        return false;
    }
    if (!source.store) {
        console.log('❌ 源对象无法存储物品: ' + sourceId);
        return false;
    }
    if (!target.store) {
        console.log('❌ 目标对象无法存储物品: ' + targetId);
        return false;
    }
    if (source.room.name !== target.room.name) {
        console.log('❌ 源和目标不在同一房间: 源在' + source.room.name + '，目标在' + target.room.name);
        return false;
    }
    if (source.room.name !== roomName) {
        console.log('❌ 房间名不匹配: 指定' + roomName + '，实际' + source.room.name);
        return false;
    }
    
    // 初始化内存结构
    if (!Memory.TangYuanLonelyCat) {
        Memory.TangYuanLonelyCat = {};
    }
    if (!Memory.TangYuanLonelyCat.Carrier) {
        Memory.TangYuanLonelyCat.Carrier = {};
    }
    if (!Memory.TangYuanLonelyCat.Carrier[roomName]) {
        Memory.TangYuanLonelyCat.Carrier[roomName] = { Connections: [] };
    }
    
    const connections = Memory.TangYuanLonelyCat.Carrier[roomName].Connections;
    
    // 检查是否已存在完全相同的连接（包括条件和条件目标）
    let existingIndex = -1;
    for (let i = 0; i < connections.length; i++) {
        const conn = connections[i];
        if (conn.sourceId === sourceId && 
            conn.targetId === targetId && 
            conn.resourceType === resourceType &&
            conn.condition === condition &&
            conn.conditionTarget === conditionTarget) {
            existingIndex = i;
            break;
        }
    }
    
    if (existingIndex === -1) {
        // 解析条件
        const match = condition.match(/([a-zA-Z0-9_]+)\s*([<>]=?|==|!=)\s*(\d+(?:\.\d+)?)/);
        const conditionParsed = match ? {
            resourceType: match[1],
            operator: match[2],
            value: parseFloat(match[3])
        } : null;
        
        // 添加新连接
        connections.push({
            sourceId: sourceId,
            targetId: targetId,
            resourceType: resourceType,
            condition: condition,
            conditionParsed: conditionParsed,
            conditionTarget: conditionTarget, // 存储条件作用对象
            createdAt: Game.time
        });
        
        console.log('✅ 添加搬运连接 (带条件): ' + roomName + ' 从 ' + sourceId + ' 到 ' + targetId + ' (' + resourceType + ') 条件: ' + condition + ' 作用对象: ' + (conditionTarget ? '目标' : '源'));
        return true;
    } else {
        console.log('ℹ️ 连接已存在: ' + roomName + ' 从 ' + sourceId + ' 到 ' + targetId + ' (' + resourceType + ') 条件: ' + condition + ' 作用对象: ' + (conditionTarget ? '目标' : '源'));
        return false;
    }
};

// 全局函数：显示所有可用的资源类型
global.carryhelp = function() {
    console.log('📚 Carrier系统 - 可用资源类型:');
    console.log('═══════════════════════════════════════════════');
    console.log('命令格式: carry("房间名", "源ID", "目标ID", "资源类型")');
    console.log('         carryif("房间名", "源ID", "目标ID", "资源类型", "条件", [conditionTarget])');
    console.log('         conditionTarget 为布尔值，true（默认）表示条件作用于目标，false 表示作用于源');
    console.log('');
    console.log('📁 所有官方资源类型（自动支持）:');
    const sampleResources = RESOURCES_ALL.slice(0, 20).join(', ');
    console.log('  示例: ' + sampleResources + ' ...');
    console.log('  以及 "ALL" 表示所有资源。');
    console.log('');
    console.log('📋 示例:');
    console.log('  carry("W1N1", "5d8d7c6b5a4b3c2d1e", "1a2b3c4d5e6f7g8h9i", "energy")');
    console.log('  carryif("W1N1", "5d8d7c6b5a4b3c2d1e", "1a2b3c4d5e6f7g8h9i", "UO", "UO < 3000")            # 作用于目标（默认）');
    console.log('  carryif("W1N1", "5d8d7c6b5a4b3c2d1e", "1a2b3c4d5e6f7g8h9i", "UO", "UO >= 2000", false)   # 作用于源');
    console.log('═══════════════════════════════════════════════');
    console.log('💡 提示: 使用 "ALL" 可以搬运源中的所有资源类型');
    console.log('💡 提示: 使用 showCarrierConnections() 查看已有连接');
    console.log('💡 提示: 使用 cleanupCarrierConnections() 清理无效连接');
};

// 全局函数：显示房间的搬运连接（更新显示条件作用对象）
global.showCarrierConnections = function(roomName) {
    const memoryObj = Memory.TangYuanLonelyCat;
    if (!memoryObj || !memoryObj.Carrier || !memoryObj.Carrier[roomName] || !memoryObj.Carrier[roomName].Connections) {
        console.log('ℹ️ ' + roomName + ' 没有搬运连接');
        return;
    }
    
    const connections = memoryObj.Carrier[roomName].Connections;
    console.log('📊 ' + roomName + ' 搬运连接列表 (' + connections.length + '个):');
    
    for (let i = 0; i < connections.length; i++) {
        const conn = connections[i];
        const source = Game.getObjectById(conn.sourceId);
        const target = Game.getObjectById(conn.targetId);
        const sourceName = source ? source.structureType + '(' + source.pos.x + ',' + source.pos.y + ')' : '已销毁';
        const targetName = target ? target.structureType + '(' + target.pos.x + ',' + target.pos.y + ')' : '已销毁';
        
        // 检查源当前资源量
        let sourceResources = '无资源';
        if (source && source.store) {
            if (conn.resourceType === 'ALL') {
                const resources = [];
                const storeKeys = Object.keys(source.store);
                for (let j = 0; j < storeKeys.length; j++) {
                    const res = storeKeys[j];
                    if (source.store[res] > 0) {
                        resources.push(res + ':' + source.store[res]);
                    }
                }
                sourceResources = resources.length > 0 ? resources.join(', ') : '无资源';
            } else {
                sourceResources = conn.resourceType + ':' + (source.store[conn.resourceType] || 0);
            }
        }
        
        const conditionTargetStr = conn.conditionTarget !== undefined ? (conn.conditionTarget ? '目标' : '源') : '目标(默认)';
        console.log('  [' + i + '] ' + conn.sourceId + ' (' + sourceName + ') -> ' + conn.targetId + ' (' + targetName + ') [' + conn.resourceType + '] 条件: ' + (conn.condition || '无') + ' 作用: ' + conditionTargetStr);
        console.log('      源资源: ' + sourceResources);
    }
};

// 全局函数：删除搬运连接（增加条件目标匹配）
global.removeCarrierConnection = function(roomName, sourceId, targetId, resourceType, condition, conditionTarget) {
    const memoryObj = Memory.TangYuanLonelyCat;
    if (!memoryObj || !memoryObj.Carrier || !memoryObj.Carrier[roomName] || !memoryObj.Carrier[roomName].Connections) {
        console.log('❌ ' + roomName + ' 没有搬运连接');
        return false;
    }
    
    const connections = memoryObj.Carrier[roomName].Connections;
    
    let removed = false;
    const newConnections = [];
    
    for (let i = 0; i < connections.length; i++) {
        const conn = connections[i];
        let match = conn.sourceId === sourceId && conn.targetId === targetId;
        if (resourceType !== undefined) {
            match = match && conn.resourceType === resourceType;
        }
        if (condition !== undefined) {
            match = match && conn.condition === condition;
        }
        if (conditionTarget !== undefined) {
            match = match && conn.conditionTarget === conditionTarget;
        }
        
        if (match) {
            const targetStr = conn.conditionTarget !== undefined ? (conn.conditionTarget ? '目标' : '源') : '目标(默认)';
            console.log('✅ 删除连接: ' + roomName + ' 从 ' + sourceId + ' 到 ' + targetId + ' (' + conn.resourceType + ') 条件: ' + (conn.condition || '无') + ' 作用: ' + targetStr);
            removed = true;
        } else {
            newConnections.push(conn);
        }
    }
    
    if (removed) {
        memoryObj.Carrier[roomName].Connections = newConnections;
        return true;
    }
    
    console.log('❌ 连接不存在: ' + roomName + ' 从 ' + sourceId + ' 到 ' + targetId + (resourceType ? ' (' + resourceType + ')' : '') + (condition ? ' 条件: ' + condition : '') + (conditionTarget !== undefined ? ' 作用: ' + (conditionTarget ? '目标' : '源') : ''));
    return false;
};

// 全局函数：清空房间所有搬运连接
global.clearCarrierConnections = function(roomName) {
    const memoryObj = Memory.TangYuanLonelyCat;
    if (memoryObj && memoryObj.Carrier && memoryObj.Carrier[roomName]) {
        memoryObj.Carrier[roomName].Connections = [];
        console.log('✅ 已清除 ' + roomName + ' 的所有搬运连接');
        return true;
    }
    return false;
};

// 全局函数：清理无效连接（自动清理）
global.cleanupCarrierConnections = function() {
    const memoryObj = Memory.TangYuanLonelyCat;
    if (!memoryObj || !memoryObj.Carrier) return;
    
    let totalRemoved = 0;
    
    for (const roomName in memoryObj.Carrier) {
        const connections = memoryObj.Carrier[roomName].Connections;
        if (!connections) continue;
        
        const validConnections = [];
        
        for (let i = 0; i < connections.length; i++) {
            const conn = connections[i];
            const source = Game.getObjectById(conn.sourceId);
            const target = Game.getObjectById(conn.targetId);
            if (source && target && source.store && target.store) {
                validConnections.push(conn);
            }
        }
        
        if (validConnections.length < connections.length) {
            const removed = connections.length - validConnections.length;
            memoryObj.Carrier[roomName].Connections = validConnections;
            totalRemoved += removed;
            console.log('🧹 ' + roomName + ': 清理了' + removed + '个无效连接');
        }
    }
    
    if (totalRemoved > 0) {
        console.log('✅ 总计清理了' + totalRemoved + '个无效连接');
    }
    return totalRemoved;
};

module.exports = roleCarrier;