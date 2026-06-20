/**
 * js-adapters/wasm_spawncreep.js
 *
 * WASM Side Module 适配器 - Creep生成
 *
 * Body Part 通过共享内存缓冲区传输（WASM写→JS读）
 * 编码: 0=move, 1=work, 2=carry, 3=attack, 4=ranged_attack, 5=claim
 */

var _loader = null;
var _exports = null;
var _mem = null;

function _get() {
    if (!_loader) _loader = require('lib.AP.wasm_loader');
    if (!_exports) _exports = _loader.getExports('spawncreep');
    if (!_mem && _exports) _mem = _loader.getMemory('spawncreep');
    return { loader: _loader, exports: _exports, mem: _mem };
}

function isWasmAvailable() {
    return _get().exports !== null;
}

/**
 * 从共享内存读取部件列表并解码为Screeps部件名数组
 * @private
 */
function _readBodyParts(count) {
    var r = _get();
    if (!r.exports || !r.mem || count <= 0) return [];
    var ptr = r.exports.output_ptr();
    var parts = [];
    for (var i = 0; i < count; i++) {
        parts.push(r.loader.PART.decode(r.mem[ptr + i]));
    }
    return parts;
}

const wasmSpawnCreep = {
    /**
     * 计算部件列表总能量消耗
     * @param {string[]} body 部件名数组
     * @returns {number} 总能量
     */
    calcBodyCost: function(body) {
        var r = _get();
        if (r.exports && r.mem && body.length > 0) {
            // 将部件编码写入spawncreep的输出缓冲区（复用作为临时输入区）
            var ptr = r.exports.output_ptr();
            for (var i = 0; i < body.length; i++) {
                r.mem[ptr + i] = r.loader.PART.encode(body[i]);
            }
            // 调用WASM计算
            return r.exports.calc_body_cost(ptr, body.length);
        }
        // JS回退
        var costMap = { move:50, work:100, carry:50, attack:80, ranged_attack:150, heal:250, claim:600, tough:10 };
        var total = 0;
        for (var i = 0; i < body.length; i++) total += costMap[body[i]] || 0;
        return total;
    },

    /**
     * 获取 CommonI 型部件列表
     * @param {number} energyAvailable 可用能量
     * @returns {string[]} 部件名数组
     */
    getCommonIBody: function(energyAvailable) {
        var r = _get();
        if (r.exports) {
            var count = r.exports.get_common_i_body(energyAvailable);
            if (count > 0) return _readBodyParts(count);
        }
        // JS回退
        if (energyAvailable >= 850) return [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE];
        if (energyAvailable >= 700) return [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE];
        if (energyAvailable >= 600) return [WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE];
        if (energyAvailable >= 550) return [WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE];
        if (energyAvailable >= 450) return [WORK,WORK,WORK,CARRY,MOVE,MOVE];
        if (energyAvailable >= 400) return [WORK,WORK,CARRY,CARRY,MOVE,MOVE];
        if (energyAvailable >= 200) return [WORK,CARRY,MOVE];
        return [];
    },

    /**
     * 获取 CarrierI 型部件列表
     * @param {number} energyAvailable 可用能量
     * @returns {string[]}
     */
    getCarrierIBody: function(energyAvailable) {
        var r = _get();
        if (r.exports) {
            var count = r.exports.get_carrier_i_body(energyAvailable);
            if (count > 0) return _readBodyParts(count);
        }
        // JS回退
        var maxEnergy = Math.min(energyAvailable, 800);
        var pairs = Math.floor(maxEnergy / 100);
        var body = [];
        for (var i = 0; i < pairs; i++) { body.push(CARRY); body.push(MOVE); }
        return body;
    },

    /**
     * 获取 AttackerI 型部件列表
     * @param {number} energyAvailable 可用能量
     * @returns {string[]}
     */
    getAttackerI: function(energyAvailable) {
        var r = _get();
        if (r.exports) {
            var count = r.exports.get_attacker_i_body(energyAvailable);
            if (count > 0) return _readBodyParts(count);
        }
        // JS回退
        if (energyAvailable >= 1180) return [ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,RANGED_ATTACK,RANGED_ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE];
        if (energyAvailable >= 980) return [ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,RANGED_ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE];
        if (energyAvailable >= 920) return [ATTACK,ATTACK,ATTACK,ATTACK,RANGED_ATTACK,RANGED_ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE];
        if (energyAvailable >= 780) return [ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE];
        if (energyAvailable >= 390) return [ATTACK,ATTACK,ATTACK,MOVE,MOVE,MOVE];
        return [];
    },

    /**
     * 获取 ClaimerI 型部件列表
     * @param {number} energyAvailable 可用能量
     * @returns {string[]}
     */
    getClaimerIBody: function(energyAvailable) {
        var r = _get();
        if (r.exports) {
            var count = r.exports.get_claimer_i_body(energyAvailable);
            if (count > 0) return _readBodyParts(count);
        }
        // JS回退
        if (energyAvailable >= 1300) return [CLAIM,CLAIM,MOVE,MOVE];
        if (energyAvailable >= 650) return [CLAIM,MOVE];
        return [];
    },

    isWasmReady: isWasmAvailable
};

module.exports = wasmSpawnCreep;
