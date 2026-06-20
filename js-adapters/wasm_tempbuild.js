/**
 * js-adapters/wasm_tempbuild.js
 *
 * WASM 版本的 tempbuild 模块适配器
 * 通过 lib.AP.wasm_loader 同步加载，Screeps 完全兼容
 */

var _loader = null;

function _getLoader() {
    if (!_loader) _loader = require('lib.AP.wasm_loader');
    return _loader;
}

function isWasmAvailable() {
    return _getLoader().isReady('tempbuild');
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
        var wasm = _getLoader().tempbuild;
        if (!wasm) {
            // JS 回退实现（从原始代码提取）
            var spots = [];
            for (var dx = -1; dx <= 1; dx++) {
                for (var dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    var px = x + dx;
                    var py = y + dy;
                    if (px < 0 || px > 49 || py < 0 || py > 49) continue;
                    spots.push({ x: px, y: py });
                }
            }
            return spots;
        }

        // 转换为扁平数组格式
        var wallsFlat = [];
        for (var i = 0; i < (walls || []).length; i++) {
            wallsFlat.push(walls[i][0]);
            wallsFlat.push(walls[i][1]);
        }

        // 调用 WASM 函数，返回 MiningSpot 对象数组
        var result = wasm.get_mining_spots(x, y, wallsFlat);

        // 转换为标准 JS 格式
        return result.map(function(spot) {
            return { x: spot.x, y: spot.y };
        });
    },

    isWasmReady: isWasmAvailable
};

module.exports = wasmTempBuild;
