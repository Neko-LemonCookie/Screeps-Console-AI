/**
 * adapter.wasm_spawncreep.js
 * Creep生成算法（纯JS实现）
 */

const COST_MAP = { move:50, work:100, carry:50, attack:80, ranged_attack:150, heal:250, claim:600, tough:10 };

const wasmSpawnCreep = {
    /** 计算部件列表总能量消耗 */
    calcBodyCost: function(body) {
        var total = 0;
        for (var i = 0; i < body.length; i++) total += COST_MAP[body[i]] || 0;
        return total;
    },

    /** 获取 CommonI 型部件列表 */
    getCommonIBody: function(energyAvailable) {
        if (energyAvailable >= 850) return [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE];
        if (energyAvailable >= 700) return [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE];
        if (energyAvailable >= 600) return [WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE];
        if (energyAvailable >= 550) return [WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE];
        if (energyAvailable >= 450) return [WORK,WORK,WORK,CARRY,MOVE,MOVE];
        if (energyAvailable >= 400) return [WORK,WORK,CARRY,CARRY,MOVE,MOVE];
        if (energyAvailable >= 200) return [WORK,CARRY,MOVE];
        return [];
    },

    /** 获取 CarrierI 型部件列表 */
    getCarrierIBody: function(energyAvailable) {
        var maxEnergy = Math.min(energyAvailable, 800);
        var pairs = Math.floor(maxEnergy / 100);
        var body = [];
        for (var i = 0; i < pairs; i++) { body.push(CARRY); body.push(MOVE); }
        return body;
    },

    /** 获取 AttackerI 型部件列表 */
    getAttackerIBody: function(energyAvailable) {
        if (energyAvailable >= 1180) return [ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,RANGED_ATTACK,RANGED_ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE];
        if (energyAvailable >= 980) return [ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,RANGED_ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE];
        if (energyAvailable >= 920) return [ATTACK,ATTACK,ATTACK,ATTACK,RANGED_ATTACK,RANGED_ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE];
        if (energyAvailable >= 780) return [ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE];
        if (energyAvailable >= 390) return [ATTACK,ATTACK,ATTACK,MOVE,MOVE,MOVE];
        return [];
    },

    /** 获取 ClaimerI 型部件列表 */
    getClaimerIBody: function(energyAvailable) {
        if (energyAvailable >= 1300) return [CLAIM,CLAIM,MOVE,MOVE];
        if (energyAvailable >= 650) return [CLAIM,MOVE];
        return [];
    }
};

module.exports = wasmSpawnCreep;
