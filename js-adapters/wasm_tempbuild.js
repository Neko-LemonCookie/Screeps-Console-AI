/**
 * adapter.wasm_tempbuild.js
 * 基建布局算法（纯JS实现）
 */

const wasmTempBuild = {
    /**
     * 获取采矿位坐标
     * @param {number} x 对象X坐标
     * @param {number} y 对象Y坐标
     * @param {Array<Array<number>>} walls 墙坐标 [[x,y], ...]
     * @returns {Array<{x:number, y:number}>}
     */
    getMiningSpots: function(x, y, walls) {
        var spots = [];
        var wallCount = (walls || []).length;

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
    }
};

module.exports = wasmTempBuild;
