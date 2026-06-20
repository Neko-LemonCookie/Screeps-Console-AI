//! screeps-wasm-calculate-claim
//!
//! Screeps AI - 房间占领评分算法 WASM 模块

pub mod data_types;
pub mod terrain_scorer;
pub mod source_scorer;

pub use data_types::{TerrainData, SourcePosition};
pub use terrain_scorer::score_terrain;
pub use source_scorer::score_sources;
