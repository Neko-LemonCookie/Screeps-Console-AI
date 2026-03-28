/**
 * building.tower.js
 * 塔的运行逻辑：实时防御与维护
 * 不遵循任务系统，由 main.js 在每个 tick 直接调用。
 */

module.exports = {
    /**
     * 运行指定房间的所有塔
     * @param {Room} room 
     */
    run: function(room) {
        const search = require('lib.AP.search');
        const towerIds = search.get.structure(room.name, 'towers');
        if (!towerIds || towerIds.length === 0) return;
        const towers = towerIds.map(id => Game.getObjectById(id));

        // 查找存储并检查能量情况 (从 SearchCache 获取以节省 CPU)
        const storageId = search.get.structure(room.name, 'storage');
        const storage = Game.getObjectById(storageId);
        const canRepairNonImportant = storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 50000;

        for (const tower of towers) {
            if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < 10) continue;

            // 1. 绝对优先：攻击敌对 Creep
            const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if (closestHostile) {
                tower.attack(closestHostile);
                continue; // 本 tick 专注攻击，不执行其他动作
            }

            // 2. 治疗受伤的友方 Creep
            const closestDamagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: (c) => c.hits < c.hitsMax
            });
            if (closestDamagedCreep) {
                tower.heal(closestDamagedCreep);
                continue;
            }

            // 3. 非重要建筑修复：需要存储能量 > 50,000
            if (canRepairNonImportant) {
                // 3.1 核心防御：维修墙和城墙至安全血量 (维持基础 15000)
                const weakestWall = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => (s.structureType === STRUCTURE_WALL || 
                                    s.structureType === STRUCTURE_RAMPART) &&
                                   s.hits < 15000
                });
                if (weakestWall) {
                    tower.repair(weakestWall);
                    continue;
                }

                // 3.2 关键物流维护：优先保护会衰败的容器、道路和存储
                const criticalLogistics = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => {
                        if ([STRUCTURE_CONTAINER, STRUCTURE_ROAD, STRUCTURE_STORAGE].includes(s.structureType)) {
                            // Storage 低于 90%
                            if (s.structureType === STRUCTURE_STORAGE) return s.hits < s.hitsMax * 0.9;
                            // 容器和道路低于 70%
                            return s.hits < s.hitsMax * 0.7;
                        }
                        return false;
                    }
                });
                if (criticalLogistics) {
                    tower.repair(criticalLogistics);
                    continue;
                }
            }

            // 4. 重要建筑修复 (不受能量限制)：Spawn, Extension, Tower
            const damagedImportant = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (s) => s.hits < s.hitsMax * 0.8 &&
                               (s.structureType === STRUCTURE_SPAWN ||
                                s.structureType === STRUCTURE_EXTENSION ||
                                s.structureType === STRUCTURE_TOWER)
            });
            if (damagedImportant) {
                tower.repair(damagedImportant);
            }
        }
    }
};
