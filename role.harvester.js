// role.harvester.js - 智能采集者（保底->LINK->容器->基地->仓库）带紧急模式
/**启动紧急模式
   Memory.emergencyMode = {
    active: true,
    startTime: Game.time
};
console.log("紧急模式已激活，持续400tick");
**/
/**手动关闭紧急模式
  Memory.emergencyMode.active = false;
console.log("紧急模式已手动关闭");
**/
var roleHarvester = {
    /** @param {Creep} creep **/
    run: function(creep) {
        // ========== 紧急模式检测 ==========
        this._checkEmergencyMode();
        
        // ========== 紧急模式特殊处理 ==========
        if (Memory.emergencyMode && Memory.emergencyMode.active) {
            return this._runEmergencyMode(creep);
        }
        
        // ========== 正常模式逻辑 ==========
        return this._runNormalMode(creep);
    },
    
    /** 紧急模式运行逻辑 - 每tick都运行，更高效 */
    _runEmergencyMode: function(creep) {
        // 紧急模式下使用更激进的移动选项
        var emergencyMoveOpts = {
            visualizePathStyle: { stroke: '#ff0000', lineStyle: 'dashed' },
            reusePath: 0, // 不重用路径，每tick都重新计算最优路径
            maxOps: 2000, // 更高的最大操作数
            range: 1,
            ignoreCreeps: false, // 不忽略其他creep
            serializeMemory: false, // 不序列化内存，减少CPU
            ignoreDestructibleStructures: false, // 忽略可破坏结构
            maxRooms: 1, // 只在本房间内
            plainCost: 2,
            swampCost: 10
        };
        
        // 紧急模式下每tick都检查状态变化
        if (creep.memory.harvesting && creep.store.getFreeCapacity() === 0) {
            creep.memory.harvesting = false;
            creep.say('🚨存能');
        }
        if (!creep.memory.harvesting && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.harvesting = true;
            creep.say('🚨采能');
        }
        
        // 采集状态
        if (creep.memory.harvesting) {
            this._harvestEnergyEmergency(creep, emergencyMoveOpts);
        } else {
            this._emergencyDeposit(creep, emergencyMoveOpts);
        }
        
        // 紧急模式下显示特殊路径
        creep.room.visual.circle(creep.pos, {
            radius: 0.5,
            fill: 'transparent',
            stroke: '#ff0000',
            strokeWidth: 0.1,
            opacity: 0.8
        });
    },
    
    /** 正常模式运行逻辑 */
    _runNormalMode: function(creep) {
        var normalMoveOpts = {
            visualizePathStyle: { stroke: '#ffaa00' },
            reusePath: 5,
            maxOps: 400,
            range: 1,
            serializeMemory: true
        };
        
        // ========== 状态管理 ==========
        if (creep.memory.harvesting && creep.store.getFreeCapacity() === 0) {
            creep.memory.harvesting = false;
            creep.say('📦存能');
        }
        if (!creep.memory.harvesting && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.harvesting = true;
            creep.say('⚡采能');
        }
        
        // ========== 采集状态 ==========
        if (creep.memory.harvesting) {
            this._harvestEnergy(creep, normalMoveOpts);
        } 
        // ========== 存储状态 ==========
        else {
            this._depositEnergy(creep, normalMoveOpts);
        }
    },
    
    /** 检查紧急模式状态 */
    _checkEmergencyMode: function() {
        if (Memory.emergencyMode && Memory.emergencyMode.active) {
            // 检查是否超时
            if (Game.time >= Memory.emergencyMode.startTime + 400) {
                Memory.emergencyMode.active = false;
                console.log('[Harvester] 紧急模式已自动关闭，持续了400tick');
            }
        }
    },
    
    /** 紧急模式存储逻辑：只供Spawn和Extension，满后才考虑容器 */
    _emergencyDeposit: function(creep, moveOpts) {
        creep.say('🚨紧急');
        
        // 1. 先找Spawn或Extension
        var spawnExtTarget = this._findSpawnOrExtension(creep);
        if (spawnExtTarget) {
            var result = creep.transfer(spawnExtTarget, RESOURCE_ENERGY);
            if (result === OK) {
                return;
            } else if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(spawnExtTarget, moveOpts);
                return;
            } else if (result === ERR_FULL) {
                // 目标已满，继续向下寻找
            }
        }
        
        // 2. Spawn和Extension都满了，找容器
        var containerTarget = this._findAnyContainerToFill(creep);
        if (containerTarget) {
            var result = creep.transfer(containerTarget, RESOURCE_ENERGY);
            if (result === OK) {
                return;
            } else if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(containerTarget, moveOpts);
                return;
            } else if (result === ERR_FULL) {
                // 容器也满了
            }
        }
        
        // 3. 容器也满了，找Storage
        var storageTarget = this._findStorage(creep);
        if (storageTarget) {
            var result = creep.transfer(storageTarget, RESOURCE_ENERGY);
            if (result === OK) {
                return;
            } else if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(storageTarget, moveOpts);
                return;
            }
        }
        
        // 4. 所有目标都满了，去升级控制器
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, moveOpts);
        }
    },
    
    /** 紧急模式采集能量 - 更高效 */
    _harvestEnergyEmergency: function(creep, moveOpts) {
        // 紧急模式下每tick都寻找最优能量源
        if (creep.memory.sourceId) {
            var source = Game.getObjectById(creep.memory.sourceId);
            if (source && source.energy > 0) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, moveOpts);
                }
                return;
            } else {
                // 能量源耗尽，重新寻找
                delete creep.memory.sourceId;
            }
        }
        
        // 寻找最近的活跃能量源，使用更精确的路径
        var sources = creep.room.find(FIND_SOURCES_ACTIVE);
        if (sources.length > 0) {
            // 紧急模式下寻找路径最短的能量源
            var closestSource = null;
            var shortestPath = Infinity;
            
            for (var i = 0; i < sources.length; i++) {
                var source = sources[i];
                var path = creep.pos.findPathTo(source, {
                    ignoreCreeps: false,
                    maxOps: 1000
                });
                if (path && path.length < shortestPath) {
                    shortestPath = path.length;
                    closestSource = source;
                }
            }
            
            if (closestSource) {
                creep.memory.sourceId = closestSource.id;
                if (creep.harvest(closestSource) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(closestSource, moveOpts);
                }
            }
        } else {
            // 没有活跃能量源，随便找一个
            var allSources = creep.room.find(FIND_SOURCES);
            if (allSources.length > 0) {
                var source = allSources[0];
                creep.memory.sourceId = source.id;
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, moveOpts);
                }
            }
        }
    },
    
    /** 正常模式采集能量 */
    _harvestEnergy: function(creep, moveOpts) {
        // 如果有指定的sourceId，继续采集它
        if (creep.memory.sourceId) {
            var source = Game.getObjectById(creep.memory.sourceId);
            if (source && source.energy > 0) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, moveOpts);
                }
                return;
            }
        }
        
        // 寻找最近的活跃能量源
        var sources = creep.room.find(FIND_SOURCES_ACTIVE);
        if (sources.length > 0) {
            var source = creep.pos.findClosestByPath(sources);
            if (source) {
                creep.memory.sourceId = source.id;
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, moveOpts);
                }
            }
        } else {
            // 没有活跃能量源，随便找一个
            var allSources = creep.room.find(FIND_SOURCES);
            if (allSources.length > 0) {
                var source = creep.pos.findClosestByPath(allSources);
                if (source) {
                    creep.memory.sourceId = source.id;
                    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, moveOpts);
                    }
                }
            }
        }
    },
    
    /** 存储能量（智能优先级：保底 -> LINK -> 容器 -> 基地 -> 仓库） */
    _depositEnergy: function(creep, moveOpts) {
        // 定义安全能量储备阈值（略高于一个基础Creep的成本）
        var SAFE_ENERGY_RESERVE = 2400;

        // 1. 计算Spawn和Extension中现有的能量总和
        var spawnsAndExtensions = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) {
                return s.structureType === STRUCTURE_SPAWN || 
                       s.structureType === STRUCTURE_EXTENSION;
            }
        });
        
        var currentEnergyInBase = 0;
        for (var i = 0; i < spawnsAndExtensions.length; i++) {
            var struct = spawnsAndExtensions[i];
            currentEnergyInBase += struct.store[RESOURCE_ENERGY] || 0;
        }

        // 2. 决策逻辑
        // 情况A：如果基地现有能量还没达到"安全线"
        if (currentEnergyInBase < SAFE_ENERGY_RESERVE) {
            creep.say('🔋保底');
            var spawnExtTarget = this._findSpawnOrExtension(creep);
            if (spawnExtTarget) {
                this._transferEnergy(creep, spawnExtTarget, moveOpts);
                return;
            }
        }

        // 情况B："保底能量"已满足，先填充LINK！
        var linkTarget = this._findLinkToFill(creep);
        if (linkTarget) {
            creep.say('🔗LINK');
            this._transferEnergy(creep, linkTarget, moveOpts);
            return;
        }

        // 情况C：没有需要填充的LINK，全力填充容器！
        // 每100tick更新一次容器状态缓存
        if (!creep.room.memory.lastContainerCheck || 
            Game.time - creep.room.memory.lastContainerCheck > 100) {
            this._updateRoomContainerStatus(creep.room);
        }
        
        if (!creep.room.memory.containersSatisfied) {
            var containerTarget = this._findContainerToFill(creep);
            if (containerTarget) {
                creep.say('🚚容器');
                this._transferEnergy(creep, containerTarget, moveOpts);
                return;
            }
        }

        // 情况D：容器也满足了，回来填满Spawn和Extension的剩余空间
        var spawnExtTargetFinal = this._findSpawnOrExtension(creep);
        if (spawnExtTargetFinal) {
            creep.say('🏠基地');
            this._transferEnergy(creep, spawnExtTargetFinal, moveOpts);
            return;
        }

        // 情况E：所有基地建筑都满了，最后存入Storage
        var storageTarget = this._findStorage(creep);
        if (storageTarget) {
            creep.say('🗄️存库');
            this._transferEnergy(creep, storageTarget, moveOpts);
            return;
        }

        // 情况F：所有目标都满了，去升级控制器
        creep.say('⚡满');
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, moveOpts);
        }
    },
    
    /** 寻找需要填充的LINK */
    _findLinkToFill: function(creep) {
        // 查找需要能量的LINK
        var links = creep.room.find(FIND_STRUCTURES, {
            filter: function(structure) {
                return structure.structureType === STRUCTURE_LINK &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        if (links.length > 0) {
            // 选择最近的LINK（减少移动距离）
            return creep.pos.findClosestByPath(links);
        }
        
        return null;
    },
    
    /** 更新房间容器状态 */
    _updateRoomContainerStatus: function(room) {
        var containers = room.find(FIND_STRUCTURES, {
            filter: function(s) {
                return s.structureType === STRUCTURE_CONTAINER;
            }
        });
        
        if (containers.length === 0) {
            room.memory.containersSatisfied = true;
            room.memory.lastContainerCheck = Game.time;
            return;
        }
        
        var hasEnoughEnergy = false;
        for (var i = 0; i < containers.length; i++) {
            var container = containers[i];
            var capacity = container.store.getCapacity(RESOURCE_ENERGY);
            var energy = container.store[RESOURCE_ENERGY] || 0;
            var percentage = capacity > 0 ? energy / capacity : 0;
            
            if (percentage >= 0.2) {
                hasEnoughEnergy = true;
                break;
            }
        }
        
        room.memory.containersSatisfied = hasEnoughEnergy;
        room.memory.lastContainerCheck = Game.time;
    },
    
    /** 寻找需要填充的容器 - 改为寻找最近的未达标容器 */
    _findContainerToFill: function(creep) {
        var containers = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) {
                if (s.structureType !== STRUCTURE_CONTAINER) return false;
                var capacity = s.store.getCapacity(RESOURCE_ENERGY);
                if (capacity === 0) return false;
                var percentage = (s.store[RESOURCE_ENERGY] || 0) / capacity;
                return percentage < 0.2;
            }
        });
        
        if (containers.length === 0) return null;
        
        return creep.pos.findClosestByPath(containers);
    },
    
    /** 寻找任何未满的容器（紧急模式用） */
    _findAnyContainerToFill: function(creep) {
        var containers = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) {
                return s.structureType === STRUCTURE_CONTAINER &&
                       s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        if (containers.length === 0) return null;
        
        return creep.pos.findClosestByPath(containers);
    },
    
    /** 寻找Spawn或Extension */
    _findSpawnOrExtension: function(creep) {
        var targets = creep.room.find(FIND_STRUCTURES, {
            filter: function(structure) {
                return (structure.structureType === STRUCTURE_SPAWN ||
                        structure.structureType === STRUCTURE_EXTENSION) &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        if (targets.length === 0) return null;
        
        var spawns = targets.filter(function(s) {
            return s.structureType === STRUCTURE_SPAWN;
        });
        
        if (spawns.length > 0) {
            return creep.pos.findClosestByPath(spawns);
        }
        
        return creep.pos.findClosestByPath(targets);
    },
    
    /** 寻找Storage */
    _findStorage: function(creep) {
        var storages = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) {
                return s.structureType === STRUCTURE_STORAGE &&
                       s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        if (storages.length === 0) return null;
        
        return creep.pos.findClosestByPath(storages);
    },
    
    /** 转移能量到目标 */
    _transferEnergy: function(creep, target, moveOpts) {
        var result = creep.transfer(target, RESOURCE_ENERGY);
        
        if (result === OK) {
            if (target.structureType === STRUCTURE_CONTAINER) {
                var capacity = target.store.getCapacity(RESOURCE_ENERGY);
                var energy = target.store[RESOURCE_ENERGY] || 0;
                var percentage = capacity > 0 ? energy / capacity : 0;
                
                if (percentage >= 0.2) {
                    creep.room.memory.containersSatisfied = true;
                }
            }
            return true;
        } else if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, moveOpts);
            return true;
        } else if (result === ERR_FULL) {
            if (target.structureType === STRUCTURE_CONTAINER) {
                creep.room.memory.containersSatisfied = true;
            }
            return false;
        }
        
        return true;
    }
};

module.exports = roleHarvester;