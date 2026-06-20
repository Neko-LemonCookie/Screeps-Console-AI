/**
 * js-adapters/wasm_calculate_claim.js
 *
 * WASM Side Module 适配器 - 房间评分
 *
 * 直接调用 WebAssembly exports，无胶水代码，无中间层
 * JS回退实现保留（WASM不可用时自动降级）
 */

var _loader = null;
var _exports = null;

function _get() {
    if (!_loader) _loader = require('lib.AP.wasm_loader');
    if (!_exports) _exports = _loader.getExports('calculate_claim');
    return { loader: _loader, exports: _exports };
}

function isWasmAvailable() {
    var r = _get();
    return r.exports !== null;
}

const wasmCalculateClaim = {
    /**
     * 计算地形得分 (-999 ~ +25)
     * @param {Object} terrainData - { walls: [[x,y],...], swamps: [[x,y],...], buildingWalls: [[x,y],...] }
     * @returns {number} 得分
     */
    scoreTerrain: function(terrainData) {
        var r = _get();
        if (r.exports) {
            // WASM路径：直接传计数，零序列化开销
            return r.exports.score_terrain(
                (terrainData.walls || []).length + (terrainData.buildingWalls || []).length,
                (terrainData.swamps || []).length,
                (terrainData.buildingWalls || []).length
            );
        }
        // JS回退
        var TOTAL = 2500;
        var wallCount = (terrainData.walls || []).length + (terrainData.buildingWalls || []).length;
        var swampCount = (terrainData.swamps || []).length;

        var score = 0;
        var wallRatio = wallCount / TOTAL;
        var swampRatio = swampCount / TOTAL;

        if (wallRatio < 0.20) score += 20;
        else if (wallRatio < 0.35) score += 10;
        else if (wallRatio < 0.45) score += 5;
        else score -= 5;

        if (swampRatio < 0.35) score += 5;
        else if (swampRatio < 0.40) score += 3;
        else if (swampRatio > 0.50) score -= 5;

        return score;
    },

    /**
     * 计算能量源得分 (0 ~ 25)
     * @param {Array<{x:number, y:number}>} sources
     * @returns {number}
     */
    scoreSources: function(sources) {
        var r = _get();
        if (r.exports && sources.length > 0) {
            return r.exports.score_sources(
                sources.length,
                sources[0].x || 0, sources[0].y || 0,
                sources.length >= 2 ? (sources[1].x || 0) : 0,
                sources.length >= 2 ? (sources[1].y || 0) : 0
            );
        }
        // JS回退
        var score = sources.length * 5;
        if (sources.length >= 2) {
            var dx = Math.abs(sources[0].x - sources[1].x);
            var dy = Math.abs(sources[0].y - sources[1].y);
            var dist = dx + dy;
            if (dist < 20) score += 10;
            else if (dist > 30) score -= 5;
        }
        return score;
    },

    isWasmReady: isWasmAvailable
};

module.exports = wasmCalculateClaim;
