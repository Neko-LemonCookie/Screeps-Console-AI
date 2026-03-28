var roleMineralHarvester = {
    /** @param {Creep} creep **/
    run: function(creep) {
        // 如果矿物已耗尽，直接进入升级模式
        if (creep.memory.mineralDepleted) {
            this.upgrade(creep);
            return;
        }

        // 正常采集/存储切换逻辑
        if (creep.memory.harvesting && creep.store.getFreeCapacity() == 0) {
            creep.memory.harvesting = false;
            creep.say('🚚 存储');
        }
        if (!creep.memory.harvesting && creep.store.getUsedCapacity() == 0) {
            creep.memory.harvesting = true;
            creep.say('⛏️ 采集');
        }

        if (creep.memory.harvesting) {
            this.harvestMineral(creep);
        } else {
            this.storeMineral(creep);
        }
    },

    /** 采集矿物 **/
    harvestMineral: function(creep) {
        const mineral = creep.room.find(FIND_MINERALS)[0];
        
        if (mineral) {
            if (mineral.mineralAmount > 0) {
                const harvestResult = creep.harvest(mineral);
                if (harvestResult == ERR_NOT_IN_RANGE) {
                    creep.moveTo(mineral, {
                        visualizePathStyle: {stroke: '#ffaa00'},
                        reusePath: 10
                    });
                }
                // 忽略 ERR_BUSY / ERR_NOT_ENOUGH_RESOURCES
            } else {
                // 矿物已耗尽：转为升级模式，不再采集
                creep.say('🔄 转为升级');
                creep.memory.mineralDepleted = true;   // 设置永久升级标志
                delete creep.memory.harvesting;        // 清理旧状态
                // 立即尝试升级（下个 tick 会进入 upgrade 分支）
            }
        }
        // 没有矿物则原地等待
    },

    /** 存储矿物 **/
    storeMineral: function(creep) {
        const resourceType = Object.keys(creep.store)[0];
        if (!resourceType) {
            creep.memory.harvesting = true;
            return;
        }

        // 优先容器，其次存储
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType == STRUCTURE_CONTAINER &&
                           s.store.getFreeCapacity(resourceType) > 0
        });
        let target;
        if (containers.length > 0) {
            target = creep.pos.findClosestByRange(containers);
        } else {
            const storage = creep.room.storage;
            if (storage && storage.store.getFreeCapacity(resourceType) > 0) {
                target = storage;
            }
        }

        if (target) {
            const transferResult = creep.transfer(target, resourceType);
            if (transferResult == ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    visualizePathStyle: {stroke: '#ffffff'},
                    reusePath: 10
                });
            } else if (transferResult != OK) {
                creep.memory.harvesting = true; // 可能目标满了，重新尝试采集
            }
        } else {
            creep.say('无处存放');
            creep.memory.harvesting = true; // 稍后再试
        }
    },

    /** 简单的升级功能 **/
    upgrade: function(creep) {
        // 如果身上没有能量，先去获取能量
        if (creep.store.getUsedCapacity() == 0) {
            // 寻找能量源（容器或存储）
            const sources = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => (s.structureType == STRUCTURE_CONTAINER ||
                                s.structureType == STRUCTURE_STORAGE) &&
                                s.store[RESOURCE_ENERGY] > 0
            });
            if (sources.length > 0) {
                const target = creep.pos.findClosestByPath(sources);
                if (target) {
                    if (creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                }
            } else {
                // 没有能量源，原地等待
                creep.say('⏳ 无能量');
            }
        } else {
            // 有能量，去升级控制器
            const controller = creep.room.controller;
            if (controller) {
                if (creep.upgradeController(controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        }
    }
};

module.exports = roleMineralHarvester;