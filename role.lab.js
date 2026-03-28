var roleLab = {
    /**
     * 初始化房间LAB内存
     * @param {string} roomName - 房间名称
     */
    initRoomMemory: function(roomName) {
        if (!Memory.Lab) {
            Memory.Lab = {};
        }
        
        if (!Memory.Lab[roomName]) {
            Memory.Lab[roomName] = {
                chains: [],  // LAB链配置
                stats: {
                    lastReaction: 0,
                    totalReactions: 0,
                    lastBoosts: 0,
                    totalBoosts: 0
                }
            };
        }
        
        return Memory.Lab[roomName];
    },
    
    /**
     * 配置LAB链
     * @param {string} lab1Id - 原料供应1 LAB ID
     * @param {string} lab2Id - 原料供应2 LAB ID
     * @param {string} targetId - 反应皿 LAB ID
     * @param {boolean} autoBoost - 是否自动boost
     */
    lablink: function(lab1Id, lab2Id, targetId, autoBoost) {
        // 验证ID格式
        if (!lab1Id || !lab2Id || !targetId) {
            console.log('错误：所有LAB ID不能为空');
            return false;
        }
        
        if (lab1Id === lab2Id || lab1Id === targetId || lab2Id === targetId) {
            console.log('错误：LAB ID不能相同');
            return false;
        }
        
        // 获取LAB对象以验证
        const lab1 = Game.getObjectById(lab1Id);
        const lab2 = Game.getObjectById(lab2Id);
        const target = Game.getObjectById(targetId);
        
        // 验证LAB类型
        if (!lab1 || lab1.structureType !== STRUCTURE_LAB) {
            console.log(`错误：LAB1 ID ${lab1Id} 无效或不是LAB`);
            return false;
        }
        
        if (!lab2 || lab2.structureType !== STRUCTURE_LAB) {
            console.log(`错误：LAB2 ID ${lab2Id} 无效或不是LAB`);
            return false;
        }
        
        if (!target || target.structureType !== STRUCTURE_LAB) {
            console.log(`错误：目标LAB ID ${targetId} 无效或不是LAB`);
            return false;
        }
        
        // 检查是否在同一个房间
        const roomName = target.room.name;
        if (lab1.room.name !== roomName || lab2.room.name !== roomName) {
            console.log('错误：所有LAB必须在同一个房间');
            return false;
        }
        
        // 检查距离：原料LAB必须在反应LAB的2格范围内
        const dist1 = target.pos.getRangeTo(lab1);
        const dist2 = target.pos.getRangeTo(lab2);
        
        if (dist1 > 2 || dist2 > 2) {
            console.log(`错误：原料LAB距离反应LAB过远 (${dist1}, ${dist2})，必须在2格内`);
            return false;
        }
        
        // 初始化房间内存
        const roomMemory = this.initRoomMemory(roomName);
        
        // 检查是否已存在相同的配置
        const existingChainIndex = roomMemory.chains.findIndex(function(chain) { 
            return chain.targetId === targetId;
        });
        
        if (existingChainIndex !== -1) {
            // 更新现有配置
            roomMemory.chains[existingChainIndex] = {
                lab1Id: lab1Id,
                lab2Id: lab2Id,
                targetId: targetId,
                autoBoost: !!autoBoost,
                roomName: roomName,
                updatedAt: Game.time
            };
            console.log(`更新：LAB链 ${lab1Id}+${lab2Id}->${targetId}, autoBoost: ${autoBoost}（房间: ${roomName}）`);
        } else {
            // 添加新配置
            roomMemory.chains.push({
                lab1Id: lab1Id,
                lab2Id: lab2Id,
                targetId: targetId,
                autoBoost: !!autoBoost,
                roomName: roomName,
                addedAt: Game.time
            });
            console.log(`成功：添加LAB链 ${lab1Id}+${lab2Id}->${targetId}, autoBoost: ${autoBoost}（房间: ${roomName}）`);
        }
        
        return true;
    },
    
    /**
     * 运行指定房间的LAB管理
     * @param {Room} room - 房间对象
     */
    run: function(room) {
        const roomName = room.name;
        const roomMemory = Memory.Lab && Memory.Lab[roomName];
        
        if (!roomMemory || !roomMemory.chains || roomMemory.chains.length === 0) {
            return;
        }
        
        // 清理无效的配置
        this.cleanupChains(roomName);
        
        // 执行每个LAB链
        for (let i = 0; i < roomMemory.chains.length; i++) {
            const chain = roomMemory.chains[i];
            if (chain.autoBoost) {
                this.manageChainWithAutoBoost(chain);
            } else {
                this.runReaction(chain);
            }
        }
    },
    
    /**
     * 管理自动boost的LAB链
     * @param {Object} chain - LAB链配置
     */
    manageChainWithAutoBoost: function(chain) {
        const targetLab = Game.getObjectById(chain.targetId);
        if (!targetLab) return;
        
        // 检查反应皿是否为空
        const isTargetEmpty = targetLab.store.getUsedCapacity() === 0;
        
        if (isTargetEmpty) {
            // 反应皿为空，进行反应
            this.runReaction(chain);
            return;
        }
        
        // 检查反应皿周围是否有需要强化的creep
        const creepsNearby = targetLab.pos.findInRange(FIND_MY_CREEPS, 1);
        const creepNeedsBoost = creepsNearby.find(creep => {
            // 检查creep是否需要强化
            for (let part of creep.body) {
                if (!part.boost && ['WORK', 'ATTACK', 'RANGED_ATTACK', 'HEAL', 'CARRY', 'MOVE', 'TOUGH'].includes(part.type)) {
                    return true;
                }
            }
            return false;
        });
        
        if (creepNeedsBoost) {
            // 有需要强化的creep，尝试强化
            this.tryBoostCreep(creepNeedsBoost, targetLab, chain.roomName);
        } else {
            // 没有需要强化的creep，进行反应
            this.runReaction(chain);
        }
    },
    
    /**
     * 执行反应
     * @param {Object} chain - LAB链配置
     */
    runReaction: function(chain) {
        // 获取LAB对象
        const lab1 = Game.getObjectById(chain.lab1Id);
        const lab2 = Game.getObjectById(chain.lab2Id);
        const target = Game.getObjectById(chain.targetId);
        
        if (!lab1 || !lab2 || !target) return;
        
        // 检查冷却时间
        if (target.cooldown > 0) return;
        
        // 获取LAB中的资源类型
        let lab1Mineral = null;
        let lab2Mineral = null;
        
        const lab1Resources = Object.keys(lab1.store);
        const lab2Resources = Object.keys(lab2.store);
        
        for (let res of lab1Resources) {
            if (res !== RESOURCE_ENERGY && lab1.store[res] >= 5) {
                lab1Mineral = res;
                break;
            }
        }
        
        for (let res of lab2Resources) {
            if (res !== RESOURCE_ENERGY && lab2.store[res] >= 5) {
                lab2Mineral = res;
                break;
            }
        }
        
        if (!lab1Mineral || !lab2Mineral) return;
        
        // 检查是否能产生化合物
        let reactionResult = null;
        if (REACTIONS[lab1Mineral] && REACTIONS[lab1Mineral][lab2Mineral]) {
            reactionResult = REACTIONS[lab1Mineral][lab2Mineral];
        } else if (REACTIONS[lab2Mineral] && REACTIONS[lab2Mineral][lab1Mineral]) {
            reactionResult = REACTIONS[lab2Mineral][lab1Mineral];
        }
        
        if (!reactionResult) return;
        
        // 检查目标LAB是否有足够空间和能量
        if (target.store.getFreeCapacity(reactionResult) < 5 || target.store[RESOURCE_ENERGY] < 5) {
            return;
        }
        
        // 执行反应
        const result = target.runReaction(lab1, lab2);
        
        if (result === OK) {
            const roomMemory = Memory.Lab[chain.roomName];
            roomMemory.stats.lastReaction = Game.time;
            roomMemory.stats.totalReactions = (roomMemory.stats.totalReactions || 0) + 1;
        }
    },
    
    /**
     * 尝试强化creep
     * @param {Creep} creep - 需要强化的creep
     * @param {StructureLab} lab - 强化LAB
     * @param {string} roomName - 房间名称
     */
    tryBoostCreep: function(creep, lab, roomName) {
        // 检查LAB是否在冷却中
        if (lab.cooldown > 0) return false;
        
        // 检查LAB是否有足够的能量和化合物
        if (lab.store[RESOURCE_ENERGY] < 30) return false;
        
        // 查找可用的化合物
        const resources = Object.keys(lab.store);
        for (let res of resources) {
            if (res !== RESOURCE_ENERGY && lab.store[res] >= 30) {
                const result = lab.boostCreep(creep);
                
                if (result === OK) {
                    const roomMemory = Memory.Lab[roomName];
                    roomMemory.stats.lastBoosts = Game.time;
                    roomMemory.stats.totalBoosts = (roomMemory.stats.totalBoosts || 0) + 1;
                    console.log(`成功：LAB ${lab.id} 使用 ${res} 强化了 creep ${creep.name}`);
                    return true;
                }
            }
        }
        
        return false;
    },
    
    /**
     * 清理无效的LAB链配置
     * @param {string} roomName - 房间名称
     */
    cleanupChains: function(roomName) {
        const roomMemory = Memory.Lab && Memory.Lab[roomName];
        if (!roomMemory || !roomMemory.chains) return;
        
        const validChains = [];
        
        for (let i = 0; i < roomMemory.chains.length; i++) {
            const chain = roomMemory.chains[i];
            const lab1 = Game.getObjectById(chain.lab1Id);
            const lab2 = Game.getObjectById(chain.lab2Id);
            const target = Game.getObjectById(chain.targetId);
            
            if (lab1 && lab2 && target && 
                lab1.structureType === STRUCTURE_LAB &&
                lab2.structureType === STRUCTURE_LAB &&
                target.structureType === STRUCTURE_LAB &&
                lab1.room.name === roomName &&
                lab2.room.name === roomName &&
                target.room.name === roomName) {
                validChains.push(chain);
            }
        }
        
        roomMemory.chains = validChains;
    },
    
    /**
     * 显示LAB配置
     */
    showConfigs: function() {
        if (!Memory.Lab || Object.keys(Memory.Lab).length === 0) {
            console.log('没有配置LAB');
            return;
        }
        
        console.log('=== LAB配置信息 ===');
        for (let roomName in Memory.Lab) {
            if (!Memory.Lab.hasOwnProperty(roomName)) continue;
            
            const roomMemory = Memory.Lab[roomName];
            const chains = roomMemory.chains || [];
            
            console.log(`房间: ${roomName}`);
            console.log(`  LAB链 (${chains.length}个):`);
            
            for (let i = 0; i < chains.length; i++) {
                const chain = chains[i];
                const lab1 = Game.getObjectById(chain.lab1Id);
                const lab2 = Game.getObjectById(chain.lab2Id);
                const target = Game.getObjectById(chain.targetId);
                
                let status = chain.autoBoost ? '自动强化模式' : '仅反应模式';
                
                console.log(`  ${i + 1}. ${chain.lab1Id}+${chain.lab2Id}->${chain.targetId} (${status})`);
                console.log(`      原料1: ${lab1 ? lab1.store : '无效'}`);
                console.log(`      原料2: ${lab2 ? lab2.store : '无效'}`);
                console.log(`      反应皿: ${target ? target.store : '无效'}`);
            }
            
            if (roomMemory.stats) {
                console.log(`  统计:`);
                console.log(`    反应次数: ${roomMemory.stats.totalReactions || 0}`);
                console.log(`    强化次数: ${roomMemory.stats.totalBoosts || 0}`);
            }
        }
    },
    
    /**
     * 在模块内部挂载全局函数
     */
    setupGlobalFunction: function() {
        if (!global.lablink) {
            global.lablink = this.lablink.bind(this);
            console.log('全局函数 lablink 已挂载');
        }
    }
};

// 在模块加载时立即挂载全局函数
roleLab.setupGlobalFunction();

module.exports = roleLab;