/**
 * AP.developv1.max.js - RCL 8 Max 终极策略
 * 特征：经济最优化、协调ClaimerI扩张、常备防御
 */

const DevelopV1_Max = {
    CONFIG: {
        REFRESH_INTERVAL: 200,
        CREEP_CONFIG: {
            CommonI: { minCount: 2, maxCount: 3, bodySize: 'max', enableBoost: true },
            CarrierI: { minCount: 4, maxCount: 6, bodySize: 'max', enableBoost: true },
            AttackerI: { minCount: 2, maxCount: 4, bodySize: 'max', enableBoost: true },
            ClaimerI: { minCount: 0, maxCount: 2, bodySize: 'large' }
        },
        EXPANSION: { enableClaim: true, maxRooms: 8, claimInterval: 15000, preferredDistance: { min: 4, max: 6 } }
    },

    run: function(room) {
        try {
            const state = this.analyze(room);
            if (!this._shouldRefresh(room)) return;
            this._publishCreepNeeds(room, state);
            this._optimizeEconomy(room, state);
            this._evaluateExpansion(room, state);
        } catch (e) { console.log("[DevelopV1-Max] ERROR:", e.message); }
    },

    analyze: function(room) {
        const creeps = this._countCreepsByModel(room);
        return {
            rcl: room.controller.level, energyAvailable: room.energyAvailable,
            energyCapacity: room.energyCapacityAvailable,
            storageEnergy: room.storage ? (room.storage.store[RESOURCE_ENERGY] || 0) : 0,
            creeps: creeps, myRoomCount: this._countMyRooms(),
            constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            controllerProgress: room.controller.progress / room.controller.progressTotal,
            gcl: Game.gcl.level, labCount: room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB }).length,
            terminalAvailable: !!room.terminal
        };
    },

    _shouldRefresh: function(room) {
        const last = room.memory.lastStrategyRefresh || 0;
        if (Game.time - last >= this.CONFIG.REFRESH_INTERVAL) { room.memory.lastStrategyRefresh = Game.time; return true; }
        return false;
    },

    _publishCreepNeeds: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        const configs = this.CONFIG.CREEP_CONFIG;
        for (const model in configs) {
            const cfg = configs[model];
            const current = (state.creeps[model] || 0);
            if (current < cfg.minCount) {
                taskboard.strategy.needCreeps(room.name, {
                    model: model, count: cfg.minCount - current,
                    priority: this._getDefaultPriority(model), data: { bodySize: cfg.bodySize, enableBoost: cfg.enableBoost }
                });
            }
        }
    },

    _getDefaultPriority: function(model) { return { CommonI:'harvest', CarrierI:'carry', AttackerI:'attack', ClaimerI:'claim' }[model] || 'harvest'; },

    _optimizeEconomy: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        if (typeof ENABLE_MARKET !== 'undefined' && ENABLE_MARKET && state.storageEnergy > 200000) {
            taskboard.strategy.marketAction(room.name, 'sell', RESOURCE_ENERGY, 50000);
        }
        const carrierCfg = this.CONFIG.CREEP_CONFIG.CarrierI;
        if (state.storageEnergy > 100000 && (state.creeps.CarrierI || 0) < carrierCfg.maxCount) {
            taskboard.strategy.needCreeps(room.name, { model: 'CarrierI', count: 1, priority: 'globalcarry', data: { enableCrossRoom: true } });
        }
    },

    _evaluateExpansion: function(room, state) {
        const policy = this.CONFIG.EXPANSION;
        if (!policy.enableClaim || state.myRoomCount >= policy.maxRooms) return;
        const lastClaim = room.memory.lastClaimAttempt || 0;
        if (Game.time - lastClaim < policy.claimInterval || state.storageEnergy < 100000) return;
        const taskboard = require('lib.AP.taskboard');
        taskboard.strategy.needCreeps(room.name, {
            model: 'ClaimerI', count: 1, priority: 'claim',
            data: { phase: 'scout_and_claim', preferredDistance: policy.preferredDistance }
        });
        room.memory.lastClaimAttempt = Game.time;
        if (Game.time % 1000 === 0) console.log("[" + room.name + "] [Max] 🌍 评估扩张 (房间数: " + state.myRoomCount + "/" + policy.maxRooms + ")");
    },

    _countCreepsByModel: function(room) {
        const counts = { CommonI: 0, CarrierI: 0, AttackerI: 0, ClaimerI: 0 };
        for (const creep of room.find(FIND_MY_CREEPS)) { if (creep.memory.model && counts[creep.memory.model] !== undefined) counts[creep.memory.model]++; }
        return counts;
    },

    _countMyRooms: function() { let c = 0; for (const rn in Game.rooms) { if (Game.rooms[rn].controller && Game.rooms[rn].controller.my) c++; } return c; }
};

module.exports = DevelopV1_Max;
