//! 房间地形评分算法
//! 对应 JS: lib.AP.calculate_claim._scoreTerrain()

use crate::data_types::TerrainData;
use wasm_bindgen::prelude::*;

/// 计算地形得分（-999 ~ +25）
///
/// Scoring Rules:
/// - Wall ratio < 20%: +20 points
/// - Wall ratio < 35%: +10 points
/// - Wall ratio < 45%: +5 points
/// - Wall ratio >= 45%: -5 points
///
/// - Swamp ratio < 35%: +5 points
/// - Swamp ratio < 40%: +3 points
/// - Swamp ratio > 50%: -5 points
#[wasm_bindgen]
pub fn score_terrain(terrain: &TerrainData) -> i32 {
    const TOTAL_CELLS: f64 = 2500.0;

    let wall_count = terrain.walls.len() + terrain.building_walls.len();
    let swamp_count = terrain.swamps.len();

    let wall_ratio = wall_count as f64 / TOTAL_CELLS;
    let swamp_ratio = swamp_count as f64 / TOTAL_CELLS;

    let mut score = 0i32;

    if wall_ratio < 0.20 {
        score += 20;
    } else if wall_ratio < 0.35 {
        score += 10;
    } else if wall_ratio < 0.45 {
        score += 5;
    } else {
        score -= 5;
    }

    if swamp_ratio < 0.35 {
        score += 5;
    } else if swamp_ratio < 0.40 {
        score += 3;
    } else if swamp_ratio > 0.50 {
        score -= 5;
    }

    score
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data_types::TerrainData;

    fn create_test_terrain(wall_count: usize, swamp_count: usize) -> TerrainData {
        let walls: Vec<(u8, u8)> = (0..wall_count).map(|i| (i as u8, i as u8)).collect();
        let swamps: Vec<(u8, u8)> = (0..swamp_count).map(|i| ((i + 500) as u8, (i + 500) as u8)).collect();
        TerrainData { walls, swamps, building_walls: vec![] }
    }

    #[test]
    fn test_excellent_terrain() {
        // 300 墙 (12%) + 700 沼泽 (28%) = 最佳地形
        let terrain = create_test_terrain(300, 700);
        let score = score_terrain(&terrain);
        assert_eq!(score, 25); // 20 (wall) + 5 (swamp)
    }

    #[test]
    fn test_terrible_terrain() {
        // 1500 墙 (60%) + 1400 沼泽 (56%) = 极差地形
        let terrain = create_test_terrain(1500, 1400);
        let score = score_terrain(&terrain);
        assert_eq!(score, -10); // -5 (wall) + -5 (swamp)
    }
}
