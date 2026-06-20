/**
 * building.link.js
 * 最小化 LINK 能量传输管理
 * 保持原有逻辑，重构代码风格以匹配新系统。
 */

module.exports = {
    /**
     * 运行指定房间的 LINK 传输
     * @param {Room} room 
     */
    run: function(room) {
        // 设置全局函数 (仅在第一次运行时，方便控制台操作)
        if (!global.setlink) this._setupGlobal();

        // 【新增】自动发现未配对的Link并尝试配对
        this._autoPairLinks(room);

        const roomName = room.name;
        if (!Memory.linkPairs || Memory.linkPairs.length === 0) return;

        // 执行该房间所属的传输对
        this._manageLinks(roomName);

        // 每 100 tick 清理一次无效传输对
        if (Game.time % 100 === 0) {
            this._cleanupInvalidPairs(roomName);
        }
    },

    /**
     * 添加 LINK 传输对
     * @param {string} sourceId 
     * @param {string} targetId 
     */
    addLinkPair: function(sourceId, targetId) {
        if (!sourceId || !targetId || sourceId === targetId) {
            console.log('[Link] ❌ Error: 源和目标不能相同或为空');
            return false;
        }
        
        const source = Game.getObjectById(sourceId);
        const target = Game.getObjectById(targetId);
        
        if (!source || source.structureType !== STRUCTURE_LINK ||
            !target || target.structureType !== STRUCTURE_LINK) {
            console.log('[Link] ❌ Error: 无效的 LINK ID');
            return false;
        }
        
        if (source.room.name !== target.room.name) {
            console.log('[Link] ❌ Error: 必须在同一个房间');
            return false;
        }
        
        if (source.pos.getRangeTo(target) > 11) { // 稍微放宽一点点范围
            console.log('[Link] ❌ Error: 距离过远');
            return false;
        }
        
        if (!Memory.linkPairs) Memory.linkPairs = [];
        
        const exists = Memory.linkPairs.some(p => p.sourceId === sourceId && p.targetId === targetId);
        if (exists) {
            console.log('[Link] ℹ️ Info: 传输对已存在');
            return true;
        }
        
        Memory.linkPairs.push({
            sourceId: sourceId,
            targetId: targetId,
            roomName: source.room.name,
            addedAt: Game.time
        });
        
        console.log(`[Link] ✅ Success: 添加传输对 ${sourceId} -> ${targetId}`);
        return true;
    },

    /**
     * 执行传输管理
     * @private
     */
    _manageLinks: function(roomName) {
        const pairs = Memory.linkPairs.filter(p => p.roomName === roomName);
        
        for (const pair of pairs) {
            const source = Game.getObjectById(pair.sourceId);
            const target = Game.getObjectById(pair.targetId);
            
            if (!source || !target) continue;
            if (source.cooldown > 0) continue;
            if (source.store[RESOURCE_ENERGY] < 20) continue;
            
            const space = target.store.getFreeCapacity(RESOURCE_ENERGY);
            if (space <= 0) continue;

            const amount = Math.min(source.store[RESOURCE_ENERGY], space, 800);
            if (amount > 0) {
                source.transferEnergy(target, amount);
            }
        }
    },

    /**
     * 清理无效对
     * @private
     */
    _cleanupInvalidPairs: function(roomName) {
        if (!Memory.linkPairs) return;
        Memory.linkPairs = Memory.linkPairs.filter(pair => {
            // 如果不是本房间的，保留
            if (pair.roomName !== roomName) return true;
            // 如果是本房间的，检查对象是否存在
            const source = Game.getObjectById(pair.sourceId);
            const target = Game.getObjectById(pair.targetId);
            return !!(source && target);
        });
    },

    /**
     * 自动发现房间内未配对的Link并配对
     * 规则：靠近Source的Link作为源端，靠近Storage的Link作为接收端
     * @private
     */
    _autoPairLinks: function(room) {
        var links = room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_LINK; }
        });

        if (links.length < 2) return;  // 至少需要2个Link才能配对

        // 获取参考点
        var sources = room.find(FIND_SOURCES);
        var storagePos = room.storage ? room.storage.pos :
                         (room.terminal ? room.terminal.pos : room.controller.pos);

        // 分类Link：靠近Source的为源端，其余为接收端
        var sourceLinks = [];   // 靠近Source的Link
        var receiverLinks = []; // 其他Link（应该靠近Storage）

        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var nearSource = false;
            for (var si = 0; si < sources.length; si++) {
                if (link.pos.getRangeTo(sources[si].pos) <= 3) {
                    nearSource = true;
                    break;
                }
            }

            if (nearSource) {
                sourceLinks.push(link);
            } else {
                receiverLinks.push(link);
            }
        }

        // 配对：每个源端Link找最近的接收端Link
        for (var sl = 0; sl < sourceLinks.length; sl++) {
            var sLink = sourceLinks[sl];

            // 检查是否已配对
            var alreadyPaired = false;
            if (Memory.linkPairs) {
                for (var pi = 0; pi < Memory.linkPairs.length; pi++) {
                    if (Memory.linkPairs[pi].sourceId === sLink.id) {
                        alreadyPaired = true;
                        break;
                    }
                }
            }
            if (alreadyPaired) continue;

            // 找最近的接收端Link
            var bestReceiver = null;
            var bestRange = Infinity;
            for (var rl = 0; rl < receiverLinks.length; rl++) {
                var rLink = receiverLinks[rl];
                var range = sLink.pos.getRangeTo(rLink);
                if (range <= 10 && range < bestRange) {  // Link最大范围10格
                    // 检查接收端是否已被占用
                    var receiverUsed = false;
                    if (Memory.linkPairs) {
                        for (var pi2 = 0; pi2 < Memory.linkPairs.length; pi2++) {
                            if (Memory.linkPairs[pi2].targetId === rLink.id) {
                                receiverUsed = true;
                                break;
                            }
                        }
                    }
                    if (!receiverUsed) {
                        bestRange = range;
                        bestReceiver = rLink;
                    }
                }
            }

            if (bestReceiver) {
                this.addLinkPair(sLink.id, bestReceiver.id);
            }
        }
    },

    /**
     * 设置全局辅助函数
     * @private
     */
    _setupGlobal: function() {
        global.setlink = (s, t) => this.addLinkPair(s, t);
        global.showlinks = () => {
            if (!Memory.linkPairs || Memory.linkPairs.length === 0) {
                console.log('[Link] 没有配置任何传输对');
                return;
            }
            Memory.linkPairs.forEach((p, i) => {
                console.log(`${i+1}. [${p.roomName}] ${p.sourceId} -> ${p.targetId}`);
            });
        };
    }
};
