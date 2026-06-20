/**
 * lib.AP.tempbuild.js
 * 负责城市中心判断、建筑模板管理及工地生成。
 * 支持 5x5 (普通房) 和 9x9 (Main/Core 房) 两种布局。
 */

const libAPTempbuild = {
    /**
     * 城市中心 5x5 模板定义
     */
    template5x5: {
        1: [
            { type: STRUCTURE_SPAWN, x: 2, y: -2, name: "CoreI_" },
            { type: STRUCTURE_ROAD, x: 1, y: -2 },
            { type: STRUCTURE_ROAD, x: 2, y: -1 }
        ],
        2: [],
        3: [
            { type: STRUCTURE_TOWER, x: 1, y: -1 }
        ],
        4: [
            { type: STRUCTURE_STORAGE, x: 0, y: 0 },
            { type: STRUCTURE_ROAD, x: 0, y: -1 }
        ],
        5: [
            { type: STRUCTURE_TOWER, x: -1, y: -1 },
            { type: STRUCTURE_ROAD, x: -1, y: -2 },
            { type: STRUCTURE_ROAD, x: -2, y: -1 },
            { type: STRUCTURE_ROAD, x: -2, y: 0 },
            { type: STRUCTURE_ROAD, x: -2, y: 1 },
            { type: STRUCTURE_ROAD, x: -1, y: 2 },
            { type: STRUCTURE_ROAD, x: 1, y: 1 },
            { type: STRUCTURE_ROAD, x: 1, y: 2 },
            { type: STRUCTURE_ROAD, x: 2, y: 0 },
            { type: STRUCTURE_ROAD, x: 2, y: 1 }
        ],
        6: [
            { type: STRUCTURE_LAB, x: -1, y: 0 },
            { type: STRUCTURE_LAB, x: 1, y: 0 },
            { type: STRUCTURE_LAB, x: 0, y: 1 },
            { type: STRUCTURE_TERMINAL, x: 0, y: -2 }
        ],
        7: [
            { type: STRUCTURE_FACTORY, x: 0, y: 2 },
            { type: STRUCTURE_SPAWN, x: 2, y: 2, name: "CoreI_" },
            { type: STRUCTURE_LINK, x: 1, y: 2 }   // 小房间只需1个Link
        ],
        8: [
            { type: STRUCTURE_SPAWN, x: -2, y: 2, name: "CoreI_" },
            { type: STRUCTURE_TOWER, x: -2, y: -2 }
        ]
    },

    /**
     * 城市中心 9x9 模板定义 (Main/Core 房间使用)
     */
    template9x9: {
        1: [
            { type: STRUCTURE_SPAWN, x: 0, y: -1, name: "CoreII_" }
        ],
        2: [
            { type: STRUCTURE_EXTENSION, x: -2, y: -1 },
            { type: STRUCTURE_EXTENSION, x: -3, y: 0 },
            { type: STRUCTURE_EXTENSION, x: -2, y: 1 },
            { type: STRUCTURE_EXTENSION, x: -4, y: 1 },
            { type: STRUCTURE_EXTENSION, x: -4, y: 0 },
            { type: STRUCTURE_ROAD, x: -1, y: -1 },
            { type: STRUCTURE_ROAD, x: -2, y: 0 },
            { type: STRUCTURE_ROAD, x: -3, y: 1 }
        ],
        3: [
            { type: STRUCTURE_TOWER, x: -1, y: 0 },
            { type: STRUCTURE_EXTENSION, x: -4, y: 2 },
            { type: STRUCTURE_EXTENSION, x: -4, y: 3 },
            { type: STRUCTURE_EXTENSION, x: -3, y: 2 },
            { type: STRUCTURE_ROAD, x: -3, y: -1 },
            { type: STRUCTURE_EXTENSION, x: -4, y: -1 },
            { type: STRUCTURE_EXTENSION, x: -4, y: -2 }
        ],
        4: [
            { type: STRUCTURE_STORAGE, x: 0, y: 0 },
            { type: STRUCTURE_ROAD, x: -1, y: 1 },
            { type: STRUCTURE_ROAD, x: 1, y: 1 },
            { type: STRUCTURE_ROAD, x: 1, y: -1 },
            { type: STRUCTURE_ROAD, x: -2, y: -2 },
            { type: STRUCTURE_ROAD, x: -3, y: -3 },
            { type: STRUCTURE_ROAD, x: -4, y: -4 },
            { type: STRUCTURE_ROAD, x: 0, y: -2 },
            { type: STRUCTURE_EXTENSION, x: -3, y: -2 },
            { type: STRUCTURE_EXTENSION, x: -4, y: -3 },
            { type: STRUCTURE_EXTENSION, x: -2, y: -3 },
            { type: STRUCTURE_EXTENSION, x: -2, y: -4 },
            { type: STRUCTURE_EXTENSION, x: -3, y: -4 },
            { type: STRUCTURE_EXTENSION, x: -1, y: -4 },
            { type: STRUCTURE_ROAD, x: -1, y: -3 },
            { type: STRUCTURE_EXTENSION, x: 0, y: -3 },
            { type: STRUCTURE_EXTENSION, x: 0, y: -4 },
            { type: STRUCTURE_ROAD, x: 1, y: -3 },
            { type: STRUCTURE_EXTENSION, x: 1, y: -4 },
            { type: STRUCTURE_EXTENSION, x: 2, y: -3 }
        ],
        5: [
            { type: STRUCTURE_TOWER, x: 1, y: 0 },
            { type: STRUCTURE_ROAD, x: 2, y: -2 },
            { type: STRUCTURE_ROAD, x: 3, y: -3 },
            { type: STRUCTURE_ROAD, x: 4, y: -4 },
            { type: STRUCTURE_EXTENSION, x: 2, y: -1 },
            { type: STRUCTURE_EXTENSION, x: 3, y: -2 },
            { type: STRUCTURE_EXTENSION, x: 4, y: -3 },
            { type: STRUCTURE_EXTENSION, x: 2, y: -4 },
            { type: STRUCTURE_EXTENSION, x: 3, y: -4 },
            { type: STRUCTURE_ROAD, x: 2, y: 0 },
            { type: STRUCTURE_ROAD, x: 3, y: -1 },
            { type: STRUCTURE_EXTENSION, x: 4, y: -2 },
            { type: STRUCTURE_EXTENSION, x: 4, y: -1 },
            { type: STRUCTURE_EXTENSION, x: 4, y: 0 },
            { type: STRUCTURE_EXTENSION, x: 4, y: 1 },
            { type: STRUCTURE_EXTENSION, x: 3, y: 0 }
        ],
        6: [
            { type: STRUCTURE_TERMINAL, x: 0, y: 1 },
            { type: STRUCTURE_ROAD, x: 2, y: 2 },
            { type: STRUCTURE_ROAD, x: 3, y: 3 },
            { type: STRUCTURE_ROAD, x: 4, y: 4 },
            { type: STRUCTURE_LAB, x: 1, y: 4 },
            { type: STRUCTURE_LAB, x: 2, y: 3 },
            { type: STRUCTURE_LAB, x: 3, y: 4 },
            { type: STRUCTURE_EXTENSION, x: 2, y: 1 },
            { type: STRUCTURE_EXTENSION, x: 3, y: 1 },
            { type: STRUCTURE_EXTENSION, x: 4, y: 2 },
            { type: STRUCTURE_EXTENSION, x: 4, y: 3 },
            { type: STRUCTURE_EXTENSION, x: 2, y: 4 },
            { type: STRUCTURE_ROAD, x: 3, y: 2 },
            { type: STRUCTURE_LINK, x: 3, y: 2 }   // Link: Source→Storage 快速传输
        ],
        7: [
            { type: STRUCTURE_FACTORY, x: 0, y: 2 },
            { type: STRUCTURE_SPAWN, x: 1, y: -2, name: "CoreII_" },
            { type: STRUCTURE_TOWER, x: -1, y: 2 },
            { type: STRUCTURE_EXTENSION, x: 0, y: 3 },
            { type: STRUCTURE_ROAD, x: 0, y: 4 },
            { type: STRUCTURE_ROAD, x: 1, y: 3 },
            { type: STRUCTURE_ROAD, x: -2, y: 2 },
            { type: STRUCTURE_ROAD, x: -3, y: 3 },
            { type: STRUCTURE_ROAD, x: -4, y: 4 },
            { type: STRUCTURE_LAB, x: -3, y: 4 },
            { type: STRUCTURE_LAB, x: -2, y: 3 },
            { type: STRUCTURE_LAB, x: -1, y: 4 },
            { type: STRUCTURE_EXTENSION, x: -2, y: 4 },
            { type: STRUCTURE_ROAD, x: -1, y: 3 },
            { type: STRUCTURE_LINK, x: -3, y: 2 }  // Link2: 第二条传输线
        ],
        8: [
            { type: STRUCTURE_SPAWN, x: -1, y: -2, name: "CoreII_" },
            { type: STRUCTURE_TOWER, x: 1, y: 2 }
        ]
    },

    /**
     * 获取指定对象的采矿位
     */
    getMiningSpots: function(objId) {
        const obj = Game.getObjectById(objId);
        if (!obj) return [];
        const spots = [];
        const terrain = Game.map.getRoomTerrain(obj.room.name);
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                if (x === 0 && y === 0) continue;
                const px = obj.pos.x + x;
                const py = obj.pos.y + y;
                if (px < 0 || px > 49 || py < 0 || py > 49) continue;
                if (terrain.get(px, py) !== TERRAIN_MASK_WALL) {
                    spots.push(new RoomPosition(px, py, obj.room.name));
                }
            }
        }
        return spots;
    },

    /**
     * 寻找城市中心
     */
    findCityCenter: function(roomName, size) {
        const room = Game.rooms[roomName];
        if (!room) return null;

        // 优先根据现有 spawn 的位置反向计算城市中心
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length > 0) {
            const spawn = spawns[0];
            const spawnX = spawn.pos.x;
            const spawnY = spawn.pos.y;

            // 根据模板反向计算城市中心
            // 5x5 模板 RCL 1: spawn 在 (2, -2)，城市中心在 (0, 0)
            // 9x9 模板 RCL 1: spawn 在 (0, -1)，城市中心在 (0, 0)
            // 城市中心 = spawn - spawnOffset
            let centerX, centerY;

            if (size === 5) {
                // 5x5: spawn 在 (2, -2)，城市中心在 (0, 0)
                centerX = spawnX - 2;
                centerY = spawnY + 2;
            } else {
                // 9x9: spawn 在 (0, -1)，城市中心在 (0, 0)
                centerX = spawnX - 0;
                centerY = spawnY + 1;
            }

            // 检查计算出的城市中心是否在有效范围内
            if (centerX >= 0 && centerX <= 49 && centerY >= 0 && centerY <= 49) {
                // 检查城市中心周围是否有足够空间
                const terrain = Game.map.getRoomTerrain(roomName);
                let hasEnoughSpace = true;
                const checkRadius = Math.floor(size / 2);

                for (let dx = -checkRadius; dx <= checkRadius && hasEnoughSpace; dx++) {
                    for (let dy = -checkRadius; dy <= checkRadius && hasEnoughSpace; dy++) {
                        const tx = centerX + dx;
                        const ty = centerY + dy;
                        if (tx < 0 || tx > 49 || ty < 0 || ty > 49) continue;
                        if (terrain.get(tx, ty) === TERRAIN_MASK_WALL) {
                            hasEnoughSpace = false;
                        }
                    }
                }

                if (hasEnoughSpace) {
                    return new RoomPosition(centerX, centerY, roomName);
                }
            }
        }

        // 如果没有 spawn 或无法反向计算，使用算法计算
        const radius = Math.floor(size / 2);
        const sources = room.find(FIND_SOURCES);
        const controller = room.controller;
        if (!controller) return null;

        let forbiddenPositions = [];
        sources.forEach(s => forbiddenPositions = forbiddenPositions.concat(this.getMiningSpots(s.id)));
        forbiddenPositions = forbiddenPositions.concat(this.getMiningSpots(controller.id));

        const terrain = Game.map.getRoomTerrain(roomName);

        // 标记所有建筑墙的坐标 (如果房间可见)
        const buildingWallPositions = {};
        if (room) {
            const bWalls = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL } });
            for (const wall of bWalls) {
                buildingWallPositions[wall.pos.x + "," + wall.pos.y] = true;
            }
        }

        let bestPos = null;
        let minScore = Infinity;

        for (let x = size; x <= 49 - size; x++) {
            for (let y = size; y <= 49 - size; y++) {
                if (forbiddenPositions.some(p => p.x === x && p.y === y)) continue;

                let swampCount = 0;
                let areaForbidden = false;
                for (let dx = -radius; dx <= radius; dx++) {
                    for (let dy = -radius; dy <= radius; dy++) {
                        const tx = x + dx;
                        const ty = y + dy;
                        const t = terrain.get(tx, ty);
                        const isBuildingWall = buildingWallPositions[tx + "," + ty];

                        if (t === TERRAIN_MASK_WALL || isBuildingWall) {
                            areaForbidden = true;
                            break;
                        }
                        if (t === TERRAIN_MASK_SWAMP) swampCount++;
                    }
                    if (areaForbidden) break;
                }
                if (areaForbidden || swampCount > (size * size) * 0.4) continue;

                let score = controller.pos.getRangeTo(x, y);
                sources.forEach(s => score += s.pos.getRangeTo(x, y));
                if (score < minScore) {
                    minScore = score;
                    bestPos = new RoomPosition(x, y, roomName);
                }
            }
        }
        return bestPos;
    },

    /**
     * 实现棋盘格扩展区逻辑 (E/R 交叉)
     * @private
     */
    _placeExtensionsCheckerboard: function(room, center) {
        const rcl = room.controller.level;
        if (rcl < 2) return false;

        const maxExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][rcl];
        const currentCount = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } }).length +
                           room.find(FIND_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_EXTENSION } }).length;
        
        if (currentCount >= maxExtensions) return false;

        // 寻找扩展区起点 (离中心 4 格开外，X 形状簇)
        // 使用棋盘格公式: (x + y) % 2 === 0 为扩展, (x + y) % 2 === 1 为道路
        const terrain = Game.map.getRoomTerrain(room.name);
        
        // 搜索半径从 4 开始
        for (let dist = 4; dist < 15; dist++) {
            for (let dx = -dist; dx <= dist; dx++) {
                for (let dy = -dist; dy <= dist; dy++) {
                    if (Math.abs(dx) !== dist && Math.abs(dy) !== dist) continue;
                    
                    const x = center.x + dx;
                    const y = center.y + dy;
                    if (x < 2 || x > 47 || y < 2 || y > 47) continue;

                    // 检查棋盘格逻辑
                    const isExtensionSpot = (x + y) % 2 === 0;
                    const type = isExtensionSpot ? STRUCTURE_EXTENSION : STRUCTURE_ROAD;
                    
                    // 地形检查：道路不能建在墙上，扩展也不能
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

                    // 检查位置占用
                    const pos = new RoomPosition(x, y, room.name);
                    if (pos.lookFor(LOOK_STRUCTURES).length > 0 || pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0) continue;

                    // 放置工地
                    const res = room.createConstructionSite(pos, type);
                    if (res === OK) return true;
                }
            }
        }
        return false;
    },

    /**
     * 运行城市中心模板生成逻辑
     */
    runCityCenter: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return;

        // 默认所有房间都使用 9x9 核心房间布局
        if (!room.memory.layoutType) {
            room.memory.layoutType = '9x9';
        }

        const isCoreRoom = room.memory.layoutType === '9x9';
        const template = isCoreRoom ? this.template9x9 : this.template5x5;
        const size = isCoreRoom ? 9 : 5;

        if (!room.memory.cityCenter) {
            const center = this.findCityCenter(roomName, size);
            if (center) room.memory.cityCenter = { x: center.x, y: center.y };
            else return;
        }

        const center = room.memory.cityCenter;
        const rcl = room.controller.level;

        // 1. 放置模板内的建筑
        for (let i = 1; i <= rcl; i++) {
            const builds = template[i];
            if (!builds) continue;
            for (const b of builds) {
                const pos = new RoomPosition(center.x + b.x, center.y + b.y, roomName);
                if (pos.lookFor(LOOK_STRUCTURES).length === 0 && pos.lookFor(LOOK_CONSTRUCTION_SITES).length === 0) {
                    if (b.type === STRUCTURE_SPAWN) {
                        room.createConstructionSite(pos, STRUCTURE_SPAWN, (b.name || "CoreI_") + Game.time);
                    } else {
                        room.createConstructionSite(pos, b.type);
                    }
                    return true; // 每次只放一个
                }
            }
        }

        // 2. 放置模板内的扩展
        if (!isCoreRoom || rcl >= 7) {
            if (this._placeExtensionsCheckerboard(room, center)) return true;
        }
        return false;
    },

    /**
     * 运行城市外围生成逻辑 (容器、道路、墙)
     */
    runOuterStructures: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room || !room.memory.cityCenter) return;
        const center = room.memory.cityCenter;
        const rcl = room.controller.level;

        // 1. 容器
        if (this._placeContainers(room, center)) return true;

        // 2. 道路
        if (this._placePaths(room, center)) return true;

        // 3. 围墙
        if (this._placeDefenses(room, center)) return true;

        return false;
    },

    /**
     * 放置容器逻辑
     * @private
     */
    _placeContainers: function(room, centerPos) {
        const sources = room.find(FIND_SOURCES);
        const minerals = room.find(FIND_MINERALS);
        const spawns = room.find(FIND_MY_SPAWNS);
        const storage = room.storage;

        // 1. 能量源容器
        if (spawns.length > 0) {
            const spawn = spawns[0];
            for (const source of sources) {
                if (source.pos.getRangeTo(spawn) > 10) {
                    if (this._placeContainerAtTarget(room, source, spawn.pos)) return true;
                }
            }
        }

        // 2. 矿源容器
        if (storage && minerals.length > 0) {
            for (const mineral of minerals) {
                if (mineral.pos.getRangeTo(storage) > 10) {
                    if (this._placeContainerAtTarget(room, mineral, storage.pos)) return true;
                }
            }
        }
        return false;
    },

    /** 在目标周围最近的位置放容器 */
    _placeContainerAtTarget: function(room, targetObj, referencePos) {
        const spots = this.getMiningSpots(targetObj.id);
        if (spots.length === 0) return false;

        // 检查是否已有容器
        const hasContainer = spots.some(pos => {
            return pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_CONTAINER) ||
                   pos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType === STRUCTURE_CONTAINER);
        });
        if (hasContainer) return false;

        // 找到距离参考点最近的位点
        spots.sort((a, b) => a.getRangeTo(referencePos) - b.getRangeTo(referencePos));
        const bestSpot = spots[0];

        if (room.createConstructionSite(bestSpot, STRUCTURE_CONTAINER) === OK) return true;
        return false;
    },

    /**
     * 放置外部道路逻辑（渐进式：按RCL逐步扩展）
     * RCL 4: 只铺 Source → 城市核心的必经路
     * RCL 5: 铺 Controller → 城市核心的路
     * RCL 6: 链 Mineral + Storage 的路
     * RCL 7+: 全部补完剩余路径
     * @private
     */
    _placePaths: function(room, centerPos) {
        // 【新增】工地上限保护：道路工地过多时暂停新规划
        var currentSites = room.find(FIND_CONSTRUCTION_SITES).filter(function(cs) {
            return cs.structureType === STRUCTURE_ROAD;
        }).length;
        var MAX_ROAD_SITES = 20;  // 同时存在的道路工地上限
        if (currentSites >= MAX_ROAD_SITES) return false;

        const isCoreRoom = room.memory.layoutType === '9x9';
        const citySize = isCoreRoom ? 9 : 5;
        const radius = Math.floor(citySize / 2);
        const template = isCoreRoom ? this.template9x9 : this.template5x5;
        const rcl = room.controller.level;

        // 1. 获取"道路起点"：模板中位于城市边缘的道路位置
        const startPoints = [];
        for (const level in template) {
            for (const b of template[level]) {
                if (b.type === STRUCTURE_ROAD) {
                    const px = centerPos.x + b.x;
                    const py = centerPos.y + b.y;
                    if (Math.abs(b.x) === radius || Math.abs(b.y) === radius) {
                        startPoints.push(new RoomPosition(px, py, room.name));
                    }
                }
            }
        }
        if (startPoints.length === 0) return false;

        // 2. 根据RCL决定要连接哪些目标（渐进式）
        const targets = [];
        // 所有RCL都连接Source（生存基础）
        room.find(FIND_SOURCES).forEach(s => targets.push({ pos: s.pos, priority: 0 }));
        // RCL 5+ 连接Controller
        if (rcl >= 5 && room.controller) {
            targets.push({ pos: room.controller.pos, priority: 1 });
        }
        // RCL 6+ 连接Mineral和Storage
        if (rcl >= 6) {
            room.find(FIND_MINERALS).forEach(m => targets.push({ pos: m.pos, priority: 2 }));
            if (room.storage) targets.push({ pos: room.storage.pos, priority: 3 });
        }
        if (targets.length === 0) return false;

        // 按优先级排序（低=先处理）
        targets.sort((a, b) => a.priority - b.priority);

        // 3. 路径规划与建造（每tick限制工地数量）
        let placedThisTick = false;
        const maxRoadsPerTarget = rcl <= 5 ? 2 : 4;

        for (const target of targets) {
            if (placedThisTick) break;

            const pathResult = PathFinder.search(target.pos, startPoints.map(p => ({ pos: p, range: 0 })), {
                roomCallback: function(rName) {
                    if (rName !== room.name) return false;
                    var costs = new PathFinder.CostMatrix();
                    room.find(FIND_STRUCTURES).forEach(function(s) {
                        if (s.structureType === STRUCTURE_ROAD) costs.set(s.pos.x, s.pos.y, 1);
                        else if (s.structureType !== STRUCTURE_RAMPART && (OBSTACLE_OBJECT_TYPES.indexOf(s.structureType) !== -1 || s.structureType === STRUCTURE_WALL)) {
                            costs.set(s.pos.x, s.pos.y, 0xff);
                        }
                    });
                    room.find(FIND_CONSTRUCTION_SITES).forEach(function(cs) {
                        if (cs.structureType !== STRUCTURE_ROAD && cs.structureType !== STRUCTURE_RAMPART) {
                            costs.set(cs.pos.x, cs.pos.y, 0xff);
                        }
                    });
                    return costs;
                },
                plainCost: 2,
                swampCost: 10
            });

            if (!pathResult.incomplete && pathResult.path.length > 0) {
                let placedForTarget = 0;
                for (var si = 0; si < pathResult.path.length; si++) {
                    var step = pathResult.path[si];
                    if (placedForTarget >= maxRoadsPerTarget) break;
                    if (step.lookFor(LOOK_STRUCTURES).length === 0 && step.lookFor(LOOK_CONSTRUCTION_SITES).length === 0) {
                        if (room.createConstructionSite(step, STRUCTURE_ROAD) === OK) {
                            placedForTarget++;
                            placedThisTick = true;
                        }
                    }
                }
            }

            // Source采矿位强制铺路
            var source = room.find(FIND_SOURCES).find(function(s) { return s.pos.getRangeTo(target.pos) === 0; });
            if (source) {
                var spots = this.getMiningSpots(source.id);
                for (var spi = 0; spi < spots.length; spi++) {
                    var spot = spots[spi];
                    if (spot.lookFor(LOOK_STRUCTURES).length === 0 && spot.lookFor(LOOK_CONSTRUCTION_SITES).length === 0) {
                        if (room.createConstructionSite(spot, STRUCTURE_ROAD) === OK) return true;
                    }
                }
            }
        }
        return placedThisTick;
    },

    /**
     * 放置围墙逻辑
     * @private
     */
    _placeDefenses: function(room, centerPos) {
        const exits = room.find(FIND_EXIT);
        if (exits.length === 0) return false;

        // 按方向对出口进行分组
        const groups = { top: [], bottom: [], left: [], right: [] };
        for (const exit of exits) {
            if (exit.y === 0) groups.top.push(exit);
            else if (exit.y === 49) groups.bottom.push(exit);
            else if (exit.x === 0) groups.left.push(exit);
            else if (exit.x === 49) groups.right.push(exit);
        }

        // 处理每个方向的出口
        for (const dir in groups) {
            const dirExits = groups[dir];
            if (dirExits.length === 0) continue;

            // 识别连续的出口段 (Exit Zones)
            const zones = this._getExitZones(dirExits, dir);
            for (const zone of zones) {
                if (this._buildWallForZone(room, zone, dir)) return true;
            }
        }
        return false;
    },

    /** 将零散的出口点聚类为连续的区域 */
    _getExitZones: function(exits, dir) {
        if (exits.length === 0) return [];
        const coord = (dir === 'top' || dir === 'bottom') ? 'x' : 'y';
        exits.sort((a, b) => a[coord] - b[coord]);

        const zones = [];
        let currentZone = [exits[0]];

        for (let i = 1; i < exits.length; i++) {
            if (exits[i][coord] === exits[i - 1][coord] + 1) {
                currentZone.push(exits[i]);
            } else {
                zones.push(currentZone);
                currentZone = [exits[i]];
            }
        }
        zones.push(currentZone);
        return zones;
    },

    /** 为一个连续的出口区域建造围墙 */
    _buildWallForZone: function(room, zone, dir) {
        const terrain = Game.map.getRoomTerrain(room.name);
        const wallTiles = [];
        const coord = (dir === 'top' || dir === 'bottom') ? 'x' : 'y';
        const start = zone[0][coord] - 1;
        const end = zone[zone.length - 1][coord] + 1;
        const offset = (dir === 'top' || dir === 'left') ? 2 : 47;

        // 收集所有潜在的墙位
        for (let i = start; i <= end; i++) {
            let x, y;
            if (dir === 'top' || dir === 'bottom') { x = i; y = offset; }
            else { x = offset; y = i; }
            
            if (x < 0 || x > 49 || y < 0 || y > 49) continue;
            // 记录所有非自然墙的位置
            if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                wallTiles.push(new RoomPosition(x, y, room.name));
            }
        }

        if (wallTiles.length === 0) return false;

        /**
         * 寻找缺口 (Gap) 位置逻辑：
         * 1. 优先选两端（拐角）
         * 2. 若两端都是自然墙，则选区域内靠近自然墙的位置
         */
        let gapPos = null;
        const firstTile = wallTiles[0];
        const lastTile = wallTiles[wallTiles.length - 1];

        // 判定是否是真正的边缘（拐角）
        const isFirstAtEdge = (firstTile[coord] === start);
        const isLastAtEdge = (lastTile[coord] === end);

        if (isFirstAtEdge) {
            gapPos = firstTile;
        } else if (isLastAtEdge) {
            gapPos = lastTile;
        } else {
            // 两端都是自然墙，选第一个可用的非墙位
            gapPos = firstTile;
        }

        // 放置墙壁和城墙
        for (const pos of wallTiles) {
            if (pos.lookFor(LOOK_STRUCTURES).length > 0 || pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0) continue;
            
            const isGap = (pos.x === gapPos.x && pos.y === gapPos.y);
            const type = isGap ? STRUCTURE_RAMPART : STRUCTURE_WALL;
            if (room.createConstructionSite(pos, type) === OK) return true;
        }
        return false;
    },

    /**
     * 放置额外建筑
     * @private
     */
    _placeExtraBuildings: function(room, center) {
        const extras = [STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN, STRUCTURE_OBSERVER];
        const terrain = Game.map.getRoomTerrain(room.name);
        for (const type of extras) {
            if (room.find(FIND_MY_STRUCTURES, { filter: { structureType: type } }).length > 0) continue;
            if (room.find(FIND_CONSTRUCTION_SITES, { filter: { structureType: type } }).length > 0) continue;

            for (let dist = 6; dist < 10; dist++) {
                for (let dx = -dist; dx <= dist; dx++) {
                    for (let dy = -dist; dy <= dist; dy++) {
                        if (Math.abs(dx) < dist && Math.abs(dy) < dist) continue;
                        const x = center.x + dx;
                        const y = center.y + dy;
                        if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                        const pos = new RoomPosition(x, y, room.name);
                        if (pos.findInRange(FIND_STRUCTURES, 1, { filter: { structureType: STRUCTURE_ROAD } }).length > 0) {
                            if (room.createConstructionSite(pos, type) === OK) return;
                        }
                    }
                }
            }
        }
    }
};

module.exports = libAPTempbuild;
