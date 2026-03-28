/**
 * lib.AP.search.js
 * 负责提供全系统的数据查询 API。
 * 提供两套 API：
 * 1. fetch: 直接从游戏环境查询 (由 memcleaner 调用)
 * 2. get: 从 global 缓存中读取 (由其他模块调用)
 */

const libAPSearch = {
    /**
     * 直接查询 API (fetch)
     * 用于一次性获取数据并存入 global
     */
    fetch: {
        /**
         * 一次性统计所有房间的 Creep 数量 (优化版)
         * @returns {Object} { roomName: { total: N, harvest: M, ... } }
         */
        allCreepCounts: function() {
            const counts = {};
            for (const name in Game.creeps) {
                const creep = Game.creeps[name];
                const roomName = creep.room.name;
                const taskType = creep.memory.taskType || 'unibot';

                if (!counts[roomName]) counts[roomName] = { total: 0 };
                if (!counts[roomName][taskType]) counts[roomName][taskType] = 0;

                counts[roomName].total++;
                counts[roomName][taskType]++;
            }
            return counts;
        },

        /** 查询 GCL */
        gcl: function() {
            return Game.gcl;
        },

        /** 查询房间 RCL */
        rcl: function(roomName) {
            const room = Game.rooms[roomName];
            return room ? (room.controller ? room.controller.level : 0) : 0;
        },

        /** 查询特殊建筑 ID */
        structures: function(roomName) {
            const room = Game.rooms[roomName];
            if (!room) return {};
            
            const structures = room.find(FIND_STRUCTURES);
            const myStructures = room.find(FIND_MY_STRUCTURES);
            
            const factory = myStructures.find(s => s.structureType === STRUCTURE_FACTORY);
            const nuker = myStructures.find(s => s.structureType === STRUCTURE_NUKER);
            const observer = myStructures.find(s => s.structureType === STRUCTURE_OBSERVER);
            const powerSpawn = myStructures.find(s => s.structureType === STRUCTURE_POWER_SPAWN);

            const data = {
                spawns: room.find(FIND_MY_SPAWNS).map(s => s.id),
                extensions: myStructures.filter(s => s.structureType === STRUCTURE_EXTENSION).map(s => s.id),
                containers: structures.filter(s => s.structureType === STRUCTURE_CONTAINER).map(s => s.id),
                links: myStructures.filter(s => s.structureType === STRUCTURE_LINK).map(s => s.id),
                towers: myStructures.filter(s => s.structureType === STRUCTURE_TOWER).map(s => s.id),
                storage: room.storage ? room.storage.id : null,
                terminal: room.terminal ? room.terminal.id : null,
                factory: factory ? factory.id : null,
                labs: myStructures.filter(s => s.structureType === STRUCTURE_LAB).map(s => s.id),
                nuker: nuker ? nuker.id : null,
                observer: observer ? observer.id : null,
                powerSpawn: powerSpawn ? powerSpawn.id : null
            };
            return data;
        },

        /** 查询能量源 ID */
        sources: function(roomName) {
            const room = Game.rooms[roomName];
            if (!room) return [];
            return room.find(FIND_SOURCES).map(s => s.id);
        },

        /** 查询矿床 ID */
        minerals: function(roomName) {
            const room = Game.rooms[roomName];
            if (!room) return [];
            return room.find(FIND_MINERALS).map(s => s.id);
        },

        /** 查询建筑工地 ID */
        constructionSites: function(roomName) {
            const room = Game.rooms[roomName];
            if (!room) return [];
            return room.find(FIND_CONSTRUCTION_SITES).map(s => s.id);
        },

        /** 
         * 查找 LAB 组
         * 根据城市中心位置和布局类型（5x5 或 9x9）查找原料 LAB 和反应 LAB
         * 9x9 房间有两组 LAB，5x5 房间只有一组
         * @returns {Array|null} [{ inputLabs: Lab[], outputLabs: Lab[] }, ...] 或 null
         */
        labGroup: function(roomName) {
            const room = Game.rooms[roomName];
            if (!room) return null;

            const labIds = this.structures(roomName).labs;
            if (!labIds || labIds.length === 0) return null;
            const labs = labIds.map(id => Game.getObjectById(id)).filter(l => l);

            const center = room.memory.cityCenter;
            if (!center) return null;

            const layoutType = room.memory.layoutType || (room.memory.isMain ? '9x9' : '5x5');

            const groups = [];

            if (layoutType === '5x5') {
                // 5x5 只有一组 LAB
                const inputLabs = [];
                const outputLabs = [];
                for (const lab of labs) {
                    const relX = lab.pos.x - center.x;
                    const relY = lab.pos.y - center.y;
                    if ((relX === -1 || relX === 1) && relY === 0) {
                        inputLabs.push(lab);
                    } else if (relX === 0 && relY === 1) {
                        outputLabs.push(lab);
                    }
                }
                if (inputLabs.length >= 2 && outputLabs.length > 0) {
                    groups.push({ inputLabs: inputLabs, outputLabs: outputLabs });
                }
            } else if (layoutType === '9x9') {
                // 9x9 有两组 LAB
                // 第一组：x=1,3 的原料，x=2 的反应
                const group1Inputs = [];
                const group1Outputs = [];
                // 第二组：x=-3,-1 的原料，x=-2 的反应
                const group2Inputs = [];
                const group2Outputs = [];

                for (const lab of labs) {
                    const relX = lab.pos.x - center.x;
                    const relY = lab.pos.y - center.y;

                    if (relY === 4) {
                        // 原料 LAB
                        if (relX === 1 || relX === 3) {
                            group1Inputs.push(lab);
                        } else if (relX === -3 || relX === -1) {
                            group2Inputs.push(lab);
                        }
                    } else if (relY === 3) {
                        // 反应 LAB
                        if (relX === 2) {
                            group1Outputs.push(lab);
                        } else if (relX === -2) {
                            group2Outputs.push(lab);
                        }
                    }
                }

                if (group1Inputs.length >= 2 && group1Outputs.length > 0) {
                    groups.push({ inputLabs: group1Inputs, outputLabs: group1Outputs });
                }
                if (group2Inputs.length >= 2 && group2Outputs.length > 0) {
                    groups.push({ inputLabs: group2Inputs, outputLabs: group2Outputs });
                }
            }

            return groups.length > 0 ? groups : null;
        }
    },

    /**
     * 缓存读取 API (get)
     * 从 global.SearchCache 中读取数据
     */
    get: {
        gcl: function() {
            return global.SearchCache ? global.SearchCache.gcl : Game.gcl;
        },

        rcl: function(roomName) {
            if (global.SearchCache && global.SearchCache.rooms[roomName]) {
                return global.SearchCache.rooms[roomName].rcl;
            }
            return 0;
        },

        creepCount: function(roomName, taskType) {
            if (global.SearchCache && global.SearchCache.rooms[roomName]) {
                return global.SearchCache.rooms[roomName].creepCounts[taskType] || 0;
            }
            return 0;
        },

        /** 获取特定类型的建筑 ID 数组或单个 ID */
        structure: function(roomName, type) {
            if (global.SearchCache && global.SearchCache.rooms[roomName]) {
                return global.SearchCache.rooms[roomName].structures[type];
            }
            return null;
        },

        sources: function(roomName) {
            if (global.SearchCache && global.SearchCache.rooms[roomName]) {
                return global.SearchCache.rooms[roomName].sources;
            }
            return [];
        },

        minerals: function(roomName) {
            if (global.SearchCache && global.SearchCache.rooms[roomName]) {
                return global.SearchCache.rooms[roomName].minerals;
            }
            return [];
        },

        constructionSites: function(roomName) {
            if (global.SearchCache && global.SearchCache.rooms[roomName]) {
                return global.SearchCache.rooms[roomName].constructionSites;
            }
            return [];
        }
    }
};

module.exports = libAPSearch;
