//! 采矿位计算算法
//! 对应 JS: lib.AP.tempbuild.getMiningSpots()
//!
//! # Algorithm
//! 扫描对象周围 3x3 网格（排除中心），过滤掉：
//! - 自然墙 (TERRAIN_MASK_WALL)
//! - 超出房间边界 (0-49)

use wasm_bindgen::prelude::*;

/// 采矿位坐标
#[wasm_bindgen]
pub struct MiningSpot {
    pub x: u8,
    pub y: u8,
}

/// 计算可用采矿位坐标列表
///
/// # Arguments
/// * `obj_x` - 对象 X 坐标 (0-49)
/// * `obj_y` - 对象 Y 坐标 (0-49)
/// * `terrain_walls_flat` - 地形墙坐标扁平数组 [x0, y0, x1, y1, ...]（由 JS 传入）
///
/// # Returns
/// 可用采矿位 [MiningSpot, ...]（最多 8 个）
#[wasm_bindgen]
pub fn get_mining_spots(obj_x: u8, obj_y: u8, terrain_walls_flat: Vec<u16>) -> Vec<MiningSpot> {
    let mut spots = Vec::with_capacity(8);

    let wall_set: std::collections::HashSet<(u8, u8)> = (0..terrain_walls_flat.len())
        .step_by(2)
        .map(|i| (terrain_walls_flat[i] as u8, terrain_walls_flat[i + 1] as u8))
        .collect();

    for dx in [-1i8, 0, 1] {
        for dy in [-1i8, 0, 1] {
            if dx == 0 && dy == 0 { continue; }

            let px = (obj_x as i16) + (dx as i16);
            let py = (obj_y as i16) + (dy as i16);

            if px < 0 || px > 49 || py < 0 || py > 49 { continue; }

            let pos = (px as u8, py as u8);

            if !wall_set.contains(&pos) {
                spots.push(MiningSpot { x: pos.0, y: pos.1 });
            }
        }
    }

    spots
}

/// 将坐标元组列表转为扁平 u16 数组（测试辅助函数）
#[cfg(test)]
fn to_flat(coords: &[(u8, u8)]) -> Vec<u16> {
    coords.iter().flat_map(|&(x, y)| [x as u16, y as u16]).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_field_source() {
        let spots = get_mining_spots(25, 25, vec![]);
        assert_eq!(spots.len(), 8);
    }

    #[test]
    fn test_corner_source_with_walls() {
        let walls = vec![(24, 24), (24, 25), (25, 24)];
        let spots = get_mining_spots(25, 25, to_flat(&walls));
        assert_eq!(spots.len(), 5); // 8 - 3 = 5
    }

    #[test]
    fn test_boundary_clamping() {
        let spots = get_mining_spots(0, 0, vec![]);
        assert!(spots.len() <= 3);
    }

    #[test]
    fn test_all_surrounded_by_walls() {
        let mut walls = vec![];
        for dx in -1i8..=1i8 {
            for dy in -1i8..=1i8 {
                if dx == 0 && dy == 0 { continue; }
                walls.push(((24i16 + dx as i16) as u8, (24i16 + dy as i16) as u8));
            }
        }
        let spots = get_mining_spots(24, 24, to_flat(&walls));
        assert_eq!(spots.len(), 0);
    }
}
