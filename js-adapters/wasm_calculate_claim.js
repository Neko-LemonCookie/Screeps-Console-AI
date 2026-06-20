/**
 * adapter.wasm_calculate_claim.js
 * 房间占领评分算法（纯JS实现）
 */

const wasmCalculateClaim = {
    /**
     * 计算地形得分 (-999 ~ +25)
     */
    scoreTerrain: function(terrainData) {
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
     */
    scoreSources: function(sources) {
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
};

module.exports = wasmCalculateClaim;
