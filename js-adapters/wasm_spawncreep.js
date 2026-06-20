/**
 * js-adapters/wasm_spawncreep.js
 *
 * WASM 版本的 spawncreep 模块适配器
 * 通过 lib.AP.wasm_loader 同步加载，Screeps 完全兼容
 *
 * 设计原则：
 * - 同步加载（无需async/await）
 * - 加载失败时透明回退到JS实现
 * - API 与原 lib.AP.spawncreep 完全兼容
 */

var _loader = null;

function _getLoader() {
    if (!_loader) _loader = require('lib.AP.wasm_loader');
    return _loader;
}

function isWasmAvailable() {
    return _getLoader().isReady('spawncreep');
}

const wasmSpawnCreep = {
    /**
     * 计算部件列表的总能量消耗
     * @param {string[]} body 部件列表
     * @returns {number} 总能量消耗
     */
    calcBodyCost: function(body) {
        var wasm = _getLoader().spawncreep;
        if (!wasm) {
            var cost = 0;
            for (var i = 0; i < body.length; i++) {
                cost += BODYPART_COST[body[i]] || 0;
            }
            return cost;
        }
        return wasm.calc_body_cost(body);
    },

    /**
     * 获取 CommonI 型部件列表
     * @param {number} energyAvailable 当前可用能量
     * @returns {string[]} 部件列表
     */
    getCommonIBody: function(energyAvailable) {
        var wasm = _getLoader().spawncreep;
        if (!wasm) {
            if (energyAvailable >= 850) return [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
            if (energyAvailable >= 700) return [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
            if (energyAvailable >= 600) return [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
            if (energyAvailable >= 550) return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
            if (energyAvailable >= 450) return [WORK, WORK, WORK, CARRY, MOVE, MOVE];
            if (energyAvailable >= 400) return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
            if (energyAvailable >= 200) return [WORK, CARRY, MOVE];
            return [];
        }
        return wasm.get_common_i_body(energyAvailable);
    },

    /**
     * 获取 CarrierI 型部件列表
     * @param {number} energyAvailable 当前可用能量
     * @returns {string[]} 部件列表
     */
    getCarrierIBody: function(energyAvailable) {
        var wasm = _getLoader().spawncreep;
        if (!wasm) {
            var maxEnergy = Math.min(energyAvailable, 800);
            var pairCost = BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
            var pairs = Math.floor(maxEnergy / pairCost);
            var body = [];
            for (var i = 0; i < pairs; i++) {
                body.push(CARRY);
                body.push(MOVE);
            }
            return body;
        }
        return wasm.get_carrier_i_body(energyAvailable);
    },

    /**
     * 获取 AttackerI 型部件列表
     * @param {number} energyAvailable 当前可用能量
     * @returns {string[]} 部件列表
     */
    getAttackerI: function(energyAvailable) {
        var wasm = _getLoader().spawncreep;
        if (!wasm) {
            if (energyAvailable >= 1180) return [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            if (energyAvailable >= 980) return [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            if (energyAvailable >= 920) return [ATTACK, ATTACK, ATTACK, ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            if (energyAvailable >= 780) return [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            if (energyAvailable >= 390) return [ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE];
            return [];
        }
        return wasm.get_attacker_i_body(energyAvailable);
    },

    /**
     * 获取 ClaimerI 型部件列表
     * @param {number} energyAvailable 当前可用能量
     * @returns {string[]} 部件列表
     */
    getClaimerIBody: function(energyAvailable) {
        var wasm = _getLoader().spawncreep;
        if (!wasm) {
            if (energyAvailable >= 1300) return [CLAIM, CLAIM, MOVE, MOVE];
            if (energyAvailable >= 650) return [CLAIM, MOVE];
            return [];
        }
        return wasm.get_claimer_i_body(energyAvailable);
    },

    isWasmReady: isWasmAvailable
};

module.exports = wasmSpawnCreep;
