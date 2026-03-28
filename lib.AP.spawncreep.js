/**
 * lib.AP.spawncreep.js
 * 负责提供 Creep 部件列表及能量计算 API。
 * 包含 CommonI 型（通用）、CarrierI 型（运输）及 AttackerI 型（攻击）部件配置。
 */

const libAPSpawnCreep = {
    /**
     * 执行生成并输出日志
     * @param {StructureSpawn} spawn 执行生成的 Spawn 建筑
     * @param {string} model 型号 ('CommonI', 'CarrierI', 'AttackerI', 'ClaimerI')
     * @param {number} energy 可用能量上限
     * @returns {number} 返回 spawn.spawnCreep 的结果代码
     */
    spawn: function(spawn, model, energy) {
        if (!spawn || spawn.spawning) return ERR_BUSY;

        let body = [];
        let prefix = '';

        // 根据型号获取部件列表
        switch (model) {
            case 'CommonI':
                body = this.getCommonIBody(energy);
                prefix = 'CM1';
                break;
            case 'CarrierI':
                body = this.getCarrierIBody(energy);
                prefix = 'CR1';
                break;
            case 'AttackerI':
                body = this.getAttackerI(energy);
                prefix = 'AT1';
                break;
            case 'ClaimerI':
                body = this.getClaimerIBody(energy);
                prefix = 'CL1';
                break;
            default:
                console.log("[SpawnCreep] ❌ 错误: 未知型号 " + model);
                return ERR_INVALID_ARGS;
        }

        if (body.length === 0) {
            // console.log("[SpawnCreep] ⚠️ 警告: 能量不足以生成型号 " + model + " (可用: " + energy + ")");
            return ERR_NOT_ENOUGH_ENERGY;
        }

        const name = prefix + "_" + Game.time + "_" + Math.floor(Math.random() * 100);
        const cost = this.calcBodyCost(body);
        
        // 执行生成，不指定 role，但带一个初始为空的任务类型
        const result = spawn.spawnCreep(body, name, {
            memory: {
                spawnRoom: spawn.room.name,
                model: model,
                taskType: null, // 初始任务类型为空，触发调度器回退至 unibot
                spawnTime: Game.time
            }
        });

        if (result === OK) {
            Memory.SpawnCreep.statistics.totalSpawned++;
            console.log("[" + spawn.room.name + "] 🚀 生成成功: " + name + " (型号: " + model + ", 耗能: " + cost + ")");
        }

        return result;
    },

    /**
     * 计算部件列表的总能量消耗
     * @param {string[]} body 部件列表
     * @returns {number} 总能量消耗
     */
    calcBodyCost: function(body) {
        let cost = 0;
        for (let i = 0; i < body.length; i++) {
            cost += BODYPART_COST[body[i]];
        }
        return cost;
    },

    /**
     * 获取 CommonI 型部件列表 (原收获者部件)
     * 适用于：采矿、升级、建造、维修等通用任务
     * @param {number} energyAvailable 当前可用能量
     * @returns {string[]} 部件列表
     */
    getCommonIBody: function(energyAvailable) {
        if (energyAvailable >= 850) return [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
        if (energyAvailable >= 700) return [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        if (energyAvailable >= 600) return [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (energyAvailable >= 550) return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (energyAvailable >= 450) return [WORK, WORK, WORK, CARRY, MOVE, MOVE];
        if (energyAvailable >= 400) return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
        if (energyAvailable >= 200) return [WORK, CARRY, MOVE];
        return [];
    },

    /**
     * 获取 CarrierI 型部件列表
     * 采用 [CARRY, MOVE] 循环，最高 800 能量
     * @param {number} energyAvailable 当前可用能量
     * @returns {string[]} 部件列表
     */
    getCarrierIBody: function(energyAvailable) {
        const maxEnergy = Math.min(energyAvailable, 800);
        const pairCost = BODYPART_COST[CARRY] + BODYPART_COST[MOVE]; // 50 + 50 = 100
        const pairs = Math.floor(maxEnergy / pairCost);
        
        const body = [];
        for (let i = 0; i < pairs; i++) {
            body.push(CARRY);
            body.push(MOVE);
        }
        return body;
    },

    /**
     * 获取 AttackerI 型部件列表
     * @param {number} energyAvailable 当前可用能量
     * @returns {string[]} 部件列表
     */
    getAttackerI: function(energyAvailable) {
        // [ATTACK*6, RANGED_ATTACK*2, MOVE*8] -> 1180
        if (energyAvailable >= 1180) {
            return [
                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                RANGED_ATTACK, RANGED_ATTACK,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
            ];
        }
        // [ATTACK*6, RANGED_ATTACK*1, MOVE*7] -> 980
        if (energyAvailable >= 980) {
            return [
                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                RANGED_ATTACK,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
            ];
        }
        // [ATTACK*4, RANGED_ATTACK*2, MOVE*6] -> 920
        if (energyAvailable >= 920) {
            return [
                ATTACK, ATTACK, ATTACK, ATTACK,
                RANGED_ATTACK, RANGED_ATTACK,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
            ];
        }
        // [ATTACK*6, MOVE*6] -> 780
        if (energyAvailable >= 780) {
            return [
                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
            ];
        }
        // [ATTACK*3, MOVE*3] -> 390
        if (energyAvailable >= 390) {
            return [
                ATTACK, ATTACK, ATTACK,
                MOVE, MOVE, MOVE
            ];
        }
        return [];
    },

    /**
     * 获取 ClaimerI 型部件列表
     * @param {number} energyAvailable 当前可用能量
     * @returns {string[]} 部件列表
     */
    getClaimerIBody: function(energyAvailable) {
        // [CLAIM, CLAIM, MOVE, MOVE] -> 1300
        if (energyAvailable >= 1300) {
            return [CLAIM, CLAIM, MOVE, MOVE];
        }
        // [CLAIM, MOVE] -> 650
        if (energyAvailable >= 650) {
            return [CLAIM, MOVE];
        }
        return [];
    }
};

module.exports = libAPSpawnCreep;
