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
