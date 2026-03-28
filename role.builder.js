// role.builder.js - 智能建造者（优化版，使用 global 缓存）
var roleBuilder = {

    // 每 tick 更新一次全局缓存
    _updateGlobalCache: function(room) {
        var roomName = room.name;
        if (!global.builderCache) global.builderCache = {};
        var cache = global.builderCache[roomName];
        var currentTick = Game.time;

        // 如果缓存已存在且是本 tick 更新的，直接返回
        if (cache && cache.tick === currentTick) return;

        // 否则重新计算
        var sites = room.find(FIND_CONSTRUCTION_SITES);
        var siteInfos = [];

        if (sites.length > 0) {
            // 建筑类型优先级（同原版）
            var typePriority = {
                [STRUCTURE_SPAWN]: 500,
                [STRUCTURE_EXTENSION]: 450,
                [STRUCTURE_CONTAINER]: 400,
                [STRUCTURE_STORAGE]: 380,
                [STRUCTURE_LINK]: 370,
                [STRUCTURE_TOWER]: 350,
                [STRUCTURE_RAMPART]: 300,
                [STRUCTURE_WALL]: 250,
                [STRUCTURE_LAB]: 280,
                [STRUCTURE_TERMINAL]: 270,
                [STRUCTURE_FACTORY]: 260,
                [STRUCTURE_OBSERVER]: 240,
                [STRUCTURE_POWER_SPAWN]: 230,
                [STRUCTURE_NUKER]: 220,
                [STRUCTURE_EXTRACTOR]: 240,
                [STRUCTURE_ROAD]: 200,
                'default': 100
            };

            for (var i = 0; i < sites.length; i++) {
                var site = sites[i];
                siteInfos.push({
                    id: site.id,
                    structureType: site.structureType,
                    progress: site.progress,
                    progressTotal: site.progressTotal,
                    priority: typePriority[site.structureType] || typePriority['default'],
                    pos: { x: site.pos.x, y: site.pos.y }
                });
            }
        }

        // 同时缓存能量源信息（可选，也可单独缓存）
        var energySources = this._getEnergySources(room);

        global.builderCache[roomName] = {
            tick: currentTick,
            sites: siteInfos,
            energy: energySources
        };
    },

    // 获取能量源信息（同样存入 global 缓存）
    _getEnergySources: function(room) {
        var sources = {
            containers: [],
            storage: null,
            links: [],
            spawnExtensions: [],
            terminal: null,
            minerals: []
        };

        // 容器
        var containers = room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 200; }
        });
        sources.containers = containers.map(function(s) { return s.id; });

        // Storage
        if (room.storage) sources.storage = room.storage.id;

        // Link（能量>300）
        var links = room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_LINK && s.store[RESOURCE_ENERGY] > 300; }
        });
        sources.links = links.map(function(s) { return s.id; });

        // Spawn/Extension
        var spawnExt = room.find(FIND_STRUCTURES, {
            filter: function(s) {
                return (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                       s.store[RESOURCE_ENERGY] > 300;
            }
        });
        sources.spawnExtensions = spawnExt.map(function(s) { return s.id; });

        // Terminal
        if (room.terminal) sources.terminal = room.terminal.id;

        // 能源点
        var minerals = room.find(FIND_SOURCES_ACTIVE);
        sources.minerals = minerals.map(function(s) { return s.id; });

        return sources;
    },

    // 从缓存中获取最适合当前 creep 的工地
    _getBestSiteForCreep: function(creep) {
        var room = creep.room;
        this._updateGlobalCache(room); // 确保缓存已更新

        var cache = global.builderCache[room.name];
        if (!cache || !cache.sites || cache.sites.length === 0) return null;

        var sites = cache.sites;
        var bestScore = -Infinity;
        var bestSiteId = null;

        for (var i = 0; i < sites.length; i++) {
            var info = sites[i];
            var siteObj = Game.getObjectById(info.id);
            if (!siteObj) continue; // 工地已消失，下次更新会自然移除

            // 类型优先级（已缓存）
            var priority = info.priority;
            // 距离得分
            var distance = creep.pos.getRangeTo(info.pos.x, info.pos.y);
            var distanceScore = 1 / (distance + 1);
            // 进度得分
            var progressScore = 1 - (info.progress / info.progressTotal);

            var totalScore = priority + (distanceScore * 100) + (progressScore * 50) + (Math.random() * 0.1);
            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestSiteId = info.id;
            }
        }

        return bestSiteId ? Game.getObjectById(bestSiteId) : null;
    },

    // 从缓存中获取最近的能量源（按优先级顺序）
    _getClosestEnergy: function(creep) {
        var room = creep.room;
        this._updateGlobalCache(room);

        var cache = global.builderCache[room.name];
        if (!cache || !cache.energy) return null;

        var energy = cache.energy;

        // 按优先级尝试：容器、storage、link、spawn/ext、terminal、矿
        var candidates = [
            { ids: energy.containers, name: 'container' },
            { ids: energy.storage ? [energy.storage] : [], name: 'storage' },
            { ids: energy.links, name: 'link' },
            { ids: energy.spawnExtensions, name: 'spawnExt' },
            { ids: energy.terminal ? [energy.terminal] : [], name: 'terminal' },
            { ids: energy.minerals, name: 'mineral' }
        ];

        for (var i = 0; i < candidates.length; i++) {
            var ids = candidates[i].ids;
            if (!ids || ids.length === 0) continue;

            var closest = null;
            var minDist = Infinity;
            for (var j = 0; j < ids.length; j++) {
                var obj = Game.getObjectById(ids[j]);
                if (!obj) continue;
                // 对于容器、storage等，需要检查实际能量
                if (candidates[i].name === 'container' && obj.store[RESOURCE_ENERGY] <= 200) continue;
                if (candidates[i].name === 'storage' && obj.store[RESOURCE_ENERGY] <= 1000) continue;
                if (candidates[i].name === 'link' && obj.store[RESOURCE_ENERGY] <= 300) continue;
                if (candidates[i].name === 'spawnExt' && obj.store[RESOURCE_ENERGY] <= 300) continue;
                if (candidates[i].name === 'terminal' && obj.store[RESOURCE_ENERGY] <= 5000) continue;
                // 矿点总是可挖

                var dist = creep.pos.getRangeTo(obj);
                if (dist < minDist) {
                    minDist = dist;
                    closest = obj;
                }
            }
            if (closest) return closest;
        }
        return null;
    },

    /** @param {Creep} creep **/
    run: function(creep) {
        // 状态切换
        if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.building = false;
            delete creep.memory.upgrading;
        }
        if (!creep.memory.building && creep.store.getFreeCapacity() === 0) {
            creep.memory.building = true;
        }

        if (creep.memory.building) {
            // 建造阶段
            var target = this._getBestSiteForCreep(creep);
            if (target) {
                delete creep.memory.upgrading;
                if (creep.build(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 8, maxOps: 1000 });
                }
                creep.say('🔨建造');
                return;
            }
            
            // 无工地时升级
            creep.memory.upgrading = true;
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#9900ff' }, reusePath: 15, maxOps: 500 });
            }
            creep.say('⬆️升级');
        } else {
            // 取能阶段
            var source = this._getClosestEnergy(creep);
            if (source) {
                if (source.structureType) {
                    // 结构物：取能量
                    if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 8, maxOps: 800 });
                    }
                } else {
                    // 矿点：挖矿
                    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, { visualizePathStyle: { stroke: '#ffff00' }, reusePath: 12, maxOps: 500 });
                    }
                }
                creep.say('⚡取能');
            } else {
                // 实在没能量，尝试挖最近矿
                var sources = creep.room.find(FIND_SOURCES_ACTIVE);
                if (sources.length > 0) {
                    var s = creep.pos.findClosestByRange(sources);
                    if (s && creep.harvest(s) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(s, { visualizePathStyle: { stroke: '#ffff00' }, reusePath: 12, maxOps: 500 });
                    }
                    creep.say('⛏️挖矿');
                }
            }
        }
    }
};

module.exports = roleBuilder;