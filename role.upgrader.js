var roleUpgrader = {
    /** @param {Creep} creep **/
    run: function(creep) {
        const moveOpts = {
            visualizePathStyle: { stroke: '#ffaa00' },
            reusePath: 5,
            maxOps: 400,
            range: 1
        };
        
        // ========== 状态管理 ==========
        if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.upgrading = false;
            creep.say('🔄取能');
        }
        if (!creep.memory.upgrading && creep.store.getFreeCapacity() === 0) {
            creep.memory.upgrading = true;
            creep.say('⚡升级');
        }
        
        // ========== 升级状态 ==========
        if (creep.memory.upgrading) {
            this._upgradeController(creep, moveOpts);
        } 
        // ========== 获取能量状态 ==========
        else {
            this._getEnergy(creep, moveOpts);
        }
    },
    
    /** 升级控制器 */
    _upgradeController: function(creep, moveOpts) {
        if (!creep.room.controller) {
            creep.say('❌无控制');
            return;
        }
        
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, moveOpts);
        }
    },
    
    /** 获取能量（按优先级） */
    _getEnergy: function(creep, moveOpts) {
        // 0. 优先从Link获取（新增）
        const linkEnergy = this._getEnergyFromLink(creep, moveOpts);
        if (linkEnergy) {
            return;
        }
        
        // 1. 从Storage获取（如果有）
        const storageEnergy = this._getEnergyFromStorage(creep, moveOpts);
        if (storageEnergy) {
            return;
        }
        
        // 2. 从Container获取（如果有能量）
        const containerEnergy = this._getEnergyFromContainer(creep, moveOpts);
        if (containerEnergy) {
            return;
        }
        
        // 3. 从挖矿容器获取（如果有WORK部件）
        const minerContainerEnergy = this._getEnergyFromMinerContainer(creep, moveOpts);
        if (minerContainerEnergy) {
            return;
        }
        
        // 4. 最后才去挖矿
        this._harvestEnergy(creep, moveOpts);
    },
    
    /** 从Link获取能量（修改：优先找最近的） */
    _getEnergyFromLink: function(creep, moveOpts) {
        // 寻找所有有能量的Link
        const links = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => {
                return s.structureType === STRUCTURE_LINK &&
                       s.store[RESOURCE_ENERGY] > 0;
            }
        });
        
        if (links.length === 0) return false;
        
        // 寻找最近的Link
        const link = creep.pos.findClosestByPath(links);
        if (!link) return false;
        
        const result = creep.withdraw(link, RESOURCE_ENERGY);
        if (result === OK) {
            return true;
        } else if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(link, moveOpts);
            return true;
        } else if (result === ERR_FULL) {
            // 如果已经满了，切换到升级状态
            creep.memory.upgrading = true;
            return true;
        }
        
        return false;
    },
    
    /** 从Storage获取能量 */
    _getEnergyFromStorage: function(creep, moveOpts) {
        const storages = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => {
                return s.structureType === STRUCTURE_STORAGE &&
                       s.store[RESOURCE_ENERGY] > 50;
            }
        });
        
        if (storages.length === 0) return false;
        
        // 寻找最近的Storage
        const storage = creep.pos.findClosestByPath(storages);
        if (!storage) return false;
        
        const result = creep.withdraw(storage, RESOURCE_ENERGY);
        if (result === OK) {
            return true;
        } else if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(storage, moveOpts);
            return true;
        }
        
        return false;
    },
    
    /** 从Container获取能量 */
    _getEnergyFromContainer: function(creep, moveOpts) {
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => {
                return s.structureType === STRUCTURE_CONTAINER &&
                       s.store[RESOURCE_ENERGY] > 50;
            }
        });
        
        if (containers.length === 0) return false;
        
        // 寻找最近的容器
        const container = creep.pos.findClosestByPath(containers);
        if (!container) return false;
        
        const result = creep.withdraw(container, RESOURCE_ENERGY);
        if (result === OK) {
            return true;
        } else if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(container, moveOpts);
            return true;
        }
        
        return false;
    },
    
    /** 从挖矿容器获取能量（专门放在source旁边的容器） */
    _getEnergyFromMinerContainer: function(creep, moveOpts) {
        // 检查是否有WORK部件
        if (!creep.body.some(p => p.type === WORK)) {
            creep.say('❌无WORK');
            return false;
        }
        
        // 寻找所有source旁边的container
        const sources = creep.room.find(FIND_SOURCES);
        const minerContainers = [];
        
        for (const source of sources) {
            const containers = source.pos.findInRange(FIND_STRUCTURES, 2, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER
            });
            
            containers.forEach(container => {
                if (container.store[RESOURCE_ENERGY] > 0) {
                    minerContainers.push(container);
                }
            });
        }
        
        if (minerContainers.length === 0) return false;
        
        // 选择最近的挖矿容器
        const target = creep.pos.findClosestByPath(minerContainers);
        if (!target) return false;
        
        const result = creep.withdraw(target, RESOURCE_ENERGY);
        if (result === OK) {
            return true;
        } else if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, moveOpts);
            return true;
        }
        
        return false;
    },
    
    /** 直接挖矿 */
    _harvestEnergy: function(creep, moveOpts) {
        // 检查是否有WORK部件
        if (!creep.body.some(p => p.type === WORK)) {
            creep.say('❌无WORK');
            return;
        }
        
        // 如果有指定的sourceId，继续采集它
        if (creep.memory.sourceId) {
            const source = Game.getObjectById(creep.memory.sourceId);
            if (source && source.energy > 0) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, moveOpts);
                }
                return;
            }
        }
        
        // 寻找最近的活跃能量源
        const sources = creep.room.find(FIND_SOURCES_ACTIVE);
        if (sources.length > 0) {
            const source = creep.pos.findClosestByPath(sources);
            if (source) {
                creep.memory.sourceId = source.id;
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, moveOpts);
                }
            }
        } else {
            // 没有活跃能量源，随便找一个
            const allSources = creep.room.find(FIND_SOURCES);
            if (allSources.length > 0) {
                const source = creep.pos.findClosestByPath(allSources);
                if (source) {
                    creep.memory.sourceId = source.id;
                    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, moveOpts);
                    }
                }
            }
        }
    },
    
    /** 检查是否需要紧急挖矿（当存储结构都空了的时候） */
    _shouldEmergencyHarvest: function(room) {
        // 检查所有存储结构
        const storageStructures = room.find(FIND_STRUCTURES, {
            filter: (s) => {
                return (s.structureType === STRUCTURE_STORAGE ||
                        s.structureType === STRUCTURE_CONTAINER) &&
                       s.store[RESOURCE_ENERGY] > 100;
            }
        });
        
        return storageStructures.length === 0;
    }
};

module.exports = roleUpgrader;