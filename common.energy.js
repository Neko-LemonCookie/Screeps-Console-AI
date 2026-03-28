// common.energy.js - 能量管理通用模块

const energyManager = {
    /**
     * 从Link获取能量
     * @param {Creep} creep - creep对象
     * @param {Object} moveOpts - 移动选项
     * @returns {boolean} 是否成功获取能量
     */
    getEnergyFromLink: function(creep, moveOpts) {
        const links = creep.room.find(FIND_MY_STRUCTURES, {
            filter: function(s) {
                return s.structureType === STRUCTURE_LINK &&
                       s.store[RESOURCE_ENERGY] > 0;
            }
        });
        
        // 筛选5格范围内的LINK
        const nearbyLinks = [];
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            if (creep.pos.getRangeTo(link) <= 5) {
                nearbyLinks.push(link);
            }
        }
        
        if (nearbyLinks.length === 0) return false;
        
        // 找到最近的LINK
        var closestLink = null;
        var closestDistance = Infinity;
        for (var i = 0; i < nearbyLinks.length; i++) {
            var link = nearbyLinks[i];
            var distance = creep.pos.getRangeTo(link);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestLink = link;
            }
        }
        
        if (!closestLink) return false;
        
        const result = creep.withdraw(closestLink, RESOURCE_ENERGY);
        if (result === OK) {
            return true;
        } else if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(closestLink, Object.assign({}, moveOpts, {
                ignoreCreeps: false,
                reusePath: 10,
                maxOps: 4000
            }));
            return true;
        }
        
        return false;
    },
    
    /**
     * 从Storage获取能量
     * @param {Creep} creep - creep对象
     * @param {Object} moveOpts - 移动选项
     * @returns {boolean} 是否成功获取能量
     */
    getEnergyFromStorage: function(creep, moveOpts) {
        const storage = creep.room.storage;
        if (!storage || storage.store[RESOURCE_ENERGY] <= 50) {
            return false;
        }
        
        const result = creep.withdraw(storage, RESOURCE_ENERGY);
        if (result === OK) {
            return true;
        } else if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(storage, Object.assign({}, moveOpts, {
                ignoreCreeps: false,
                reusePath: 10,
                maxOps: 4000
            }));
            return true;
        }
        
        return false;
    },
    
    /**
     * 从Container获取能量
     * @param {Creep} creep - creep对象
     * @param {Object} moveOpts - 移动选项
     * @returns {boolean} 是否成功获取能量
     */
    getEnergyFromContainer: function(creep, moveOpts) {
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) {
                return s.structureType === STRUCTURE_CONTAINER &&
                       s.store[RESOURCE_ENERGY] > 50;
            }
        });
        
        if (containers.length === 0) return false;
        
        // 找到最近的容器
        var closestContainer = null;
        var closestDistance = Infinity;
        for (var i = 0; i < containers.length; i++) {
            var container = containers[i];
            var distance = creep.pos.getRangeTo(container);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestContainer = container;
            }
        }
        
        if (!closestContainer) return false;
        
        const result = creep.withdraw(closestContainer, RESOURCE_ENERGY);
        if (result === OK) {
            return true;
        } else if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(closestContainer, Object.assign({}, moveOpts, {
                ignoreCreeps: false,
                reusePath: 10,
                maxOps: 4000
            }));
            return true;
        }
        
        return false;
    },
    
    /**
     * 从挖矿容器获取能量
     * @param {Creep} creep - creep对象
     * @param {Object} moveOpts - 移动选项
     * @returns {boolean} 是否成功获取能量
     */
    getEnergyFromMinerContainer: function(creep, moveOpts) {
        // 检查是否有WORK部件
        var hasWork = false;
        for (var i = 0; i < creep.body.length; i++) {
            if (creep.body[i].type === WORK) {
                hasWork = true;
                break;
            }
        }
        if (!hasWork) {
            creep.say('❌无WORK');
            return false;
        }
        
        const sources = creep.room.find(FIND_SOURCES);
        const minerContainers = [];
        
        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];
            const containers = source.pos.findInRange(FIND_STRUCTURES, 2, {
                filter: function(s) {
                    return s.structureType === STRUCTURE_CONTAINER;
                }
            });
            
            for (var j = 0; j < containers.length; j++) {
                var container = containers[j];
                if (container.store[RESOURCE_ENERGY] > 0) {
                    minerContainers.push(container);
                }
            }
        }
        
        if (minerContainers.length === 0) return false;
        
        // 找到最近的矿工容器
        var closestContainer = null;
        var closestDistance = Infinity;
        for (var i = 0; i < minerContainers.length; i++) {
            var container = minerContainers[i];
            var distance = creep.pos.getRangeTo(container);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestContainer = container;
            }
        }
        
        if (!closestContainer) return false;
        
        const result = creep.withdraw(closestContainer, RESOURCE_ENERGY);
        if (result === OK) {
            return true;
        } else if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(closestContainer, Object.assign({}, moveOpts, {
                ignoreCreeps: false,
                reusePath: 10,
                maxOps: 4000
            }));
            return true;
        }
        
        return false;
    },
    
    /**
     * 直接挖矿
     * @param {Creep} creep - creep对象
     * @param {Object} moveOpts - 移动选项
     * @returns {boolean} 是否成功挖矿
     */
    harvestEnergy: function(creep, moveOpts) {
        // 检查是否有WORK部件
        var hasWork = false;
        for (var i = 0; i < creep.body.length; i++) {
            if (creep.body[i].type === WORK) {
                hasWork = true;
                break;
            }
        }
        if (!hasWork) {
            creep.say('❌无WORK');
            return false;
        }
        
        // 如果已锁定能量源，直接使用
        if (creep.memory.LockID === true && creep.memory.sourceId) {
            const source = Game.getObjectById(creep.memory.sourceId);
            if (source) {
                this._harvestFromSource(creep, source, moveOpts);
                return true;
            } else {
                // 能量源已不存在，重置锁定状态
                creep.memory.LockID = false;
                creep.memory.sourceId = undefined;
                creep.memory.needLockID = true;
            }
        }
        
        // 设置需要锁定能量源
        creep.memory.needLockID = true;
        
        // 获取所有活跃能量源
        const activeSources = creep.room.find(FIND_SOURCES_ACTIVE);
        if (activeSources.length === 0) {
            const allSources = creep.room.find(FIND_SOURCES);
            if (allSources.length === 0) return false;
            
            // 找到最近的能量源
            var closestSource = null;
            var closestDistance = Infinity;
            for (var i = 0; i < allSources.length; i++) {
                var source = allSources[i];
                var distance = creep.pos.getRangeTo(source);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestSource = source;
                }
            }
            
            if (closestSource) {
                this._harvestFromSource(creep, closestSource, moveOpts);
                return true;
            }
            return false;
        }
        
        // 寻找离得最近的活跃能量源
        var closestSource = null;
        var closestDistance = Infinity;
        for (var i = 0; i < activeSources.length; i++) {
            var source = activeSources[i];
            var distance = creep.pos.getRangeTo(source);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestSource = source;
            }
        }
        
        if (closestSource) {
            this._harvestFromSource(creep, closestSource, moveOpts);
            return true;
        }
        
        return false;
    },
    
    /**
     * 从指定能量源挖矿
     * @param {Creep} creep - creep对象
     * @param {Source} source - 能量源对象
     * @param {Object} moveOpts - 移动选项
     */
    _harvestFromSource: function(creep, source, moveOpts) {
        // 先尝试直接挖矿，检查是否已在开采范围内
        const harvestResult = creep.harvest(source);
        if (harvestResult === OK) {
            // 已经在开采范围内，直接挖矿
            return;
        }
        
        // 不在开采范围内，直接移动到能量源附近
        const optimizedMoveOpts = Object.assign({}, moveOpts, {
            ignoreCreeps: false,  // 忽略其他creep，避免碰撞
            reusePath: 10,        // 不重用路径，减少排队
            maxOps: 4000         // 减少路径计算复杂度
        });
        
        creep.moveTo(source, optimizedMoveOpts);
    },
    
    /**
     * 紧急模式采集能量
     * @param {Creep} creep - creep对象
     * @param {Object} moveOpts - 移动选项
     */
    harvestEnergyEmergency: function(creep, moveOpts) {
        // 紧急模式下使用更激进的移动选项
        const emergencyMoveOpts = Object.assign({}, moveOpts, {
            ignoreCreeps: false,
            ignoreDestructibleStructures: true,
            reusePath: 3,
            maxOps: 4000
        });
        
        // 如果已锁定能量源，直接使用
        if (creep.memory.LockID === true && creep.memory.sourceId) {
            const source = Game.getObjectById(creep.memory.sourceId);
            if (source && source.energy > 0) {
                this._harvestFromSource(creep, source, emergencyMoveOpts);
                return;
            } else {
                // 能量源已不存在，重置锁定状态
                creep.memory.LockID = false;
                creep.memory.sourceId = undefined;
                creep.memory.needLockID = true;
            }
        }
        
        // 设置需要锁定能量源
        creep.memory.needLockID = true;
        
        // 如果有记忆的能量源但未锁定，尝试使用
        if (creep.memory.sourceId) {
            const source = Game.getObjectById(creep.memory.sourceId);
            if (source && source.energy > 0) {
                this._harvestFromSource(creep, source, emergencyMoveOpts);
                return;
            } else {
                delete creep.memory.sourceId;
            }
        }
        
        // 寻找最近的活跃能量源
        const activeSources = creep.room.find(FIND_SOURCES_ACTIVE);
        if (activeSources.length > 0) {
            var closestSource = null;
            var closestDistance = Infinity;
            for (var i = 0; i < activeSources.length; i++) {
                var source = activeSources[i];
                var distance = creep.pos.getRangeTo(source);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestSource = source;
                }
            }
            
            if (closestSource) {
                this._harvestFromSource(creep, closestSource, emergencyMoveOpts);
            }
        } else {
            const allSources = creep.room.find(FIND_SOURCES);
            if (allSources.length > 0) {
                const source = allSources[0];
                this._harvestFromSource(creep, source, emergencyMoveOpts);
            }
        }
    },
    
    /**
     * 寻找Spawn或Extension
     * @param {Creep} creep - creep对象
     * @returns {Structure|null} 目标结构
     */
    findSpawnOrExtension: function(creep) {
        const spawnsAndExtensions = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) {
                return (s.structureType === STRUCTURE_SPAWN ||
                        s.structureType === STRUCTURE_EXTENSION) &&
                       s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        if (spawnsAndExtensions.length === 0) return null;
        
        // 优先选择最近的，使用range而不是path
        var closestTarget = null;
        var closestDistance = Infinity;
        for (var i = 0; i < spawnsAndExtensions.length; i++) {
            var target = spawnsAndExtensions[i];
            var distance = creep.pos.getRangeTo(target);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestTarget = target;
            }
        }
        
        return closestTarget;
    },
    
    /**
     * 寻找Storage
     * @param {Creep} creep - creep对象
     * @returns {Structure|null} 目标结构
     */
    findStorage: function(creep) {
        const storage = creep.room.storage;
        if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            return storage;
        }
        return null;
    },
    
    /**
     * 寻找需要填充的容器（低于20%）
     * @param {Creep} creep - creep对象
     * @returns {Structure|null} 目标容器
     */
    findContainerToFill: function(creep) {
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) {
                if (s.structureType !== STRUCTURE_CONTAINER) return false;
                const capacity = s.store.getCapacity(RESOURCE_ENERGY);
                if (capacity === 0) return false;
                const percentage = (s.store[RESOURCE_ENERGY] || 0) / capacity;
                return percentage < 0.2;
            }
        });
        
        if (containers.length === 0) return null;
        
        // 使用range而不是path
        var closestContainer = null;
        var closestDistance = Infinity;
        for (var i = 0; i < containers.length; i++) {
            var container = containers[i];
            var distance = creep.pos.getRangeTo(container);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestContainer = container;
            }
        }
        
        return closestContainer;
    },
    
    /**
     * 寻找任何未满的容器
     * @param {Creep} creep - creep对象
     * @returns {Structure|null} 目标容器
     */
    findAnyContainerToFill: function(creep) {
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) {
                return s.structureType === STRUCTURE_CONTAINER &&
                       s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        if (containers.length === 0) return null;
        
        // 使用range而不是path
        var closestContainer = null;
        var closestDistance = Infinity;
        for (var i = 0; i < containers.length; i++) {
            var container = containers[i];
            var distance = creep.pos.getRangeTo(container);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestContainer = container;
            }
        }
        
        return closestContainer;
    },
    
    /**
     * 寻找LINK结构（仅在5格范围内，超出范围直接返回false）
     * @param {Creep} creep - creep对象
     * @returns {Structure|boolean} 5格范围内的LINK结构或false
     */
    findLink: function(creep) {
        const links = creep.room.find(FIND_MY_STRUCTURES, {
            filter: function(s) {
                return s.structureType === STRUCTURE_LINK &&
                       creep.pos.getRangeTo(s) <= 5 &&
                       s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        if (links.length === 0) return false;
        
        // 检查最近的LINK是否真的在5格范围内
        var closestLink = null;
        var closestDistance = Infinity;
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var distance = creep.pos.getRangeTo(link);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestLink = link;
            }
        }
        
        if (!closestLink || creep.pos.getRangeTo(closestLink) > 5) {
            return false;
        }
        
        return closestLink;
    },
    
    /**
     * 转移能量到LINK（只在5格范围内，超出范围直接返回false）
     * @param {Creep} creep - creep对象
     * @param {Object} moveOpts - 移动选项
     * @returns {boolean} 是否成功转移或移动
     */
    transferEnergyToLink: function(creep, moveOpts) {
        const link = this.findLink(creep);
        if (link === false) return false;
        
        // 检查LINK是否未满
        const maxLinkEnergy = 800; // LINK容量是800
        const threshold = maxLinkEnergy * 0.9; // 当LINK能量低于90%时才传输，避免频繁传输
        
        // 检查LINK能量水平
        if (link.store[RESOURCE_ENERGY] >= threshold) {
            return false;
        }
        
        const result = creep.transfer(link, RESOURCE_ENERGY);
        if (result === OK) {
            return true;
        } else if (result === ERR_NOT_IN_RANGE) {
            // 这里不应该发生，因为findLink已经确保了距离在5格内
            // 但为了安全起见，还是添加移动逻辑
            creep.moveTo(link, Object.assign({}, moveOpts, {
                ignoreCreeps: false,
                reusePath: 10,
                maxOps: 4000
            }));
            return true;
        }
        
        return false;
    },
    
    /**
     * 转移能量到目标
     * @param {Creep} creep - creep对象
     * @param {Structure} target - 目标结构
     * @param {Object} moveOpts - 移动选项
     * @returns {boolean} 是否成功转移或移动
     */
    transferEnergy: function(creep, target, moveOpts) {
        const result = creep.transfer(target, RESOURCE_ENERGY);
        
        if (result === OK) {
            if (target.structureType === STRUCTURE_CONTAINER) {
                const capacity = target.store.getCapacity(RESOURCE_ENERGY);
                const energy = target.store[RESOURCE_ENERGY] || 0;
                const percentage = capacity > 0 ? energy / capacity : 0;
                
                if (percentage >= 0.2) {
                    creep.room.memory.containersSatisfied = true;
                }
            }
            return true;
        } else if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, Object.assign({}, moveOpts, {
                ignoreCreeps: false,
                reusePath: 10,
                maxOps: 4000
            }));
            return true;
        } else if (result === ERR_FULL) {
            if (target.structureType === STRUCTURE_CONTAINER) {
                creep.room.memory.containersSatisfied = true;
            }
            return false;
        }
        
        return true;
    },
    
    /**
     * 获取最佳存储目标（按优先级排序）
     * @param {Creep} creep - creep对象
     * @param {string} resourceType - 资源类型，默认为RESOURCE_ENERGY
     * @returns {Structure|boolean} 最佳目标结构或false
     */
    getBestStorageTarget: function(creep, resourceType) {
        if (resourceType === undefined) {
            resourceType = RESOURCE_ENERGY;
        }
        
        // 首先尝试5格范围内的LINK
        const link = this.findLink(creep);
        if (link !== false) return link;
        
        // 如果没有5格范围内的LINK，尝试Spawn或Extension
        const spawnOrExtension = this.findSpawnOrExtension(creep);
        if (spawnOrExtension) return spawnOrExtension;
        
        // 尝试Storage
        const storage = this.findStorage(creep);
        if (storage) return storage;
        
        // 尝试低能量容器
        const lowEnergyContainer = this.findContainerToFill(creep);
        if (lowEnergyContainer) return lowEnergyContainer;
        
        // 尝试任何未满的容器
        const anyContainer = this.findAnyContainerToFill(creep);
        if (anyContainer) return anyContainer;
        
        return false; // 找不到任何可用的目标
    }
};

module.exports = energyManager;