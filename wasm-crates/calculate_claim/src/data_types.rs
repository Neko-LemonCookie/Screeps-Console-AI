//! 房间评分计算的数据类型定义
//!
//! 设计原则：所有输入数据由 JS 层采集，使用基本类型和扁平结构优化序列化性能

use wasm_bindgen::prelude::*;

/// 地形数据（50x50 房间网格）
#[wasm_bindgen]
pub struct TerrainData {
    /// 自然墙坐标列表 [(x, y), ...]
    pub(crate) walls: Vec<(u8, u8)>,
    /// 沼泽地坐标列表
    pub(crate) swamps: Vec<(u8, u8)>,
    /// 已有人造墙坐标列表
    pub(crate) building_walls: Vec<(u8, u8)>,
}

#[wasm_bindgen]
impl TerrainData {
    /// 从平坦数组创建（JS 传参优化）
    #[wasm_bindgen(constructor)]
    pub fn new(
        walls_flat: Vec<u16>,
        swamps_flat: Vec<u16>,
        building_walls_flat: Vec<u16>,
    ) -> TerrainData {
        let walls = (0..walls_flat.len())
            .step_by(2)
            .map(|i| (walls_flat[i] as u8, walls_flat[i + 1] as u8))
            .collect();

        let swamps = (0..swamps_flat.len())
            .step_by(2)
            .map(|i| (swamps_flat[i] as u8, swamps_flat[i + 1] as u8))
            .collect();

        let building_walls = (0..building_walls_flat.len())
            .step_by(2)
            .map(|i| (building_walls_flat[i] as u8, building_walls_flat[i + 1] as u8))
            .collect();

        TerrainData { walls, swamps, building_walls }
    }
}

/// 能量源位置信息
#[wasm_bindgen]
pub struct SourcePosition {
    pub x: u8,
    pub y: u8,
}
