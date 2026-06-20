/**
 * AP.developv1.L7.js - RCL 7 策略 (大房间后期)
 * 特征：Boost Creep、精简数量但个体极强、基础防御
 */

const DevelopV1_L7 = {
    CONFIG: {
        REFRESH_INTERVAL: 150,
        CREEP_CONFIG: {
            CommonI: { minCount: 2, maxCount: 3, bodySize: 'large', enableBoost: true, boostResource: 'XUH2O' },
            CarrierI: { minCount: 3, maxCount: 5, bodySize: 'large', enableBoost: true, boostResource: 'XKH2O' },
            AttackerI: { minCount: 0, maxCount: 3, bodySize: 'large', enableBoost: true }
        }
        // 注意：Lab建造由模板自动完成(building.lab.js管理反应配方)，
        //       Boost生产执行由building.lab.js负责，
        //       决策AI只需在Creep配置中标记enableBoost即可
    },

    run: function(room) {
        try {
            const state = this.analyze(room);
            if (!this._shouldRefresh(room)) return;
            this._publishCreepNeeds(room, state);
            this._checkMilestone(room, state);
        } catch (e) { console.log("[DevelopV1-L7] ERROR:", e.message); }
    },

    analyze: function(room) {
        const creeps = this._countCreepsByModel(room);
        return {
            rcl: room.controller.level, energyAvailable: room.energyAvailable,
            energyCapacity: room.energyCapacityAvailable,
            storageEnergy: room.storage ? (room.storage.store[RESOURCE_ENERGY] || 0) : 0,
            creeps: creeps, constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            controllerProgress: room.controller.progress / room.controller.progressTotal,
            terminalAvailable: !!room.terminal, factoryAvailable: !!room.factory
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
        // CommonI
        const commonCfg = configs.CommonI;
        const curCommon = (state.creeps.CommonI || 0);
        if (curCommon < commonCfg.minCount) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI', count: commonCfg.minCount - curCommon, priority: 'harvest',
                data: { bodySize: commonCfg.bodySize, enableBoost: commonCfg.enableBoost, boostResource: commonCfg.boostResource }
            });
        }
        // CarrierI
        const carrierCfg = configs.CarrierI;
        const curCarrier = (state.creeps.CarrierI || 0);
        if (curCarrier < carrierCfg.minCount && state.storageEnergy > 20000) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CarrierI', count: carrierCfg.minCount - curCarrier, priority: 'carry',
                data: { bodySize: carrierCfg.bodySize, enableBoost: carrierCfg.enableBoost, boostResource: carrierCfg.boostResource }
            });
        }
    },

    _countCreepsByModel: function(room) {
        const counts = { CommonI: 0, CarrierI: 0, AttackerI: 0, ClaimerI: 0 };
        for (const creep of room.find(FIND_MY_CREEPS)) { if (creep.memory.model && counts[creep.memory.model] !== undefined) counts[creep.memory.model]++; }
        return counts;
    },

    _checkMilestone: function(room, state) {
        if (state.controllerProgress > 0.9 && Game.time % 500 === 0) console.log("[" + room.name + "] [L7] 📈 即将达到RCL8");
    }
};

module.exports = DevelopV1_L7;
