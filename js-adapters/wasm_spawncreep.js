/**
 * js-adapters/wasm_spawncreep.js
 *
 * WASM 版本的 spawncreep 模块加载器与适配器
 *
 * 设计原则：
 * - 首次调用自动异步加载 WASM
 * - 加载失败时透明回退到原始 JS 实现
 * - API 与原 lib.AP.spawncreep 完全兼容
 */

let wasmModule = null;
let initPromise = null;

/**
 * 初始化 WASM 模块（必须在使用前调用一次）
 * @returns {Promise<void>}
 */
async function init() {
    if (wasmModule) return; // 已初始化
    if (initPromise) return initPromise; // 正在初始化中，复用 Promise

    initPromise = _doInit().catch(err => {
        console.error("[WASM-SpawnCreep] ❌ 加载失败，使用 JS 回退模式:", err.message);
        wasmModule = null; // 标记为回退模式
    }).finally(() => {
        initPromise = null; // 清理 Promise 引用
    });

    return initPromise;
}

async function _doInit() {
    try {
        // 动态导入 WASM 包
        const wasmModule_default = await import('../wasm-crates/spawncreep/pkg/screeps_wasm_spawncreep.js');
        await wasmModule_default.default();
        wasmModule = wasmModule_default;
        console.log("[WASM-SpawnCreep] ✅ 模块加载成功");
    } catch (error) {
        throw error; // 交给外层处理回退
    }
}

/**
 * 检查 WASM 是否可用
 */
function isWasmAvailable() {
    return wasmModule !== null;
}

/**
 * WASM 适配版的 lib.AP.spawncreep 接口
 */
const wasmSpawnCreep = {
    /**
     * 计算部件列表的总能量消耗
     * @param {string[]} body 部件列表
     * @returns {number} 总能量消耗
     */
    calcBodyCost: function(body) {
        if (!isWasmAvailable()) {
            // JS 回退实现（从原始代码复制）
            let cost = 0;
            for (let i = 0; i < body.length; i++) {
                cost += BODYPART_COST[body[i]] || 0;
            }
            return cost;
        }
        return wasmModule.calc_body_cost(body);
    },

    /**
     * 获取 CommonI 型部件列表
     * @param {number} energyAvailable 当前可用能量
     * @returns {string[]} 部件列表
     */
    getCommonIBody: function(energyAvailable) {
        if (!isWasmAvailable()) {
            if (energyAvailable >= 850) return [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
            if (energyAvailable >= 700) return [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
            if (energyAvailable >= 600) return [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
            if (energyAvailable >= 550) return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
            if (energyAvailable >= 450) return [WORK, WORK, WORK, CARRY, MOVE, MOVE];
            if (energyAvailable >= 400) return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
            if (energyAvailable >= 200) return [WORK, CARRY, MOVE];
            return [];
        }
        return wasmModule.get_common_i_body(energyAvailable);
    },

    /**
     * 获取 CarrierI 型部件列表
     * @param {number} energyAvailable 当前可用能量
     * @returns {string[]} 部件列表
     */
    getCarrierIBody: function(energyAvailable) {
        if (!isWasmAvailable()) {
            const maxEnergy = Math.min(energyAvailable, 800);
            const pairCost = BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
            const pairs = Math.floor(maxEnergy / pairCost);
            const body = [];
            for (let i = 0; i < pairs; i++) {
                body.push(CARRY);
                body.push(MOVE);
            }
            return body;
        }
        return wasmModule.get_carrier_i_body(energyAvailable);
    },

    /**
     * 获取 AttackerI 型部件列表
     * @param {number} energyAvailable 当前可用能量
     * @returns {string[]} 部件列表
     */
    getAttackerI: function(energyAvailable) {
        if (!isWasmAvailable()) {
            if (energyAvailable >= 1180) return [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            if (energyAvailable >= 980) return [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            if (energyAvailable >= 920) return [ATTACK, ATTACK, ATTACK, ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            if (energyAvailable >= 780) return [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            if (energyAvailable >= 390) return [ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE];
            return [];
        }
        return wasmModule.get_attacker_i_body(energyAvailable);
    },

    /**
     * 获取 ClaimerI 型部件列表
     * @param {number} energyAvailable 当前可用能量
     * @returns {string[]} 部件列表
     */
    getClaimerIBody: function(energyAvailable) {
        if (!isWasmAvailable()) {
            if (energyAvailable >= 1300) return [CLAIM, CLAIM, MOVE, MOVE];
            if (energyAvailable >= 650) return [CLAIM, MOVE];
            return [];
        }
        return wasmModule.get_claimer_i_body(energyAvailable);
    },

    // 暴露初始化方法
    init: init,
    
    // 状态查询
    isWasmReady: isWasmAvailable
};

module.exports = wasmSpawnCreep;