// ext.createclaim.js - 远程升级模块 (简化版)
var extCreateClaim = {
    // 上次日志时间记录
    lastLogTime: 0,
    
    // 全局单位计数
    globalCreepCounts: {
        claimUpgrader: 0,
        claimBuilder: 0
    },
    
    // 日志记录函数，控制输出频率
    log: function(message, force = false) {
        // 强制输出或每500tick输出一次
        if (force || Game.time - this.lastLogTime >= 500) {
            console.log(message);
            this.lastLogTime = Game.time;
        }
    },
    
    run: function() {
        const targetRooms = ['W56S8']; // 根据实际需要修改
        
        const spawn = Game.spawns['Respawn'];
        if (!spawn) return;
        
        const roomEnergy = spawn.room.energyAvailable;
        const roomEnergyCapacity = spawn.room.energyCapacityAvailable;
        
        // 更新全局单位计数
        this._updateGlobalCreepCounts();
        
        // 能量检查 - 使用相对百分比阈值
        const energyRatio = roomEnergy / roomEnergyCapacity;
        if (energyRatio < 0.3) { // 能量低于30%时不生成
            this.log(`能量较低(${Math.round(energyRatio*100)}%)，暂停生成远程单位`);
            return;
        }
        
        // 检查是否有spawn正在生成中
        if (spawn.spawning) {
            return;
        }
        
        // 检查每个目标房间
        for (let i = 0; i < targetRooms.length; i++) {
            const targetRoom = targetRooms[i];
            
            // 1. 检查是否需要升级者（最多1个）
            if (this.globalCreepCounts.claimUpgrader < 1) {
                if (this._trySpawnCreep(spawn, targetRoom, 'claimUpgrader', '缺少升级者')) {
                    return; // 成功生成一个，本次tick结束
                }
                continue;
            }
            
            // 2. 检查是否需要建造者（最多3个）
            if (this.globalCreepCounts.claimBuilder < 3) {
                if (this._trySpawnCreep(spawn, targetRoom, 'claimBuilder', '缺少建造者')) {
                    return; // 成功生成一个，本次tick结束
                }
                continue;
            }
        }
    },
    
    // 更新全局单位计数
    _updateGlobalCreepCounts: function() {
        // 重置计数
        this.globalCreepCounts.claimUpgrader = 0;
        this.globalCreepCounts.claimBuilder = 0;
        
        // 遍历所有creep进行统计
        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            const role = creep.memory.role;
            
            if (role === 'claimUpgrader') {
                this.globalCreepCounts.claimUpgrader++;
            } else if (role === 'claimBuilder') {
                this.globalCreepCounts.claimBuilder++;
            }
        }
    },
    
    // 尝试生成creep
    _trySpawnCreep: function(spawn, targetRoom, role, reason) {
        const roomEnergy = spawn.room.energyAvailable;
        let body = [];
        let requiredEnergy = 0;
        
        // 根据能量选择配置
        if (roomEnergy >= 850) {
            body = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE]; // 高配置
            requiredEnergy = 850;
        } else if (roomEnergy >= 00) {
            body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE]; // 最小配置
            requiredEnergy = 400;
        } else {
            // 能量不足，不生成
            return false;
        }
        
        // 生成creep
        const name = role + '_' + targetRoom + '_' + Game.time;
        const result = spawn.spawnCreep(body, name, {
            memory: { 
                role: role, 
                targetRoom: targetRoom,
                homeRoom: spawn.room.name,
                working: false,
                arrived: false,
                bornTime: Game.time
            }
        });
        
        if (result === OK) {
            this.log(`生成${role} ${name} 前往 ${targetRoom} (原因: ${reason}, 能量: ${requiredEnergy})`, true);
            // 立即更新计数（因为新creep会在下个tick才出现在Game.creeps中）
            this.globalCreepCounts[role]++;
            return true;
        } else if (result === ERR_BUSY) {
            // spawn正忙，下个tick再试
            return false;
        } else if (result === ERR_NOT_ENOUGH_ENERGY) {
            this.log(`生成${role}失败: 能量不足(需要${requiredEnergy}, 当前${roomEnergy})`);
            return false;
        } else {
            this.log(`生成${role}失败: ${result}`, true);
            return false;
        }
    },
    
    // 清理死亡creep的内存（简化版）
    cleanMemory: function() {
        let cleaned = 0;
        for (const name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
                cleaned++;
            }
        }
        if (cleaned > 0) {
            this.log(`清理了${cleaned}个死亡creep的内存`, true);
        }
    }
};

module.exports = extCreateClaim;