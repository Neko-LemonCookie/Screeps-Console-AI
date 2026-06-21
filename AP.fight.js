/**
 * AP.fight.js - 战斗决策模块
 *
 * 核心职责：
 * - 实时敌情检测与威胁评估
 * - 分级防御响应（Low/Medium/High/Critical）
 * - 协调AttackerI部署
 */

const APFight = {
    THREAT_LEVELS: { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 },

    CONFIG: {
        ENEMY_THRESHOLDS: { MEDIUM: 1, HIGH: 3, CRITICAL: 5 },
        DEFENDER_COUNT: { MEDIUM: 2, HIGH: 4, CRITICAL: 6 },
        EMERGENCY_MODE_DURATION: 1000,
        COOLDOWN_BETWEEN_DEPLOYMENTS: 50,
        MIN_RCL_FOR_DEFENSE: 4,           // RCL ≤ 3 不启用常规防御
        BIG_HOSTILE_BODY_MIN: 10,         // 单个敌人体部件数 ≥ 此值视为大块头
        SAFE_MODE_COOLDOWN: 20000,        // 安全模式尝试冷却（避免反复调用）
        SAFE_MODE_MAX_ROOMS: 1            // 仅拥有 ≤ 此数量房间时才启用安全模式
    },

    run: function() {
        // 统计拥有的房间数量
        let ownedRoomCount = 0;
        for (const rn in Game.rooms) {
            const r = Game.rooms[rn];
            if (r.controller && r.controller.my) ownedRoomCount++;
        }

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            const rcl = room.controller.level;

            // RCL ≤ 3：尝试安全模式保护（不启用常规防御）
            if (rcl < this.CONFIG.MIN_RCL_FOR_DEFENSE) {
                this._trySafeMode(room, ownedRoomCount);
                continue;
            }

            const threatLevel = this._assessThreats(room);

            switch (threatLevel) {
                case this.THREAT_LEVELS.LOW:
                    break;

                case this.THREAT_LEVELS.MEDIUM:
                    this._deployDefenders(room, this.CONFIG.DEFENDER_COUNT.MEDIUM);
                    break;

                case this.THREAT_LEVELS.HIGH:
                    this._emergencyMode(room);
                    this._deployDefenders(room, this.CONFIG.DEFENDER_COUNT.HIGH);
                    break;

                case this.THREAT_LEVELS.CRITICAL:
                    this._criticalMode(room);
                    this._deployDefenders(room, this.CONFIG.DEFENDER_COUNT.CRITICAL);
                    break;
            }

            // 记录威胁等级
            if (!room.memory.threat) room.memory.threat = {};
            room.memory.threat.level = threatLevel;
            room.memory.threat.lastAssess = Game.time;
        }
    },

    /**
     * 低RCL安全模式保护
     * RCL ≤ 3 且只有一个房间时，遇到有威胁的敌人自动启动安全模式
     */
    _trySafeMode: function(room, ownedRoomCount) {
        // 仅拥有少量房间时才启用（避免浪费安全模式）
        if (ownedRoomCount > this.CONFIG.SAFE_MODE_MAX_ROOMS) return;

        // 冷却检查
        if (!room.memory.safeMode) room.memory.safeMode = {};
        const lastTry = room.memory.safeMode.lastTry || 0;
        if (Game.time - lastTry < this.CONFIG.SAFE_MODE_COOLDOWN) return;

        // 检查是否有敌人
        const enemies = room.find(FIND_HOSTILE_CREEPS, {
            filter: creep => !creep.owner.friend
        });
        if (enemies.length === 0) return;

        // 检查敌人是否有威胁部件（ATTACK / RANGED_ATTACK / WORK）
        let hasThreat = false;
        for (const enemy of enemies) {
            if (enemy.getActiveBodyparts(ATTACK).length > 0 ||
                enemy.getActiveBodyparts(RANGED_ATTACK).length > 0 ||
                enemy.getActiveBodyparts(WORK).length > 0) {
                hasThreat = true;
                break;
            }
        }
        if (!hasThreat) return;

        // 尝试启动安全模式
        const result = room.controller.activateSafeMode();
        room.memory.safeMode.lastTry = Game.time;

        if (result === OK) {
            console.log("[Fight] 🛡️ 安全模式已启动: " + room.name +
                       " (RCL" + room.controller.level +
                       ", 敌人: " + enemies.length + ")");
        } else {
            if (Game.time % 100 === 0) {
                console.log("[Fight] ⚠️ 安全模式启动失败: " + room.name +
                           " 错误码: " + result);
            }
        }
    },

    /**
     * 评估房间威胁等级
     */
    _assessThreats: function(room) {
        const enemies = room.find(FIND_HOSTILE_CREEPS, {
            filter: creep => !creep.owner.friend
        });

        if (enemies.length === 0) return this.THREAT_LEVELS.LOW;

        // 检查是否有大块头（10+ 部件）
        let hasBigHostile = false;
        let attackingCount = 0;
        for (const enemy of enemies) {
            if (enemy.body.length >= this.CONFIG.BIG_HOSTILE_BODY_MIN) hasBigHostile = true;
            if (this._isAttackingStructure(enemy, room)) attackingCount++;
        }

        // 不足3个 且 没有大块头 → 不管（侦察兵而已）
        if (enemies.length < 3 && !hasBigHostile) return this.THREAT_LEVELS.LOW;

        if (enemies.length >= this.CONFIG.ENEMY_THRESHOLDS.CRITICAL ||
            attackingCount >= this.CONFIG.ENEMY_THRESHOLDS.CRITICAL) {
            return this.THREAT_LEVELS.CRITICAL;
        } else if (enemies.length >= this.CONFIG.ENEMY_THRESHOLDS.HIGH ||
                   attackingCount >= this.CONFIG.ENEMY_THRESHOLDS.HIGH) {
            return this.THREAT_LEVELS.HIGH;
        }

        return this.THREAT_LEVELS.MEDIUM;
    },

    /**
     * 判断敌军是否在攻击建筑
     */
    _isAttackingStructure: function(enemy, room) {
        const nearbyStructures = enemy.pos.findInRange(FIND_STRUCTURES, 3);
        const importantTypes = [STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_SPAWN, STRUCTURE_STORAGE, STRUCTURE_TERMINAL];

        for (const s of nearbyStructures) {
            if (importantTypes.indexOf(s.structureType) !== -1) {
                if (enemy.getActiveBodyparts(ATTACK).length > 0 ||
                    enemy.getActiveBodyparts(RANGED_ATTACK).length > 0 ||
                    enemy.getActiveBodyparts(WORK).length > 0) {
                    return true;
                }
            }
        }
        return false;
    },

    /**
     * 部署防御者
     */
    _deployDefenders: function(room, count) {
        const taskboard = require('lib.AP.taskboard');

        const lastDeploy = room.memory.lastDefenseDeploy || 0;
        if (Game.time - lastDeploy < this.CONFIG.COOLDOWN_BETWEEN_DEPLOYMENTS) return;

        const currentAttackers = this._countCreepsByModel(room, 'AttackerI');
        const deficit = count - currentAttackers;

        if (deficit <= 0) return;

        taskboard.strategy.needCreeps(room.name, {
            model: 'AttackerI',
            count: Math.min(deficit, 3),
            priority: 'attack',
            data: { mode: 'defend', targetRoom: room.name, urgency: true }
        });

        room.memory.lastDefenseDeploy = Game.time;

        if (Game.time % 10 === 0) {
            console.log("[Fight] 🛡️ 部署防御: " + room.name + " 需要+" + deficit + " AttackerI" +
                       " (威胁: " + this._getThreatName(room.memory.threat.level) + ")");
        }
    },

    _emergencyMode: function(room) {
        if (!room.memory.emergency) room.memory.emergency = {};
        room.memory.emergency.active = true;
        room.memory.emergency.since = Game.time;
    },

    _criticalMode: function(room) {
        this._emergencyMode(room);
        console.log("[Fight] 🚨 关键危机: " + room.name + " 遭受大规模入侵！");
    },

    _countCreepsByModel: function(room, model) {
        let c = 0;
        for (const creep of room.find(FIND_MY_CREEPS)) { if (creep.memory.model === model) c++; }
        return c;
    },

    _getThreatName: function(level) { return { 0:'LOW', 1:'MEDIUM', 2:'HIGH', 3:'CRITICAL' }[level] || 'UNKNOWN'; }
};

module.exports = APFight;
