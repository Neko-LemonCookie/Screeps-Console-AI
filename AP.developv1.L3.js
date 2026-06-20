/**
 * AP.developv1.L3.js - RCL 3 策略 (大房间早期)
 * 特征：无Storage、无Container、CommonI自带CARRY运输
 */

const DevelopV1_L3 = {
    CONFIG: {
        REFRESH_INTERVAL: 50,
        CREEP_CONFIG: {
            CommonI: { minCount: 4, maxCount: 6, bodySize: 'small', priorities: ['harvest','upgrade','build','repair'] }
        }
    },

    run: function(room) {
        try {
            const state = this.analyze(room);
            if (!this._shouldRefresh(room)) return;
            this._publishCreepNeeds(room, state);
            this._checkMilestone(room, state);
        } catch (e) { console.log("[DevelopV1-L3] ERROR:", e.message); }
    },

    analyze: function(room) {
        const creeps = this._countCreepsByModel(room);
        return {
            rcl: room.controller.level, energyAvailable: room.energyAvailable,
            energyCapacity: room.energyCapacityAvailable, creeps: creeps,
            commonICount: creeps.CommonI || 0,
            constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            controllerProgress: room.controller.progress / room.controller.progressTotal,
            storageBuilt: !!room.storage, sourceCount: room.find(FIND_SOURCES).length
        };
    },

    _shouldRefresh: function(room) {
        const last = room.memory.lastStrategyRefresh || 0;
        if (Game.time - last >= this.CONFIG.REFRESH_INTERVAL) { room.memory.lastStrategyRefresh = Game.time; return true; }
        return false;
    },

    _publishCreepNeeds: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        const config = this.CONFIG.CREEP_CONFIG.CommonI;
        const current = state.commonICount;
        if (current < config.minCount) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI', count: Math.min(config.minCount - current, 2),
                priority: 'harvest', data: { bodySize: config.bodySize, urgent: current < 2 }
            });
        } else if (current < config.maxCount && state.constructionSites > 3) {
            taskboard.strategy.needCreeps(room.name, { model: 'CommonI', count: 1, priority: 'build', data: { bodySize: config.bodySize } });
        }
    },

    _countCreepsByModel: function(room) {
        const counts = { CommonI: 0, CarrierI: 0, AttackerI: 0, ClaimerI: 0 };
        for (const creep of room.find(FIND_MY_CREEPS)) { if (creep.memory.model && counts[creep.memory.model] !== undefined) counts[creep.memory.model]++; }
        return counts;
    },

    _checkMilestone: function(room, state) {
        if (state.controllerProgress > 0.8 && state.commonICount >= this.CONFIG.CREEP_CONFIG.CommonI.minCount) {
            if (Game.time % 500 === 0) console.log("[" + room.name + "] [L3] 📈 即将达到RCL5");
        }
    }
};

module.exports = DevelopV1_L3;
