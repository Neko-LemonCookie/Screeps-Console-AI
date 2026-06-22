/**
 * AP.developv1.L3.js - RCL 3 策略 (大房间早期)
 * 特征：无Storage、无Container、CommonI自带CARRY运输
 */

const DevelopV1_L3 = {
    CONFIG: {
        REFRESH_INTERVAL: 50,
        CREEP_CONFIG: {
            CommonI: { minCount: 5, maxCount: 15, bodySize: 'small', priorities: ['harvest','upgrade','build','repair'] }
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
        const harvestCount = 3;  // 收获者保底3个
        const baseUpgradeCount = 6;
        const buildQuota = Math.floor(baseUpgradeCount / 2);  // 从upgrade拿一半作为建造者必须额度

        // 根据是否有工地动态分配upgrade和build的额度
        let upgradeCount, buildCount;
        if (state.constructionSites > 0) {
            // 有工地：建造者占一半额度
            buildCount = buildQuota;
            upgradeCount = baseUpgradeCount - buildQuota;
        } else {
            // 没工地：建造者额度全部还给升级者
            buildCount = 0;
            upgradeCount = baseUpgradeCount;
        }

        // ====== Spawn 需求（只在缺人时创建）======
        if (current < config.minCount) {
            taskboard.strategy.needCreeps(room.name, {
                model: 'CommonI', count: config.minCount - current,
                priority: 'harvest', data: { bodySize: config.bodySize, urgent: current < 2 }
            });
        } else if (current < config.maxCount && state.constructionSites > 3) {
            taskboard.strategy.needCreeps(room.name, { model: 'CommonI', count: 1, priority: 'build', data: { bodySize: config.bodySize } });
        }

        // ====== 任务分发：直接写入 Creeps 任务板 ======
        this._ensureCreepTasks(taskboard, room.name, 'harvest', harvestCount);
        this._ensureCreepTasks(taskboard, room.name, 'upgrade', upgradeCount);
        if (buildCount > 0) {
            this._ensureCreepTasks(taskboard, room.name, 'build', buildCount);
        }

        // ====== 维修任务：检测受损建筑并发布repair任务 ======
        const towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
        const hasTower = towers.length > 0;
        const repairTaskCount = hasTower ? 1 : 2;

        // 先检测非墙/堡垒的受损建筑（道路、容器、rampart等）
        const damagedNormal = room.find(FIND_STRUCTURES, {
            filter: s => s.hits < s.hitsMax &&
                      s.structureType !== STRUCTURE_WALL &&
                      s.structureType !== STRUCTURE_RAMPART
        });
        // 再检测墙/堡垒（低血量的优先修）
        const damagedWalls = room.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) &&
                      s.hits < (s.structureType === STRUCTURE_RAMPART ? 10000 : 10000)
        });

        if (damagedNormal.length > 0 || damagedWalls.length > 0) {
            this._ensureCreepTasks(taskboard, room.name, 'repair', repairTaskCount);
        }
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
