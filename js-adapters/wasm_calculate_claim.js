/**
 * js-adapters/wasm_calculate_claim.js
 *
 * WASM 版本的 calculate_claim 模块适配器
 */

let wasmModule = null;
let initPromise = null;

async function init() {
    if (wasmModule) return;
    if (initPromise) return initPromise;

    initPromise = _doInit().catch(err => {
        console.error("[WASM-CalculateClaim] ❌ 加载失败:", err.message);
        wasmModule = null;
    }).finally(() => {
        initPromise = null;
    });

    return initPromise;
}

async function _doInit() {
    const wasmModule_default = await import('../wasm-crates/calculate_claim/pkg/screeps_wasm_calculate_claim.js');
    await wasmModule_default.default();
    wasmModule = wasmModule_default;
    console.log("[WASM-CalculateClaim] ✅ 模块加载成功");
}

function isWasmAvailable() {
    return wasmModule !== null;
}

const wasmCalculateClaim = {
    /**
     * 计算地形得分
     * @param {Object} terrainData - { walls: [[x,y],...], swamps: [[x,y],...], buildingWalls: [[x,y],...] }
     * @returns {number} 得分 (-999 ~ +25)
     */
    scoreTerrain: function(terrainData) {
        if (!isWasmAvailable()) {
            // JS 回退实现
            const TOTAL = 2500;
            const wallCount = (terrainData.walls || []).length + (terrainData.buildingWalls || []).length;
            const swampCount = (terrainData.swamps || []).length;
            
            let score = 0;
            const wallRatio = wallCount / TOTAL;
            const swampRatio = swampCount / TOTAL;
            
            if (wallRatio < 0.20) score += 20;
            else if (wallRatio < 0.35) score += 10;
            else if (wallRatio < 0.45) score += 5;
            else score -= 5;
            
            if (swampRatio < 0.35) score += 5;
            else if (swampRatio < 0.40) score += 3;
            else if (swampRatio > 0.50) score -= 5;
            
            return score;
        }

        // 转换为扁平数组格式（匹配 Rust 构造函数期望的输入）
        const wallsFlat = this._flattenCoords(terrainData.walls || []);
        const swampsFlat = this._flattenCoords(terrainData.swamps || []);
        const buildingWallsFlat = this._flattenCoords(terrainData.buildingWalls || []);

        const terrain = new wasmModule.TerrainData(wallsFlat, swampsFlat, buildingWallsFlat);
        return wasmModule.score_terrain(terrain);
    },

    /**
     * 计算能量源得分
     * @param {Array<{x: number, y: number}>} sources
     * @returns {number} 得分
     */
    scoreSources: function(sources) {
        if (!isWasmAvailable()) {
            let score = sources.length * 5;
            if (sources.length >= 2) {
                const dx = Math.abs(sources[0].x - sources[1].x);
                const dy = Math.abs(sources[0].y - sources[1].y);
                const dist = dx + dy;
                if (dist < 20) score += 10;
                else if (dist > 30) score -= 5;
            }
            return score;
        }

        const wasmSources = sources.map(s => new wasmModule.SourcePosition(s.x, s.y));
        return wasmModule.score_sources(wasmSources);
    },

    /**
     * 将坐标数组展平为 [x0, y0, x1, y1, ...]
     * @private
     */
    _flattenCoords: function(coords) {
        const flat = [];
        for (const coord of coords) {
            flat.push(coord[0]);
            flat.push(coord[1]);
        }
        return flat;
    },

    init: init,
    isWasmReady: isWasmAvailable
};

module.exports = wasmCalculateClaim;