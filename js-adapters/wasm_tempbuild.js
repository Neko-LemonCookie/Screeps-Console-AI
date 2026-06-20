/**
 * js-adapters/wasm_tempbuild.js
 *
 * WASM Side Module 适配器 - 基建布局
 *
 * 采矿位通过双向共享内存传输：
 *   JS写墙坐标→输入缓冲区 → WASM计算 → 写结果到输出缓冲区 → JS读取
 */

var _loader = null;
var _exports = null;
var _mem = null;

function _get() {
    if (!_loader) _loader = require('lib.AP.wasm_loader');
    if (!_exports) _exports = _loader.getExports('tempbuild');
    if (!_mem && _exports) _mem = _loader.getMemory('tempbuild');
    return { loader: _loader, exports: _exports, mem: _mem };
}

function isWasmAvailable() {
    return _get().exports !== null;
}

const wasmTempBuild = {
    /**
     * 获取采矿位坐标
     * @param {number} x 对象X坐标
     * @param {number} y 对象Y坐标
     * @param {Array<Array<number>>} walls 墙坐标 [[x,y], ...]
     * @returns {Array<{x:number, y:number}>}
     */
    getMiningSpots: function(x, y, walls) {
        var r = _get();
        if (r.exports && r.mem) {
            // 1. 写入墙坐标到输入缓冲区
            var inPtr = r.exports.input_ptr();
            var wallCount = (walls || []).length;
            for (var i = 0; i < wallCount; i++) {
                r.mem[inPtr + i * 2]     = walls[i][0];
                r.mem[inPtr + i * 2 + 1] = walls[i][1];
            }

            // 2. 调用WASM计算，返回采矿位数量
            var count = r.exports.get_mining_spots(x, y, wallCount);

            // 3. 从输出缓冲区读取结果
            if (count > 0) {
                var outPtr = r.exports.output_ptr();
                var spots = [];
                for (var j = 0; j < count; j++) {
                    spots.push({
                        x: r.mem[outPtr + j * 2],
                        y: r.mem[outPtr + j * 2 + 1]
                    });
                }
                return spots;
            }
            return [];
        }

        // JS回退（从原始代码提取）
        var spots = [];
        for (var dx = -1; dx <= 1; dx++) {
            for (var dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                var px = x + dx;
                var py = y + dy;
                if (px < 0 || px > 49 || py < 0 || py > 49) continue;

                var blocked = false;
                for (var w = 0; w < wallCount; w++) {
                    if (walls[w][0] === px && walls[w][1] === py) { blocked = true; break; }
                }
                if (!blocked) spots.push({ x: px, y: py });
            }
        }
        return spots;
    },

    isWasmReady: isWasmAvailable
};

module.exports = wasmTempBuild;
