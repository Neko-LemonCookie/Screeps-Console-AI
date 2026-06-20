/**
 * AP.claim.js - 房间占领决策模块
 *
 * 核心职责：
 * - 评估候选房间的价值（使用calculate_claim WASM模块）
 * - 决定何时发送ClaimerI
 * - 协调占领流程：scout → reserve → claim → build
 */

const APClaim = {
    CONFIG: {
        MIN_RCL_TO_CLAIM: 7,          // 最低RCL才能扩张
        MAX_ROOMS: 8,                  // 最多拥有房间数
        CLAIM_INTERVAL: 15000,        // 两次claim间隔(tick)
        PREFERRED_DISTANCE: { min: 4, max: 8 },
        MIN_SCORE_THRESHOLD: 50,      // 最低评分阈值
        MIN_GCL_TO_CLAIM: 3,          // 最低GCL等级才允许扩张（GCL1=只能1个房间，GCL2=2个...）
        MAX_CPU_RATIO: 0.75           // CPU使用率超过此值时暂停扩张（避免新房间拖垮性能）
    },

    run: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];

            if (!room.controller || !room.controller.my) continue;
            if (room.controller.level < this.CONFIG.MIN_RCL_TO_CLAIM) continue;

            this._runRoom(room);
        }

        // 新房间经济启动检查（每tick对所有房间执行一次，O(N) 而非 O(N²)）
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;
            if (room.storage && room.terminal) {
                this._bootstrapNewRoom(room.name);
            }
        }
    },

    _runRoom: function(room) {
        // 1. 检查是否已达房间上限
        const myRoomCount = this._countMyRooms();
        if (myRoomCount >= this.CONFIG.MAX_ROOMS) {
            if (Game.time % 5000 === 0) {
                console.log("[Claim] 🚫 达到房间上限: " + myRoomCount + "/" + this.CONFIG.MAX_ROOMS);
            }
            return;
        }

        // 2. 【新增】检查GCL等级是否足够支撑新房间
        const gcl = Game.gcl ? Game.gcl.level : 1;
        if (gcl < this.CONFIG.MIN_GCL_TO_CLAIM) {
            if (Game.time % 10000 === 0) {
                console.log("[Claim] ⏸️ GCL不足，暂停扩张: GCL " + gcl + " < " + this.CONFIG.MIN_GCL_TO_CLAIM);
            }
            return;
        }

        // 3. 【新增】检查CPU使用率是否有余量
        const cpuUsed = Game.cpu ? (Game.cpu.limit > 0 ? Game.cpu.used / Game.cpu.limit : 0) : 0;
        if (cpuUsed > this.CONFIG.MAX_CPU_RATIO) {
            if (Game.time % 5000 === 0) {
                console.log("[Claim] ⚠️ CPU使用率过高 (" + (cpuUsed * 100).toFixed(0) + "%)，暂停扩张");
            }
            return;
        }

        // 4. 检查距离上次claim的时间
        const lastClaim = room.memory.lastClaimAttempt || 0;
        if (Game.time - lastClaim < this.CONFIG.CLAIM_INTERVAL) return;

        // 5. 评估能量是否充足
        const storageEnergy = room.storage ? (room.storage.store[RESOURCE_ENERGY] || 0) : 0;
        if (storageEnergy < 80000) return;  // 能量不足

        // 6. 寻找最佳候选房间
        const candidate = this._findBestCandidate(room);

        if (candidate) {
            this._dispatchClaimer(room, candidate);
            room.memory.lastClaimAttempt = Game.time;
        }

        // 【新增】检查本房间是否是新claim成功的，需要启动经济
        if (room.storage && room.terminal) {
            this._bootstrapNewRoom(room.name);
        }
    },

    /**
     * 寻找最佳候选房间
     */
    _findBestCandidate: function(sourceRoom) {
        let calculate_claim;
        try { calculate_claim = require('lib.AP.calculate_claim'); } catch(e) { calculate_claim = null; }

        const candidates = this._getCandidateRooms(sourceRoom);
        if (candidates.length === 0) return null;

        let bestCandidate = null;
        let bestScore = -Infinity;

        for (const candidate of candidates) {
            try {
                let score;
                if (calculate_claim && typeof calculate_claim.scoreRoom === 'function') {
                    score = calculate_claim.scoreRoom(candidate);
                } else {
                    score = this._simpleScore(candidate);
                }

                // 距离惩罚
                const distance = this._estimateDistance(sourceRoom.name, candidate.name);
                if (distance < this.CONFIG.PREFERRED_DISTANCE.min ||
                    distance > this.CONFIG.PREFERRED_DISTANCE.max) {
                    score *= 0.7;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = candidate;
                }
            } catch (e) {
                console.log("[Claim] WARN: 评分失败: " + candidate.name, e.message);
            }
        }

        return (bestCandidate && bestScore >= this.CONFIG.MIN_SCORE_THRESHOLD) ? bestCandidate : null;
    },

    /**
     * 派遣ClaimerI
     */
    _dispatchClaimer: function(sourceRoom, targetRoom) {
        const taskboard = require('lib.AP.taskboard');

        taskboard.strategy.needCreeps(sourceRoom.name, {
            model: 'ClaimerI',
            count: 1,
            priority: 'claim',
            data: {
                targetRoom: targetRoom.name,
                phase: 'claim',
                score: targetRoom.score || 0,
                escortNeeded: true
            }
        });

        console.log("[Claim] 🚀 派遣ClaimerI: " + sourceRoom.name + " → " + targetRoom.name);
    },

    /**
     * 新房间经济启动：检测到刚claim的新房间时，自动卖出第一笔energy启动Terminal
     * 触发条件：房间有Terminal且storage能量>50000但terminal能量<10000
     * @param {string} roomName 新房间名
     * @private
     */
    _bootstrapNewRoom: function(roomName) {
        var room = Game.rooms[roomName];
        if (!room) return;
        if (!room.terminal || !room.storage) return;

        var storageEnergy = room.storage.store[RESOURCE_ENERGY] || 0;
        var terminalEnergy = room.terminal.store[RESOURCE_ENERGY] || 0;

        // 条件：Storage有足够能量但Terminal几乎是空的 → 需要首单启动
        if (storageEnergy > 50000 && terminalEnergy < 10000) {
            // 只在首次触发时执行（用memory标记防重复）
            if (!room.memory.bootstrapInitiated) {
                room.memory.bootstrapInitiated = Game.time;

                // 尝试卖出一笔energy（少量即可启动市场账户）
                var sellAmount = Math.min(storageEnergy * 0.1, 20000);  // 卖10%或最多20k

                // 发布市场任务到Strategy
                var taskboard = require('lib.AP.taskboard');
                taskboard.strategy.marketAction(roomName, 'sell', RESOURCE_ENERGY, sellAmount);

                console.log("[Claim] 💰 新房间启动首单: " + roomName +
                           " 卖出 " + sellAmount + " energy 启动Terminal经济");
            } else if (Game.time - room.memory.bootstrapInitiated > 5000) {
                // 如果5k tick后terminal还是没钱，可能市场没成交，再试一次
                if (terminalEnergy < 5000) {
                    console.log("[Claim] ⚠️ " + roomName + " Terminal仍缺资金，检查市场是否开启");
                }
            }
        }
    },

    /**
     * 获取候选房间列表（从Memory缓存）
     */
    _getCandidateRooms: function(sourceRoom) {
        const candidates = sourceRoom.memory.claimCandidates || [];
        return candidates.filter(c => {
            const room = Game.rooms[c.name];
            return !room || !room.controller || !room.controller.my;
        });
    },

    /**
     * 简单评分备用方案
     */
    _simpleScore: function(candidate) {
        let score = 50;
        if (candidate.sourceCount >= 2) score += 20;
        else if (candidate.sourceCount === 1) score += 10;
        if (candidate.isSwampHeavy) score -= 10;
        return score;
    },

    /**
     * 估算房间距离（曼哈顿距离）
     */
    _estimateDistance: function(roomName1, roomName2) {
        const p1 = this._parseRoomPosition(roomName1);
        const p2 = this._parseRoomPosition(roomName2);
        if (!p1 || !p2) return 999;
        return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
    },

    _parseRoomPosition: function(roomName) {
        const match = roomName.match(/^([WE])(\d+)([NS])(\d+)$/);
        if (!match) return null;
        return {
            x: match[1] === 'E' ? parseInt(match[2]) : -parseInt(match[2]),
            y: match[3] === 'N' ? parseInt(match[4]) : -parseInt(match[4])
        };
    },

    _countMyRooms: function() {
        let c = 0;
        for (const rn in Game.rooms) { if (Game.rooms[rn].controller && Game.rooms[rn].controller.my) c++; }
        return c;
    }
};

module.exports = APClaim;
