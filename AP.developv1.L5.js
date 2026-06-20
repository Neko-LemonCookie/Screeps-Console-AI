/**
 * AP.developv1.L5.js - RCL 5-6 策略 (大房间中期)
 * 特征：有Storage、无Terminal(RCL6)/无Lab(RCL6)、引入CarrierI专职运输
 * RCL 5: energyCapacity=1800, 可建30个Extension
 * RCL 6: energyCapacity=2300, 解锁Terminal/Lab x1/Extractor
 */

const DevelopV1_L5 = {
    CONFIG: {
        REFRESH_INTERVAL: 100,
        CREEP_CONFIG: {
            CommonI: { minCount: 3, maxCount: 5, bodySize: 'medium', priorities: ['harvest','build','upgrade','repair','carry'] },
            CarrierI: { minCount: 2, maxCount: 4, bodySize: 'medium', priorities: ['carry','globalcarry'] }
        },
        RESOURCE_POLICY: {
            enableMarket: false,
            sellThreshold: { energy: 100000, U: 5000, O: 5000, H: 3000, Z: 2000, K: 2000, L: 2000 },
            keepReserve: { energy: 20000 }
        }
    },

    run: function(room) {
        try {
            const state = this.analyze(room);
            if (!this._shouldRefresh(room)) return;
            this._publishCreepNeeds(room, state);
            this._manageResources(room, state);
            this._checkMilestone(room, state);
        } catch (e) { console.log("[DevelopV1-L5] ERROR:", e.message); }
    },

    analyze: function(room) {
        const creeps = this._countCreepsByModel(room);
        return Object.assign(this._baseAnalyze(room), {
            storageLevel: room.storage ? (room.storage.store[RESOURCE_ENERGY] || 0) : 0,
            // Terminal和Lab在RCL6才解锁，RCL5时这两个值始终为0/false（无害但保留以便RCL6复用）
            terminalAvailable: room.controller.level >= 6 ? !!room.terminal : false,
            labCount: room.controller.level >= 6 ? room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB }).length : 0
        });
    },

    _baseAnalyze: function(room) {
        const creeps = this._countCreepsByModel(room);
        return {
            rcl: room.controller.level, energyAvailable: room.energyAvailable,
            energyCapacity: room.energyCapacityAvailable, creeps: creeps,
            constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            controllerProgress: room.controller.progress / room.controller.progressTotal
        };
    },

    _shouldRefresh: function(room) {
        const last = room.memory.lastStrategyRefresh || 0;
        if (Game.time - last >= this.CONFIG.REFRESH_INTERVAL) { room.memory.lastStrategyRefresh = Game.time; return true; }
        return false;
    },

    _publishCreepNeeds: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        // CommonI
        const curCommon = (state.creeps.CommonI || 0);
        if (curCommon < this.CONFIG.CREEP_CONFIG.CommonI.minCount) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI', count: this.CONFIG.CREEP_CONFIG.CommonI.minCount - curCommon,
                priority: 'harvest', data: { bodySize: this.CONFIG.CREEP_CONFIG.CommonI.bodySize }
            });
        }
        // CarrierI
        if (state.storageLevel > 10000) {
            const curCarrier = (state.creeps.CarrierI || 0);
            if (curCarrier < this.CONFIG.CREEP_CONFIG.CarrierI.minCount) {
                taskboard.strategy.needCreeps(room.name, {
                    model: 'CarrierI', count: this.CONFIG.CREEP_CONFIG.CarrierI.minCount - curCarrier,
                    priority: 'carry', data: { bodySize: this.CONFIG.CREEP_CONFIG.CarrierI.bodySize }
                });
            }
        }
    },

    _manageResources: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        if (this.CONFIG.RESOURCE_POLICY.enableMarket && state.storageLevel > this.CONFIG.RESOURCE_POLICY.sellThreshold.energy) {
            taskboard.strategy.marketAction(room.name, 'sell', RESOURCE_ENERGY, state.storageLevel - this.CONFIG.RESOURCE_POLICY.keepReserve.energy);
        }
        if (state.terminalAvailable && state.storageLevel > 50000) {
            const curCarrier = (state.creeps.CarrierI || 0);
            if (curCarrier < this.CONFIG.CREEP_CONFIG.CarrierI.maxCount) {
                taskboard.strategy.needCreeps(room.name, { model: 'CarrierI', count: 1, priority: 'globalcarry', data: { enableCrossRoom: true } });
            }
        }
    },

    _countCreepsByModel: function(room) {
        const counts = { CommonI: 0, CarrierI: 0, AttackerI: 0, ClaimerI: 0 };
        for (const creep of room.find(FIND_MY_CREEPS)) { if (creep.memory.model && counts[creep.memory.model] !== undefined) counts[creep.memory.model]++; }
        return counts;
    },

    _checkMilestone: function(room, state) {
        if (state.controllerProgress > 0.8 && Game.time % 500 === 0) console.log("[" + room.name + "] [L5] 📈 即将达到RCL7");
    }
};

module.exports = DevelopV1_L5;
