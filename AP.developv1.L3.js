/**
 * AP.developv1.L3.js - RCL 3 策略 (大房间早期)
 * 特征：无Storage、无Container、CommonI自带CARRY运输
 */

const DevelopV1_L3 = {
    CONFIG: {
        REFRESH_INTERVAL: 50,
        CREEP_CONFIG: {
            CommonI: { minCount: 5, maxCount: 5, bodySize: 'small', priorities: ['harvest','upgrade','build','repair'] }
        }
    },

    run: function(room) {
        try {
            // 2 tick 执行一次全部决策，CPU 无压力
            if (Game.time % 2 !== 0) return;
            const state = this.analyze(room);
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

    _publishCreepNeeds: function(room, state) {
        const taskboard = require('lib.AP.taskboard');
        const config = this.CONFIG.CREEP_CONFIG.CommonI;
        const current = state.commonICount;

        const sourceCount = state.sourceCount || 2;
        const harvestCount = 3;
        const upgradeCount = 6;

        // ====== Spawn 需求（只在缺人时创建）======
        if (current < config.minCount) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI', count: config.minCount - current,
                priority: 'harvest', data: { bodySize: config.bodySize, urgent: current < 2, spawnOnly: true }
            });
        } else if (current < config.maxCount && state.constructionSites > 3) {
            taskboard.strategy.needCreeps(room.name, { model: 'CommonI', count: 1, priority: 'build', data: { bodySize: config.bodySize, spawnOnly: true } });
        }

        // ====== 任务分发：直接写入 Creeps 任务板 ======
        this._ensureCreepTasks(taskboard, room.name, 'harvest', harvestCount);
        this._ensureCreepTasks(taskboard, room.name, 'upgrade', upgradeCount);
    },

    _ensureCreepTasks: function(taskboard, roomName, taskType, targetCount) {
        var existing = taskboard.getTasks(roomName, 'Creeps');
        var count = 0;
        for (var i = 0; i < existing.length; i++) {
            if (existing[i].type === taskType) count++;
        }
        var toAdd = targetCount - count;
        for (var j = 0; j < toAdd; j++) {
            taskboard._addTask('Creeps', roomName, taskType, { autoAssign: true });
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
