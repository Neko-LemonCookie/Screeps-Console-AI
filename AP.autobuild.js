/**
 * AP.autobuild.js
 * 自动建筑控制模块。
 * 负责遍历所有拥有的房间，并调用 tempbuild 库进行基建、外围建设及提取器生成。
 */

const tempbuild = require('lib.AP.tempbuild');

const APAutobuild = {
    run: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            
            if (room.controller && room.controller.my) {
                this._runRoom(room);
            }
        }
    },

    _runRoom: function(room) {
        const rcl = room.controller.level;
        if (!room.memory.autobuild) {
            room.memory.autobuild = {
                outerTriggered: false,
                extractorTriggered: false,
                lastDefenseCheck: 0
            };
        }

        if (tempbuild.runCityCenter(room.name)) return;

        if (rcl >= 4 && !room.memory.autobuild.outerTriggered) {
            if (tempbuild.runOuterStructures(room.name)) {
            } else {
                room.memory.autobuild.outerTriggered = true;
            }
        }

        if (rcl >= 6 && !room.memory.autobuild.extractorTriggered) {
            if (this._buildExtractor(room)) {
                room.memory.autobuild.extractorTriggered = true;
            }
        }

        this._repairOuterStructures(room);

        // 【新增】RCL 5+: 容器逐步替换为Link对
        if (rcl >= 5 && !room.memory.autobuild.linkUpgradeComplete) {
            this._upgradeContainerToLink(room);
        }
    },

    _buildExtractor: function(room) {
        const minerals = room.find(FIND_MINERALS);
        if (minerals.length === 0) return true;
        const mineral = minerals[0];
        
        const structures = mineral.pos.lookFor(LOOK_STRUCTURES);
        if (structures.some(s => s.structureType === STRUCTURE_EXTRACTOR)) return true;
        
        const sites = mineral.pos.lookFor(LOOK_CONSTRUCTION_SITES);
        if (sites.some(s => s.structureType === STRUCTURE_EXTRACTOR)) return true;

        return mineral.pos.createConstructionSite(STRUCTURE_EXTRACTOR) === OK;
    },

    _repairOuterStructures: function(room) {
        if (!room.memory.cityCenter) return;
        const center = room.memory.cityCenter;
        const isCore = room.memory.layoutType === '9x9';
        const radius = isCore ? 4 : 2;

        const structures = room.find(FIND_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_ROAD || 
                           s.structureType === STRUCTURE_CONTAINER ||
                           s.structureType === STRUCTURE_WALL ||
                           s.structureType === STRUCTURE_RAMPART)
        });

        if (!room.memory.autobuild.outerPositions) room.memory.autobuild.outerPositions = {};

        for (const s of structures) {
            const dx = Math.abs(s.pos.x - center.x);
            const dy = Math.abs(s.pos.y - center.y);
            if (dx <= radius && dy <= radius) continue;

            const posKey = s.pos.x + "," + s.pos.y;
            if (!room.memory.autobuild.outerPositions[posKey]) {
                room.memory.autobuild.outerPositions[posKey] = s.structureType;
            }
        }

        if (Game.time % 500 === 0) {
            let siteCount = 0;
            for (const posKey in room.memory.autobuild.outerPositions) {
                const type = room.memory.autobuild.outerPositions[posKey];
                const parts = posKey.split(',');
                const x = parseInt(parts[0]);
                const y = parseInt(parts[1]);
                const pos = new RoomPosition(x, y, room.name);
                
                if (pos.lookFor(LOOK_STRUCTURES).length === 0 && pos.lookFor(LOOK_CONSTRUCTION_SITES).length === 0) {
                    if (pos.createConstructionSite(type) === OK) {
                        siteCount++;
                        if (siteCount >= 10) break;
                    }
                }
            }
        }
    },

    /**
     * RCL 5+: 将Source旁的Container逐步替换为Link传输对
     * 流程：拆Container → 在原位建源端Link → 靠近Storage建接收端Link → 注册传输对
     * 每次只处理一个Source，按能量余额决定是否执行
     * @private
     */
    _upgradeContainerToLink: function(room) {
        // 1. 找到所有Source旁边的Container
        var sources = room.find(FIND_SOURCES);
        var containers = room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_CONTAINER; }
        });

        // 找出每个Source最近的Container（这些是tempbuild放的外围容器）
        var sourceContainers = [];
        for (var si = 0; si < sources.length; si++) {
            var source = sources[si];
            var nearestContainer = source.pos.findClosestByRange(containers);
            if (nearestContainer && source.pos.getRangeTo(nearestContainer) <= 2) {
                sourceContainers.push({ source: source, container: nearestContainer });
            }
        }

        if (sourceContainers.length === 0) {
            // 所有容器都已替换完毕
            room.memory.autobuild.linkUpgradeComplete = true;
            return;
        }

        // 2. 检查是否已有Link对覆盖了这个Source（避免重复替换）
        var existingLinks = room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_LINK; }
        });

        for (var sci = 0; sci < sourceContainers.length; sci++) {
            var sc = sourceContainers[sci];

            // 检查这个Source旁边是否已经有Link了
            var hasNearbyLink = false;
            for (var li = 0; li < existingLinks.length; li++) {
                if (sc.source.pos.getRangeTo(existingLinks[li]) <= 2) {
                    hasNearbyLink = true;
                    break;
                }
            }
            if (hasNearbyLink) continue;  // 这个Source已经有Link了，跳过

            // 3. 检查能量是否足够建Link（Link需要 800能量 + Observer能量开销）
            var CONSTRUCTION_COST = 800;  // Link建造能量
            if (room.energyAvailable < CONSTRUCTION_COST * 2) {
                return;  // 能量不够，下个tick再试
            }

            // 4. 执行替换：先保存容器位置，再拆容器
            var containerPos = sc.container.pos;
            sc.container.destroy();

            // 5. 在原位创建源端Link工地
            var result1 = room.createConstructionSite(containerPos, STRUCTURE_LINK);
            if (result1 !== OK && result1 !== ERR_RCL_NOT_ENOUGH) {
                console.log("[AutoBuild] ⚠️ 创建源端Link失败: " + result1);
                continue;
            }

            // 6. 寻找Storage附近的位置放置接收端Link（必须在源端Link的10格范围内）
            var storagePos = null;
            if (room.storage) storagePos = room.storage.pos;
            else if (room.terminal) storagePos = room.terminal.pos;
            else storagePos = room.controller.pos;  // 兜底用controller位置

            // 接收端Link要尽可能靠近Storage但不超过源端Link的范围限制(10格)
            // 算法：从Storage向源端Link方向走，找到距离Storage最近且在10格内的位置
            var bestTargetPos = null;
            var bestStorageDist = Infinity;

            for (var dx = -3; dx <= 3; dx++) {
                for (var dy = -3; dy <= 3; dy++) {
                    var testX = storagePos.x + dx;
                    var testY = storagePos.y + dy;
                    if (testX < 0 || testX > 49 || testY < 0 || testY > 49) continue;

                    var testPos = new RoomPosition(testX, testY, room.name);
                    var distToStorage = testPos.getRangeTo(storagePos);
                    var distToSourceLink = testPos.getRangeTo(containerPos);

                    // 必须在Link作用范围内(<=10格)，且尽可能靠近Storage
                    if (distToSourceLink <= 10 && distToStorage < bestStorageDist) {
                        // 检查该位置是否可以建造（没有地形障碍和其他建筑）
                        var terrain = room.lookForAt(LOOK_TERRAIN, testX, testY);
                        if (terrain[0] !== 'wall' && terrain.length > 0) {
                            var structures = testPos.lookFor(LOOK_STRUCTURES);
                            if (structures.length === 0) {
                                var sites = testPos.lookFor(LOOK_CONSTRUCTION_SITES);
                                if (sites.length === 0) {
                                    bestStorageDist = distToStorage;
                                    bestTargetPos = testPos;
                                }
                            }
                        }
                    }
                }
            }

            if (bestTargetPos) {
                var result2 = room.createConstructionSite(bestTargetPos, STRUCTURE_LINK);
                if (result2 === OK) {
                    console.log("[AutoBuild] 🔗 开始替换Container→Link: " + sc.source.id +
                               " (源端: " + containerPos + ", 接收端: " + bestTargetPos + ")");
                } else if (result2 !== ERR_RCL_NOT_ENOUGH) {
                    console.log("[AutoBuild] ⚠️ 创建接收端Link失败: " + result2);
                }
            } else {
                console.log("[AutoBuild] ⚠️ 找不到合适的接收端Link位置");
            }

            break;  // 每tick只处理一个Source
        }
    },

};

module.exports = APAutobuild;
