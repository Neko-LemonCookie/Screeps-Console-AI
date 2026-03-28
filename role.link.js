// role.link.js - 最小化LINK能量传输管理
var roleLink = {
    /**
     * 添加LINK传输对
     * @param {string} sourceId - 源LINK ID
     * @param {string} targetId - 目标LINK ID
     */
    addLinkPair: function(sourceId, targetId) {
        // 验证ID格式
        if (!sourceId || !targetId || sourceId === targetId) {
            console.log('错误：源LINK和目标LINK不能相同或为空');
            return false;
        }
        
        // 获取LINK对象以验证
        const source = Game.getObjectById(sourceId);
        const target = Game.getObjectById(targetId);
        
        if (!source || source.structureType !== STRUCTURE_LINK) {
            console.log(`错误：源LINK ID ${sourceId} 无效或不是LINK`);
            return false;
        }
        
        if (!target || target.structureType !== STRUCTURE_LINK) {
            console.log(`错误：目标LINK ID ${targetId} 无效或不是LINK`);
            return false;
        }
        
        // 检查是否在同一个房间
        if (source.room.name !== target.room.name) {
            console.log('错误：源LINK和目标LINK必须在同一个房间');
            return false;
        }
        
        // 检查距离是否在10格内
        const distance = source.pos.getRangeTo(target);
        if (distance > 10) {
            console.log(`错误：LINK距离为 ${distance}，超过10格最大范围`);
            return false;
        }
        
        // 初始化内存配置
        if (!Memory.linkPairs) {
            Memory.linkPairs = [];
        }
        
        // 检查是否已存在相同的传输对
        const existingPair = Memory.linkPairs.find(pair => 
            pair.sourceId === sourceId && pair.targetId === targetId
        );
        
        if (existingPair) {
            console.log(`提示：传输对 ${sourceId} -> ${targetId} 已存在`);
            return true;
        }
        
        // 添加新传输对
        Memory.linkPairs.push({
            sourceId: sourceId,
            targetId: targetId,
            addedAt: Game.time
        });
        
        console.log(`成功：添加传输对 ${sourceId} -> ${targetId}（距离: ${distance}）`);
        return true;
    },
    
    /**
     * 执行LINK传输
     */
    manageLinks: function() {
        if (!Memory.linkPairs || Memory.linkPairs.length === 0) {
            return;
        }
        
        // 清理无效的传输对
        this.cleanupInvalidPairs();
        
        // 尝试每个传输对
        for (const pair of Memory.linkPairs) {
            const source = Game.getObjectById(pair.sourceId);
            const target = Game.getObjectById(pair.targetId);
            
            // 确保两个LINK都存在
            if (!source || !target) continue;
            
            // 检查源LINK是否在冷却中
            if (source.cooldown && source.cooldown > 0) continue;
            
            // 检查源LINK是否有能量（至少20）
            if (source.store[RESOURCE_ENERGY] < 20) continue;
            
            // 计算传输量（最多传输800）
            const transferAmount = Math.min(
                source.store[RESOURCE_ENERGY],
                target.store.getCapacity(RESOURCE_ENERGY) - target.store[RESOURCE_ENERGY],
                800
            );
            
            // 如果有可传输的能量
            if (transferAmount > 0) {
                const result = source.transferEnergy(target, transferAmount);
                
                // 只记录非冷却错误的传输失败
                if (result !== OK && result !== ERR_TIRED && result !== ERR_NOT_ENOUGH_RESOURCES) {
                    console.log(`传输失败 ${source.id} -> ${target.id}: ${result}`);
                }
            }
        }
    },
    
    /**
     * 清理无效的传输对
     */
    cleanupInvalidPairs: function() {
        if (!Memory.linkPairs) return;
        
        // 过滤掉无效的传输对
        const validPairs = [];
        for (const pair of Memory.linkPairs) {
            const source = Game.getObjectById(pair.sourceId);
            const target = Game.getObjectById(pair.targetId);
            
            if (source && source.structureType === STRUCTURE_LINK &&
                target && target.structureType === STRUCTURE_LINK) {
                validPairs.push(pair);
            }
        }
        
        // 更新内存
        Memory.linkPairs = validPairs;
    },
    
    /**
     * 显示所有传输对
     */
    showAllPairs: function() {
        if (!Memory.linkPairs || Memory.linkPairs.length === 0) {
            console.log('没有配置LINK传输对');
            return;
        }
        
        console.log(`共 ${Memory.linkPairs.length} 个传输对:`);
        Memory.linkPairs.forEach((pair, index) => {
            const source = Game.getObjectById(pair.sourceId);
            const target = Game.getObjectById(pair.targetId);
            
            if (source && target) {
                console.log(`${index + 1}. ${pair.sourceId} -> ${pair.targetId} (${source.room.name})`);
            } else {
                console.log(`${index + 1}. ${pair.sourceId} -> ${pair.targetId} (无效)`);
            }
        });
    },
    
    /**
     * 设置全局函数
     */
    setupGlobalFunctions: function() {
        // 添加传输对
        global.setlink = (sourceId, targetId) => {
            return this.addLinkPair(sourceId, targetId);
        };
        
        // 显示所有传输对
        global.showlinks = () => {
            this.showAllPairs();
        };
    },
    
    /**
     * 运行LINK管理系统
     */
    run: function() {
        // 设置全局函数（只在第一次运行时设置）
        if (!global.setlink) {
            this.setupGlobalFunctions();
        }
        
        // 执行传输管理
        this.manageLinks();
    }
};

module.exports = roleLink;