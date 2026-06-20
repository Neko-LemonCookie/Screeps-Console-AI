/**
 * js-adapters/wasm_calculate_claim.js
 *
 * WASM 版本的 calculate_claim 模块适配器
 * 通过 lib.AP.wasm_loader 同步加载，Screeps 完全兼容
 */

var _loader = null;

function _getLoader() {
    if (!_loader) _loader = require('lib.AP.wasm_loader');
    return _loader;
}

/**
 * 检查WASM是否可用（同步，无需await）
 */
function isWasmAvailable() {
    return _getLoader().isReady('calculate_claim');
}

const wasmCalculateClaim = {
    /**
     * 计算地形得分
     * @param {Object} terrainData - { walls: [[x,y],...], swamps: [[x,y],...], buildingWalls: [[x,y],...] }
     * @returns {number} 得分 (-999 ~ +25)
     */
    scoreTerrain: function(terrainData) {
        var wasm = _getLoader().calculate_claim;
        if (!wasm) {
            // JS 回退实现
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
        }

        // WASM路径：构造 TerrainData 对象并调用评分函数
        var wallsFlat = this._flattenCoords(terrainData.walls || []);
        var swampsFlat = this._flattenCoords(terrainData.swamps || []);
        var buildingWallsFlat = this._flattenCoords(terrainData.buildingWalls || []);

        var terrain = new wasm.TerrainData(wallsFlat, swampsFlat, buildingWallsFlat);
        return wasm.score_terrain(terrain);
    },

    /**
     * 计算能量源得分
     * @param {Array<{x: number, y: number}>} sources
     * @returns {number} 得分
     */
    scoreSources: function(sources) {
        var wasm = _getLoader().calculate_claim;
        if (!wasm) {
            var score = sources.length * 5;
            if (sources.length >= 2) {
                var dx = Math.abs(sources[0].x - sources[1].x);
                var dy = Math.abs(sources[0].y - sources[1].y);
                var dist = dx + dy;
                if (dist < 20) score += 10;
                else if (dist > 30) score -= 5;
            }
            return score;
        }

        // 构造 SourcePosition 对象数组
        var wasmSources = sources.map(function(s) {
            return new wasm.SourcePosition(s.x, s.y);
        });
        return wasm.score_sources(wasmSources);
    },

    /**
     * 将坐标数组展平为 [x0, y0, x1, y1, ...]
     * @private
     */
    _flattenCoords: function(coords) {
        var flat = [];
        for (var i = 0; i < coords.length; i++) {
            flat.push(coords[i][0]);
            flat.push(coords[i][1]);
        }
        return flat;
    },

    isWasmReady: isWasmAvailable
};

module.exports = wasmCalculateClaim;
