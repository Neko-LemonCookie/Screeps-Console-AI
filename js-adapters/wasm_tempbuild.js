/**
 * js-adapters/wasm_tempbuild.js
 *
 * WASM 版本的 tempbuild 模块适配器
 */

let wasmModule = null;
let initPromise = null;

async function init() {
    if (wasmModule) return;
    if (initPromise) return initPromise;

    initPromise = _doInit().catch(err => {
        console.error("[WASM-TempBuild] ❌ 加载失败:", err.message);
        wasmModule = null;
    }).finally(() => {
        initPromise = null;
    });

    return initPromise;
}

async function _doInit() {
    const wasmModule_default = await import('../wasm-crates/tempbuild/pkg/screeps_wasm_tempbuild.js');
    await wasmModule_default.default();
    wasmModule = wasmModule_default;
    console.log("[WASM-TempBuild] ✅ 模块加载成功");
}

function isWasmAvailable() {
    return wasmModule !== null;
}

const wasmTempBuild = {
    /**
     * 获取采矿位坐标
     * @param {number} x 对象 X 坐标
     * @param {number} y 对象 Y 坐标
     * @param {Array<Array<number>>} walls 墙坐标数组 [[x,y], ...]
     * @returns {Array<{x: number, y: number}>} 采矿位列表
     */
    getMiningSpots: function(x, y, walls) {
        if (!isWasmAvailable()) {
            // JS 回退实现（从原始代码提取）
            const spots = [];
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const px = x + dx;
                    const py = y + dy;
                    if (px < 0 || px > 49 || py < 0 || py > 49) continue;
                    
                    // 简化版：不检查墙（完整版需要 terrain 数据）
                    spots.push({ x: px, y: py });
                }
            }
            return spots;
        }

        // 转换为扁平数组格式
        const wallsFlat = [];
        for (const wall of (walls || [])) {
            wallsFlat.push(wall[0]);
            wallsFlat.push(wall[1]);
        }

        // 调用 WASM 函数（返回 MiningSpot 对象数组）
        const result = wasmModule.get_mining_spots(x, y, wallsFlat);
        
        // 转换为标准 JS 格式
        return result.map(spot => ({ x: spot.x, y: spot.y }));
    },

    init: init,
    isWasmReady: isWasmAvailable
};

module.exports = wasmTempBuild;