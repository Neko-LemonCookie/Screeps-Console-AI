var rolePreharvester = {
    /** @param {Creep} creep **/
    run: function(creep) {
        // 检查是否需要强化
        if (!creep.memory.boosted) {
            const result = this.tryBoostWithUO(creep);
            
            if (result === true) {
                // 强化成功，转换为 harvester
                creep.memory.role = 'harvester';
                creep.memory.boosted = true;
                creep.say('🎯 已强化');
                console.log(`Preharvester ${creep.name} 已强化并转换为 harvester`);
                return;
            } else if (result === 'abort') {
                // 永久性失败（无 LAB、无 UO/能量、无可用部件等），直接转换
                creep.memory.role = 'harvester';
                creep.say('⚠️ 放弃强化');
                console.log(`Preharvester ${creep.name} 放弃强化，直接转换为 harvester`);
                return;
            } else if (result === 'retry') {
                // 临时性失败（移动中、LAB 冷却），继续等待，不计数
                // 什么也不做，下一 tick 继续尝试
            }
        }
    },
    
    /**
     * 尝试使用 UO 强化
     * @param {Creep} creep 
     * @returns {boolean|string} true: 成功, 'retry': 临时失败, 'abort': 永久失败
     */
    tryBoostWithUO: function(creep) {
        const room = creep.room;
        
        // 1. 检查房间是否有 LAB
        const allLabs = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_LAB
        });
        
        if (allLabs.length === 0) {
            creep.say('❌ 无LAB');
            return 'abort'; // 永久失败
        }
        
        // 2. 寻找含有 UO 和能量的 LAB（不再检查 cooldown）
        const labsWithResources = allLabs.filter(lab => 
            lab.store[RESOURCE_UTRIUM_OXIDE] >= 30 && lab.store[RESOURCE_ENERGY] >= 30
        );
        
        if (labsWithResources.length === 0) {
            // 没有任何 LAB 同时拥有足够的 UO 和能量，直接放弃强化
            // 提示具体缺失的资源（可选）
            const hasUO = allLabs.some(lab => lab.store[RESOURCE_UTRIUM_OXIDE] >= 30);
            const hasEnergy = allLabs.some(lab => lab.store[RESOURCE_ENERGY] >= 30);
            if (!hasUO) creep.say('⚡ 缺UO');
            else if (!hasEnergy) creep.say('⚡ 缺能量');
            else creep.say('⚡ 资源不足');
            return 'abort'; // 永久失败，立即转换
        }
        
        const targetLab = labsWithResources[0]; // 选择第一个可用 LAB
        
        // 3. 检查 creep 是否有 WORK 部件可强化（可选）
        if (!this.hasWorkParts(creep)) {
            creep.say('❌ 无WORK');
            return 'abort';
        }
        
        // 4. 移动到 LAB 旁边
        if (creep.pos.getRangeTo(targetLab) > 1) {
            creep.moveTo(targetLab, {
                visualizePathStyle: {stroke: '#ffaa00'},
                reusePath: 10
            });
            creep.say('🚶‍♂️去强化');
            return 'retry'; // 移动中，重试
        }
        
        // 5. 在 LAB 旁边，尝试强化
        creep.say('⏳强化中...');
        const result = targetLab.boostCreep(creep);
        
        if (result === OK) {
            console.log(`成功：${creep.name} 被 ${targetLab.id} 使用 UO 强化`);
            return true;
        } else if (result === ERR_TIRED) {
            // LAB 冷却中，等待冷却结束
            creep.say('⏳ LAB冷却');
            return 'retry'; // 临时失败，继续等待
        } else {
            // 其他错误（例如没有可强化的部件，或化合物不匹配）
            creep.say(`❌ ${result}`);
            return 'abort';
        }
    },
    
    /**
     * 检查 creep 是否有 WORK 部件可强化
     * @param {Creep} creep 
     */
    hasWorkParts: function(creep) {
        for (let part of creep.body) {
            if (part.type === WORK && !part.boost) {
                return true;
            }
        }
        return false;
    },
    
    /**
     * 清理已死亡的 preharvester 内存
     */
    cleanupOldPreharvesters: function() {
        for (let name in Memory.creeps) {
            const creepMem = Memory.creeps[name];
            if (creepMem.role === 'preharvester' && !Game.creeps[name]) {
                delete Memory.creeps[name];
                console.log(`清理了已死亡的 preharvester: ${name}`);
            }
        }
    }
};

module.exports = rolePreharvester;