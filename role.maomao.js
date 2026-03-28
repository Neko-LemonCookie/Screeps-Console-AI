var maomao = {
    // 初始化内存
    initMemory: function() {
        if (!Memory.TangYuanLonelyCat) {
            Memory.TangYuanLonelyCat = {};
        }
        if (!Memory.TangYuanLonelyCat.Maomao) {
            Memory.TangYuanLonelyCat.Maomao = {};
        }
        if (!Memory.TangYuanLonelyCat.Maomao.rooms) {
            Memory.TangYuanLonelyCat.Maomao.rooms = {};
        }
    },

    // 初始化 creep 内存
    initCreepMemory: function(creep) {
        if (!creep.memory.task) {
            creep.memory.task = 'idle';
        }
        if (!creep.memory.targetId) {
            creep.memory.targetId = null;
        }
        if (creep.memory.transferring === undefined) {
            creep.memory.transferring = false;
        }
        if (creep.memory.transferringMineral === undefined) {
            creep.memory.transferringMineral = false;
        }
    },

    // 检查背包中是否有非能量资源
    hasNonEnergyResources: function(creep) {
        for (var resourceType in creep.store) {
            if (resourceType !== RESOURCE_ENERGY && creep.store[resourceType] > 0) {
                return true;
            }
        }
        return false;
    },

    // 清理背包中的矿物到存储
    depositNonEnergyResources: function(creep) {
        var room = creep.room;
        var storage = room.storage;
        
        if (!storage || storage.store.getFreeCapacity() < 50) {
            return false;
        }
        
        for (var resourceType in creep.store) {
            if (resourceType !== RESOURCE_ENERGY && creep.store[resourceType] > 0) {
                creep.say('清矿物');
                
                if (creep.transfer(storage, resourceType) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, { 
                        visualizePathStyle: { stroke: '#ff00ff' },
                        reusePath: 5
                    });
                }
                return true;
            }
        }
        return false;
    },

    // 检查并触发crazy模式 - 使用正确的API
    checkAndTriggerCrazyMode: function(room) {
        var roomName = room.name;
        
        // 初始化房间内存
        if (!Memory.TangYuanLonelyCat.Maomao.rooms[roomName]) {
            Memory.TangYuanLonelyCat.Maomao.rooms[roomName] = {
                crazyMode: false,
                crazyStartTime: null,
                lastEnergyCheck: Game.time
            };
        }
        
        var roomMemory = Memory.TangYuanLonelyCat.Maomao.rooms[roomName];
        
        // 每10tick检查一次能量状态
        if (!roomMemory.lastEnergyCheck || Game.time - roomMemory.lastEnergyCheck >= 10) {
            // 使用Screeps API：room.energyAvailable 获取spawn和扩展中的总能量
            var availableEnergy = room.energyAvailable;
            
            // 如果可用能量 <= 50 且未开启crazy模式，触发crazy
            if (availableEnergy <= 50 && !roomMemory.crazyMode) {
                console.log(`[Maomao] 房间 ${roomName} spawn+扩展能量极低 (${availableEnergy})，触发crazy模式！`);
                if (typeof crazy === 'function') {
                    crazy(roomName);
                }
                roomMemory.crazyMode = true;
                roomMemory.crazyStartTime = Game.time;
            }
            
            // 检查是否需要结束crazy模式（400tick后）
            if (roomMemory.crazyMode && roomMemory.crazyStartTime && 
                Game.time - roomMemory.crazyStartTime >= 400) {
                console.log(`[Maomao] 房间 ${roomName} crazy模式已持续400tick，结束crazy模式`);
                if (typeof uncrazy === 'function') {
                    uncrazy(roomName);
                }
                roomMemory.crazyMode = false;
                roomMemory.crazyStartTime = null;
            }
            
            roomMemory.lastEnergyCheck = Game.time;
        }
        
        return roomMemory.crazyMode;
    },

    // 更新房间能量阈值 - 使用正确的API
    updateEnergyThreshold: function(room) {
        if (!room.memory.energyThreshold) {
            room.memory.energyThreshold = 100000;
        }
        
        // 每 100 tick 更新一次
        if (!room.memory.thresholdLastUpdate || Game.time - room.memory.thresholdLastUpdate > 100) {
            // 使用Screeps API：room.energyAvailable 和 room.energyCapacityAvailable
            var availableEnergy = room.energyAvailable;
            var capacity = room.energyCapacityAvailable;
            
            // 动态调整阈值
            var fillRatio = capacity > 0 ? availableEnergy / capacity : 0;
            
            if (fillRatio >= 0.95) {
                room.memory.energyThreshold = Math.min(room.memory.energyThreshold + 5000, 500000);
            } else if (fillRatio < 0.3) {
                room.memory.energyThreshold = Math.max(room.memory.energyThreshold - 10000, 50000);
            }
            
            room.memory.energyThreshold = Math.max(50000, Math.min(room.memory.energyThreshold, 300000));
            
            room.memory.thresholdLastUpdate = Game.time;
        }
    },

    // 检查 spawn 和扩展是否需要能量 - 使用正确的API
    needEnergyInSpawnsAndExtensions: function(room) {
        // 使用Screeps API：如果当前能量小于最大容量，就需要充能
        return room.energyAvailable < room.energyCapacityAvailable;
    },

    // 检查是否应该填充 spawn
    shouldFillSpawns: function(room) {
        var storage = room.storage;
        var currentThreshold = room.memory.energyThreshold || 100000;
        
        // 检查当前房间是否处于crazy模式
        var roomMemory = Memory.TangYuanLonelyCat.Maomao.rooms[room.name];
        if (roomMemory && roomMemory.crazyMode) {
            return storage && storage.store[RESOURCE_ENERGY] > 5000;
        }
        
        // 紧急模式
        if (Memory.emergencyMode && Memory.emergencyMode.active) {
            return storage && storage.store[RESOURCE_ENERGY] > 1000;
        }
        
        // 非紧急模式
        if (!storage) return false;
        
        return storage.store[RESOURCE_ENERGY] >= currentThreshold;
    },

    // 获取有矿物（非能量）的来源
    getMineralSource: function(creep) {
        var room = creep.room;
        
        // 先检查容器中的矿物
        var containers = room.find(FIND_STRUCTURES, {
            filter: function(structure) {
                if (structure.structureType !== STRUCTURE_CONTAINER) return false;
                for (var resourceType in structure.store) {
                    if (resourceType !== RESOURCE_ENERGY && structure.store[resourceType] > 0) {
                        return true;
                    }
                }
                return false;
            }
        });
        
        if (containers.length > 0) {
            return creep.pos.findClosestByRange(containers);
        }
        
        // 检查墓碑中的矿物
        var tombstones = room.find(FIND_TOMBSTONES, {
            filter: function(tombstone) {
                for (var resourceType in tombstone.store) {
                    if (resourceType !== RESOURCE_ENERGY && tombstone.store[resourceType] > 0) {
                        return true;
                    }
                }
                return false;
            }
        });
        
        if (tombstones.length > 0) {
            return creep.pos.findClosestByRange(tombstones);
        }
        
        return null;
    },

    // 执行矿物收集任务
    executeMineralCollection: function(creep) {
        var room = creep.room;
        var storage = room.storage;
        
        if (!storage || storage.store.getFreeCapacity() < 50) {
            creep.say('存储满');
            return false;
        }
        
        if (creep.store.getUsedCapacity() === 0) {
            var source = this.getMineralSource(creep);
            if (source) {
                for (var resourceType in source.store) {
                    if (resourceType !== RESOURCE_ENERGY && source.store[resourceType] > 0) {
                        creep.memory.transferringMineral = false;
                        creep.say('取矿');
                        
                        if (creep.withdraw(source, resourceType) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(source, { 
                                visualizePathStyle: { stroke: '#aa00ff' },
                                reusePath: 5
                            });
                        }
                        return true;
                    }
                }
            }
            creep.say('无矿');
            return false;
        }
        
        if (storage) {
            for (var resourceType in creep.store) {
                if (resourceType !== RESOURCE_ENERGY && creep.store[resourceType] > 0) {
                    creep.memory.transferringMineral = true;
                    creep.say('存矿');
                    
                    if (creep.transfer(storage, resourceType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(storage, { 
                            visualizePathStyle: { stroke: '#00ff00' },
                            reusePath: 5
                        });
                    }
                    return true;
                }
            }
        }
        
        return false;
    },

    // 执行第一优先级：填充 spawn 和扩展
    executePriorityOne: function(creep) {
        var room = creep.room;
        
        // 检查背包中是否有非能量资源，如果有先清理
        if (this.hasNonEnergyResources(creep)) {
            if (this.depositNonEnergyResources(creep)) {
                return true;
            }
        }
        
        // 检查是否需要填充 - 使用API
        if (!this.needEnergyInSpawnsAndExtensions(room)) {
            creep.say('满');
            return false;
        }
        
        // 检查是否应该填充
        if (!this.shouldFillSpawns(room)) {
            creep.say('能低');
            return false;
        }
        
        var storage = room.storage;
        
        // 如果 creep 是空载状态
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            // 从存储获取能量
            if (storage && storage.store[RESOURCE_ENERGY] > 100) {
                creep.memory.transferring = false;
                creep.say('取能');
                
                if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, { 
                        visualizePathStyle: { stroke: '#ffaa00' },
                        reusePath: 5
                    });
                }
                return true;
            } else {
                creep.say('存储空');
                return false;
            }
        }
        
        // 如果 creep 有能量，填满 spawn 和扩展
        var targets = room.find(FIND_STRUCTURES, {
            filter: function(structure) {
                return (structure.structureType === STRUCTURE_SPAWN ||
                       structure.structureType === STRUCTURE_EXTENSION) &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        if (targets.length > 0) {
            var target = creep.pos.findClosestByRange(targets);
            if (target) {
                creep.memory.transferring = true;
                creep.say('充能');
                
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { 
                        visualizePathStyle: { stroke: '#00ff00' },
                        reusePath: 5
                    });
                }
                return true;
            }
        }
        
        creep.say('目标满');
        return false;
    },

    // 获取可用的能量源 - 简化版：只看最近的容器和LINK
    getAvailableEnergySource: function(creep) {
        var room = creep.room;
        var storage = room.storage;
        
        // 检查存储是否需要能量
        var currentThreshold = room.memory.energyThreshold || 100000;
        var needsEnergy = !storage || storage.store[RESOURCE_ENERGY] < currentThreshold;
        
        // 紧急模式或crazy模式下总是需要能量
        var roomMemory = Memory.TangYuanLonelyCat.Maomao.rooms[room.name];
        if ((Memory.emergencyMode && Memory.emergencyMode.active) || 
            (roomMemory && roomMemory.crazyMode)) {
            needsEnergy = true;
        }
        
        if (!needsEnergy) {
            return null;
        }
        
        // 1. 先找最近的容器（有能量就行）
        var containers = room.find(FIND_STRUCTURES, {
            filter: function(structure) {
                return structure.structureType === STRUCTURE_CONTAINER &&
                       structure.store[RESOURCE_ENERGY] > 0;
            }
        });
        
        if (containers.length > 0) {
            var closestContainer = creep.pos.findClosestByRange(containers);
            if (closestContainer) {
                return closestContainer;
            }
        }
        
        // 2. 再找最近的LINK（有能量就行）
        var links = room.find(FIND_STRUCTURES, {
            filter: function(structure) {
                return structure.structureType === STRUCTURE_LINK &&
                       structure.store[RESOURCE_ENERGY] > 0;
            }
        });
        
        if (links.length > 0) {
            var closestLink = creep.pos.findClosestByRange(links);
            if (closestLink) {
                return closestLink;
            }
        }
        
        // 3. 找墓碑
        var tombstones = room.find(FIND_TOMBSTONES, {
            filter: function(tombstone) {
                return tombstone.store[RESOURCE_ENERGY] > 0;
            }
        });
        
        if (tombstones.length > 0) {
            var closestTombstone = creep.pos.findClosestByRange(tombstones);
            if (closestTombstone) {
                return closestTombstone;
            }
        }
        
        // 4. 找地面能量
        var droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
            filter: function(resource) {
                return resource.resourceType === RESOURCE_ENERGY && resource.amount > 0;
            }
        });
        
        if (droppedEnergy.length > 0) {
            var closestEnergy = creep.pos.findClosestByRange(droppedEnergy);
            if (closestEnergy) {
                return closestEnergy;
            }
        }
        
        return null;
    },

    // 执行能量收集任务 - 简化版
    executeEnergyCollection: function(creep) {
        var room = creep.room;
        var storage = room.storage;
        
        // 检查背包中是否有非能量资源，如果有先清理
        if (this.hasNonEnergyResources(creep)) {
            if (this.depositNonEnergyResources(creep)) {
                return true;
            }
        }
        
        // 检查存储是否有空间
        if (storage && storage.store.getFreeCapacity() < 50) {
            creep.say('存储满');
            return false;
        }
        
        // 如果 creep 是空载状态
        if (creep.store.getUsedCapacity() === 0) {
            var source = this.getAvailableEnergySource(creep);
            if (source) {
                creep.memory.transferring = false;
                creep.say('收能');
                
                if (source instanceof Tombstone) {
                    if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, { 
                            visualizePathStyle: { stroke: '#880088' },
                            reusePath: 5
                        });
                    }
                } else if (source instanceof Structure) {
                    if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, { 
                            visualizePathStyle: { stroke: '#ffaa00' },
                            reusePath: 5
                        });
                    }
                } else if (source instanceof Resource) {
                    if (creep.pickup(source) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, { 
                            visualizePathStyle: { stroke: '#ffff00' },
                            reusePath: 5
                        });
                    }
                }
                return true;
            } else {
                creep.say('无源');
                return false;
            }
        }
        
        // 如果 creep 有能量，存入存储
        if (storage && creep.store[RESOURCE_ENERGY] > 0) {
            creep.memory.transferring = true;
            creep.say('存能');
            
            if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { 
                    visualizePathStyle: { stroke: '#00ff00' },
                    reusePath: 5
                });
            }
            return true;
        }
        
        return false;
    },

    // 检查是否有需要收集的矿物
    hasMineralsToCollect: function(room) {
        var containers = room.find(FIND_STRUCTURES, {
            filter: function(structure) {
                if (structure.structureType !== STRUCTURE_CONTAINER) return false;
                for (var resourceType in structure.store) {
                    if (resourceType !== RESOURCE_ENERGY && structure.store[resourceType] > 0) {
                        return true;
                    }
                }
                return false;
            }
        });
        
        if (containers.length > 0) return true;
        
        var tombstones = room.find(FIND_TOMBSTONES, {
            filter: function(tombstone) {
                for (var resourceType in tombstone.store) {
                    if (resourceType !== RESOURCE_ENERGY && tombstone.store[resourceType] > 0) {
                        return true;
                    }
                }
                return false;
            }
        });
        
        return tombstones.length > 0;
    },

    // 主运行函数
    run: function(creep) {
        // 初始化内存
        this.initMemory();
        this.initCreepMemory(creep);
        
        var room = creep.room;
        var roomName = room.name;
        
        // 检查并触发crazy模式
        var isCrazyMode = this.checkAndTriggerCrazyMode(room);
        
        // 更新房间能量阈值
        this.updateEnergyThreshold(room);
        
        // 显示状态信息
        if (creep.ticksToLive % 20 === 0) {
            var threshold = room.memory.energyThreshold || 100000;
            var storageEnergy = room.storage ? room.storage.store[RESOURCE_ENERGY] : 0;
            var task = creep.memory.task || 'idle';
            var status = isCrazyMode ? '狂!' : '';
            creep.say(status + task.substring(0, 4 - status.length));
        }
        
        // 清理无效的内存
        if (creep.memory.targetId) {
            var target = Game.getObjectById(creep.memory.targetId);
            if (!target) {
                creep.memory.targetId = null;
            }
        }
        
        // 第一优先级：填充 spawn 和扩展
        if (this.executePriorityOne(creep)) {
            creep.memory.task = 'priority_one';
            return;
        }
        
        // 第二优先级：收集矿物
        if (this.hasMineralsToCollect(room) && this.executeMineralCollection(creep)) {
            creep.memory.task = 'mineral_collection';
            return;
        }
        
        // 第三优先级：收集能量到存储
        if (this.executeEnergyCollection(creep)) {
            creep.memory.task = 'energy_collection';
            return;
        }
        
        // 所有任务都不需要执行
        creep.memory.task = 'idle';
        
        // 如果有非能量资源但无事可做，存回存储
        if (this.hasNonEnergyResources(creep)) {
            if (this.depositNonEnergyResources(creep)) {
                creep.memory.task = 'cleaning';
                return;
            }
        }
        
        // 如果有能量但无事可做，存回存储
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            var storage = room.storage;
            if (storage) {
                creep.say('还存');
                if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, { 
                        visualizePathStyle: { stroke: '#00ff00' },
                        reusePath: 5
                    });
                }
                creep.memory.task = 'returning_energy';
                return;
            }
        } else if (creep.store.getUsedCapacity() > 0) {
            // 如果有矿物但无事可做，也存回存储
            var storage = room.storage;
            if (storage) {
                creep.say('存杂');
                if (creep.transfer(storage, Object.keys(creep.store)[0]) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, { 
                        visualizePathStyle: { stroke: '#00ff00' },
                        reusePath: 5
                    });
                }
                creep.memory.task = 'returning_minerals';
                return;
            }
        } else {
            creep.say('待命');
            // 待机行为
            if (creep.ticksToLive % 20 === 0) {
                // 移动到房间中心附近
                var center = new RoomPosition(25, 25, roomName);
                creep.moveTo(center, { 
                    visualizePathStyle: { stroke: '#888888' },
                    reusePath: 10
                });
            }
        }
    },
};

module.exports = maomao;