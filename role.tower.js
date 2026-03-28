// role.tower - 高效防御与物流维护版 (最终版)
var roleTower = {
    run: function() {
        for (let roomName in Game.rooms) {
            let room = Game.rooms[roomName];
            let towers = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
            
            for (let tower of towers) {
                // 1. 绝对优先：攻击敌人
                let enemy = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
                if (enemy) {
                    tower.attack(enemy);
                    continue; // 本tick专注攻击，不执行维修
                }
                
                // 2. 核心防御：维修墙和城墙至安全血量
                let weakestWall = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => (s.structureType == STRUCTURE_WALL || 
                                    s.structureType == STRUCTURE_RAMPART) &&
                                   s.hits < 15000 // 维持一个基础安全血量
                });
                if (weakestWall) {
                    tower.repair(weakestWall);
                    continue;
                }
                
                // 3. 【新增】关键物流维护：优先保护会衰败的容器、道路和存储！
                // 特别保护昂贵的 Storage，设置较高维修阈值
                let criticalLogistics = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => {
                        // 如果建筑类型是容器、道路或存储
                        if ([STRUCTURE_CONTAINER, STRUCTURE_ROAD, STRUCTURE_STORAGE].includes(s.structureType)) {
                            // 对于昂贵的 Storage，血量低于90%就修
                            if (s.structureType === STRUCTURE_STORAGE) return s.hits < s.hitsMax * 0.9;
                            // 对于容器和道路，血量低于50%就修（衰败快，但可稍晚修）
                            return s.hits < s.hitsMax * 0.7;
                        }
                        return false;
                    }
                });
                if (criticalLogistics) {
                    tower.repair(criticalLogistics);
                    continue; // 修好一个再下一个
                }
                
                // 4. 维修其他受损的重要建筑（Spawn, 扩展, 塔本身）
                let damagedImportant = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => s.hits < s.hitsMax * 0.8 &&
                                   (s.structureType == STRUCTURE_SPAWN ||
                                    s.structureType == STRUCTURE_EXTENSION ||
                                    s.structureType == STRUCTURE_TOWER)
                });
                if (damagedImportant) {
                    tower.repair(damagedImportant);
                }
                // 5. 如果能量过剩且无事可做，可以提升墙的血量上限（可选）
            }
        }
    }
};
module.exports = roleTower;