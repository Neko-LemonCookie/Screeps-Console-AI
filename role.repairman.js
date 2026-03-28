// role.repairman.js - 修理者角色
var roleRepairman = {
    /** @param {Creep} creep **/
    run: function(creep) {
        // ========== 状态管理 ==========
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄取能');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🔧修理');
        }

        // ========== 工作模式 ==========
        if (creep.memory.working) {
            // 寻找并修理建筑
            var repairTarget = this._selectRepairTarget(creep);
            if (repairTarget) {
                if (creep.repair(repairTarget) === ERR_NOT_IN_RANGE) {
                    var moveOpts = {
                        visualizePathStyle: { stroke: '#ffaa00' },
                        reusePath: 10,
                        maxOps: 800
                    };
                    creep.moveTo(repairTarget, moveOpts);
                }
                return;
            }
            
            // 没有修理目标时，升级控制器
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                var moveOpts = {
                    visualizePathStyle: { stroke: '#9900ff' },
                    reusePath: 15,
                    maxOps: 500
                };
                creep.moveTo(creep.room.controller, moveOpts);
            }
            creep.say('⬆️升级');
            return;
        }
        
        // ========== 取能模式 ==========
        this._withdrawEnergy(creep);
    },
    
    /** 
     * 选择修理目标
     * @param {Creep} creep - creep对象
     * @returns {Structure|null} 修理目标
     */
    _selectRepairTarget: function(creep) {
        var room = creep.room;
        
        // 1. 优先修理血量低于50%的关键建筑
        var priorityRepair = room.find(FIND_STRUCTURES, {
            filter: function(structure) {
                if (structure.hits >= structure.hitsMax) return false;
                var isCoreStructure = [
                    STRUCTURE_SPAWN,
                    STRUCTURE_EXTENSION,
                    STRUCTURE_TOWER,
                    STRUCTURE_STORAGE,
                    STRUCTURE_CONTAINER,
                    STRUCTURE_LINK
                ].indexOf(structure.structureType) !== -1;
                if (!isCoreStructure) return false;
                return structure.hits < structure.hitsMax * 0.9;
            }
        });
        
        if (priorityRepair.length > 0) {
            // 选择血量比例最低的
            var lowestHpStructure = priorityRepair[0];
            var lowestHpRatio = lowestHpStructure.hits / lowestHpStructure.hitsMax;
            for (var i = 1; i < priorityRepair.length; i++) {
                var currentStructure = priorityRepair[i];
                var currentHpRatio = currentStructure.hits / currentStructure.hitsMax;
                if (currentHpRatio < lowestHpRatio) {
                    lowestHpRatio = currentHpRatio;
                    lowestHpStructure = currentStructure;
                }
            }
            return lowestHpStructure;
        }
        
        // 2. 修理血量低于70%的道路和城墙
        var secondaryRepair = room.find(FIND_STRUCTURES, {
            filter: function(structure) {
                if (structure.hits >= structure.hitsMax) return false;
                var isRoadOrWall = [
                    STRUCTURE_ROAD,
                    STRUCTURE_RAMPART
                ].indexOf(structure.structureType) !== -1;
                if (!isRoadOrWall) return false;
                return structure.hits < structure.hitsMax * 0.7;
            }
        });
        
        if (secondaryRepair.length > 0) {
            // 选择血量比例最低的
            var lowestHpStructure = secondaryRepair[0];
            var lowestHpRatio = lowestHpStructure.hits / lowestHpStructure.hitsMax;
            for (var i = 1; i < secondaryRepair.length; i++) {
                var currentStructure = secondaryRepair[i];
                var currentHpRatio = currentStructure.hits / currentStructure.hitsMax;
                if (currentHpRatio < lowestHpRatio) {
                    lowestHpRatio = currentHpRatio;
                    lowestHpStructure = currentStructure;
                }
            }
            return lowestHpStructure;
        }
        
        return null;
    },
    
    /** 
     * 获取能量
     * @param {Creep} creep - creep对象
     */
    _withdrawEnergy: function(creep) {
        var room = creep.room;
        
        // 优先级1：从最近的、有能量的容器中取
        var containers = room.find(FIND_STRUCTURES, {
            filter: function(s) {
                return s.structureType == STRUCTURE_CONTAINER &&
                       s.store[RESOURCE_ENERGY] > 100;
            }
        });
        if (containers.length > 0) {
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
            if (closestContainer) {
                if (creep.withdraw(closestContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    var moveOpts = {
                        visualizePathStyle: { stroke: '#ffaa00' },
                        reusePath: 8
                    };
                    creep.moveTo(closestContainer, moveOpts);
                }
                creep.say('📦取能');
                return;
            }
        }
        
        // 优先级2：从Storage中取（备用）
        var storage = room.storage;
        if (storage && storage.store[RESOURCE_ENERGY] > 500) {
            if (creep.withdraw(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                var moveOpts = {
                    visualizePathStyle: { stroke: '#ffaa00' },
                    reusePath: 10
                };
                creep.moveTo(storage, moveOpts);
            }
            creep.say('🏠取能');
            return;
        }
        
        // 优先级3：从已满的Spawn、Extension中取
        var targets = room.find(FIND_STRUCTURES, {
            filter: function(s) {
                return (s.structureType == STRUCTURE_SPAWN ||
                       s.structureType == STRUCTURE_EXTENSION) &&
                       s.store[RESOURCE_ENERGY] > 300;
            }
        });
        var target = null;
        if (targets.length > 0) {
            var closestDistance = Infinity;
            for (var i = 0; i < targets.length; i++) {
                var currentTarget = targets[i];
                var distance = creep.pos.getRangeTo(currentTarget);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    target = currentTarget;
                }
            }
        }
        if (target) {
            if (creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                var moveOpts = {
                    visualizePathStyle: { stroke: '#ffaa00' },
                    reusePath: 10
                };
                creep.moveTo(target, moveOpts);
            }
            return;
        }

        // 优先级4：自己挖矿
        var source = null;
        var sources = room.find(FIND_SOURCES_ACTIVE);
        if (sources.length > 0) {
            var closestDistance = Infinity;
            for (var i = 0; i < sources.length; i++) {
                var currentSource = sources[i];
                var distance = creep.pos.getRangeTo(currentSource);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    source = currentSource;
                }
            }
        }
        if (source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { reusePath: 10 });
            creep.say('⛏️挖矿');
        }
    }
};

module.exports = roleRepairman;