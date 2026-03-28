/**
 * lib.AP.calculate_claim.js
 * 负责计算房间的占领价值评分。
 * 提供 API 给侦察单位使用，用于自动化扩张决策。
 */

const tempbuild = require('lib.AP.tempbuild');

const libAPCalculateClaim = {
    /**
     * 计算房间占领得分
     * @param {string} roomName 
     * @returns {number} 最终得分
     */
    getScore: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return -1; // 无法获取房间对象，返回错误码

        // 1. 基础条件校验（排除项）
        const controller = room.controller;
        if (!controller) return -999; // 无控制器，排除
        if (controller.owner || (controller.reservation && controller.reservation.username !== 'Invader')) {
            // 被非 NPC 玩家占领或预定，排除
            return -999;
        }

        let score = 0;

        // 2. 矿源评分
        score += this._scoreMinerals(room);

        // 3. 模板布局评分
        score += this._scoreLayout(roomName);

        // 4. 地形评分 (自然墙与沼泽)
        score += this._scoreTerrain(roomName);

        // 5. 资源分布评分 (能量源数量与距离)
        score += this._scoreSources(room);

        // 6. 控制器距离评分
        score += this._scoreControllerDistance(room);

        return score;
    },

    /**
     * 矿源评分
     * @private
     */
    _scoreMinerals: function(room) {
        const minerals = room.find(FIND_MINERALS);
        if (minerals.length === 0) return 0;
        
        const mineralType = minerals[0].mineralType;
        
        // 获取己方已有矿源
        const myMinerals = [];
        for (const rName in Game.rooms) {
            const r = Game.rooms[rName];
            if (r.controller && r.controller.my) {
                const rMinerals = r.find(FIND_MINERALS);
                if (rMinerals.length > 0) {
                    myMinerals.push(rMinerals[0].mineralType);
                }
            }
        }

        // 检查是否是新矿种
        if (myMinerals.indexOf(mineralType) === -1) {
            let score = 5; // 基础新矿分
            
            // 组合矿分 (UO等)
            // 常见矿: O, L (假设判定为常见)
            const commonMinerals = ['O', 'L'];
            const isCommon = commonMinerals.indexOf(mineralType) !== -1;
            
            // 检查组合潜力 (例如已有 O，新的是 U)
            const pairs = {
                'U': 'O', 'O': 'U',
                'L': 'K', 'K': 'L',
                'Z': 'K', 'K': 'Z',
                'X': 'H', 'H': 'X'
            };
            
            const neededPair = pairs[mineralType];
            if (neededPair && myMinerals.indexOf(neededPair) !== -1) {
                score += 20; // 有组合潜力
            } else {
                score += isCommon ? 0 : 10; // 非组合但稀有则+10
            }
            return score;
        }
        
        return 0; // 已有同种矿，不加分
    },

    /**
     * 模板布局评分
     * @private
     */
    _scoreLayout: function(roomName) {
        // 尝试寻找 9x9 中心
        if (tempbuild.findCityCenter(roomName, 9)) return 10;
        // 尝试寻找 5x5 中心
        if (tempbuild.findCityCenter(roomName, 5)) return 5;
        // 都放不下
        return -999;
    },

    /**
     * 地形评分
     * @private
     */
    _scoreTerrain: function(roomName) {
        const room = Game.rooms[roomName];
        const terrain = Game.map.getRoomTerrain(roomName);
        let walls = 0;
        let swamps = 0;
        let plains = 0;

        // 如果房间可见，获取所有建筑墙的坐标
        const buildingWallPositions = {};
        if (room) {
            const bWalls = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL } });
            for (const wall of bWalls) {
                buildingWallPositions[wall.pos.x + "," + wall.pos.y] = true;
            }
        }

        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                const t = terrain.get(x, y);
                const isBuildingWall = buildingWallPositions[x + "," + y];

                if (t === TERRAIN_MASK_WALL || isBuildingWall) {
                    walls++;
                } else if (t === TERRAIN_MASK_SWAMP) {
                    swamps++;
                } else {
                    plains++;
                }
            }
        }

        const wallRatio = walls / 2500;
        const swampRatio = swamps / 2500;
        let score = 0;

        // 自然墙比例
        if (wallRatio < 0.20) score += 20;
        else if (wallRatio < 0.35) score += 10;
        else if (wallRatio < 0.45) score += 5;
        else score -= 5;

        // 沼泽比例
        if (swampRatio < 0.35) score += 5;
        else if (swampRatio < 0.40) score += 3;
        else if (swampRatio > 0.50) score -= 5;

        return score;
    },

    /**
     * 能量源评分
     * @private
     */
    _scoreSources: function(room) {
        const sources = room.find(FIND_SOURCES);
        let score = sources.length * 5; // 每有一个+5

        if (sources.length >= 2) {
            const dist = sources[0].pos.getRangeTo(sources[1].pos);
            if (dist < 20) score += 10;
            else if (dist > 30) score -= 5;
        }

        return score;
    },

    /**
     * 控制器距离评分
     * @private
     */
    _scoreControllerDistance: function(room) {
        const controller = room.controller;
        const sources = room.find(FIND_SOURCES);
        
        for (const source of sources) {
            if (source.pos.getRangeTo(controller) < 15) {
                return 15; // 任一能量源近则+15
            }
        }
        return 0;
    },

    /**
     * 在目标房间寻找 9x9 最优攻击点
     * 排除扩展、道路，尽可能覆盖更多重要建筑
     * @param {string} targetRoomName 
     * @returns {RoomPosition|null} 攻击位置
     */
    getNukeTarget: function(targetRoomName) {
        const room = Game.rooms[targetRoomName];
        if (!room) return null;

        const structures = room.find(FIND_STRUCTURES, {
            filter: (s) => {
                return s.structureType !== STRUCTURE_EXTENSION && 
                       s.structureType !== STRUCTURE_ROAD &&
                       s.structureType !== STRUCTURE_RAMPART && 
                       s.structureType !== STRUCTURE_WALL &&
                       s.structureType !== STRUCTURE_CONTROLLER; // 控制器炸不掉，排除
            }
        });

        if (structures.length === 0) return null;

        let bestPos = null;
        let maxValue = -1;

        // 评分权重 (已排除不可摧毁的控制器)
        const weights = {
            [STRUCTURE_SPAWN]: 100, // 孵化中心改为最高优先级
            [STRUCTURE_STORAGE]: 80,
            [STRUCTURE_TERMINAL]: 80,
            [STRUCTURE_TOWER]: 60,
            [STRUCTURE_FACTORY]: 40,
            [STRUCTURE_LAB]: 20,
            [STRUCTURE_POWER_SPAWN]: 20,
            [STRUCTURE_NUKER]: 20,
            [STRUCTURE_OBSERVER]: 10,
            [STRUCTURE_EXTRACTOR]: 10,
            [STRUCTURE_LINK]: 10,
            [STRUCTURE_CONTAINER]: 5
        };

        // 采样点：以每个重要建筑为中心尝试 (减少计算量)
        for (const s of structures) {
            const x = s.pos.x;
            const y = s.pos.y;
            
            // 确保 9x9 范围在房间内
            if (x < 4 || x > 45 || y < 4 || y > 45) continue;

            let currentValue = 0;
            // 扫描 9x9 范围内的所有建筑 (Range 4)
            const targetsInRange = s.pos.findInRange(FIND_STRUCTURES, 4, {
                filter: (ts) => weights[ts.structureType] !== undefined
            });

            for (const target of targetsInRange) {
                currentValue += weights[target.structureType] || 0;
            }

            if (currentValue > maxValue) {
                maxValue = currentValue;
                bestPos = s.pos;
            }
        }

        return bestPos;
    }
};

module.exports = libAPCalculateClaim;
