// common.build.js - 建筑管理通用模块

const buildManager = {
    /**
     * 智能选择建造工地（优先道路与容器）
     * @param {Creep} creep - creep对象
     * @returns {ConstructionSite|null} 选中的工地
     */
    selectConstructionSite: function(creep) {
        const room = creep.room;
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        if (sites.length == 0) return null;

        // 类型基础分 (数值越高，被选中的倾向性越强)
        const typeBaseScore = {
            [STRUCTURE_ROAD]: 300,       // 道路：最高优先级
            [STRUCTURE_CONTAINER]: 180,  // 容器：非常高优先级
            [STRUCTURE_TOWER]: 250,      // 塔：高优先级
            [STRUCTURE_EXTENSION]: 200,
            [STRUCTURE_RAMPART]: 150,
            [STRUCTURE_WALL]: 150,
            [STRUCTURE_STORAGE]: 100,    // 大型存储：优先级调低
            [STRUCTURE_LINK]: 250,
        };

        let bestSite = null;
        let bestScore = -Infinity;

        for (var i = 0; i < sites.length; i++) {
            var site = sites[i];
            // 1. 距离得分：距离越近，得分越高 (0 ~ 1)
            const distance = creep.pos.getRangeTo(site);
            const distanceScore = 1 / (distance + 1);

            // 2. 类型得分：基础分 + 微小随机波动 (避免完全并列时僵持)
            const base = typeBaseScore[site.structureType] || 50;
            const typeScore = base + Math.random();

            // 3. 综合得分 = 类型得分 + 距离得分 * 50 (平衡两者影响)
            const totalScore = typeScore + (distanceScore * 50);

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestSite = site;
            }
        }
        return bestSite;
    },
    
    /**
     * 智能选择修理目标
     * @param {Creep} creep - creep对象
     * @returns {Structure|null} 选中的修理目标
     */
    selectRepairTarget: function(creep) {
        const room = creep.room;
        
        // 1. 优先修理血量95%以下的道路和容器
        let priorityRepair = room.find(FIND_STRUCTURES, {
            filter: function(structure) {
                if (structure.hits >= structure.hitsMax) return false;
                // 只修理道路和容器
                const isRoadOrContainer = [
                    STRUCTURE_ROAD,
                    STRUCTURE_CONTAINER
                ].indexOf(structure.structureType) !== -1;
                if (!isRoadOrContainer) return false;
                // 血量低于95%的优先
                return structure.hits < structure.hitsMax * 0.95;
            }
        });
        
        if (priorityRepair.length > 0) {
            // 选择血量比例最低的
            let lowestHpStructure = priorityRepair[0];
            let lowestHpRatio = lowestHpStructure.hits / lowestHpStructure.hitsMax;
            
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
        
        // 2. 如果没有95%以下的，再修理其他核心结构
        let coreRepair = room.find(FIND_STRUCTURES, {
            filter: function(structure) {
                if (structure.hits >= structure.hitsMax) return false;
                const isCoreStructure = [
                    STRUCTURE_SPAWN,
                    STRUCTURE_EXTENSION, 
                    STRUCTURE_TOWER,
                    STRUCTURE_STORAGE,
                    STRUCTURE_CONTAINER
                ].indexOf(structure.structureType) !== -1;
                if (!isCoreStructure) return false;
                return structure.hits < structure.hitsMax * 0.8;
            }
        });
        
        if (coreRepair.length > 0) {
            // 选择血量比例最低的
            let lowestHpStructure = coreRepair[0];
            let lowestHpRatio = lowestHpStructure.hits / lowestHpStructure.hitsMax;
            
            for (var i = 1; i < coreRepair.length; i++) {
                var currentStructure = coreRepair[i];
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
     * 建造指定工地
     * @param {Creep} creep - creep对象
     * @param {ConstructionSite} target - 工地对象
     * @param {Object} moveOpts - 移动选项
     * @returns {boolean} 是否成功建造或移动
     */
    build: function(creep, target, moveOpts) {
        var result = creep.build(target);
        if (result == ERR_NOT_IN_RANGE) {
            creep.moveTo(target, moveOpts);
            return true;
        }
        return true;
    },
    
    /**
     * 修理指定结构
     * @param {Creep} creep - creep对象
     * @param {Structure} target - 结构对象
     * @param {Object} moveOpts - 移动选项
     * @returns {boolean} 是否成功修理或移动
     */
    repair: function(creep, target, moveOpts) {
        if (creep.repair(target) == ERR_NOT_IN_RANGE) {
            creep.moveTo(target, moveOpts);
            return true;
        }
        return true;
    },
    
    /**
     * 升级控制器
     * @param {Creep} creep - creep对象
     * @param {Object} moveOpts - 移动选项
     * @returns {boolean} 是否成功升级或移动
     */
    upgradeController: function(creep, moveOpts) {
        if (!creep.room.controller) {
            creep.say('❌无控制');
            return false;
        }
        
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, moveOpts);
            return true;
        }
        return true;
    }
};

module.exports = buildManager;