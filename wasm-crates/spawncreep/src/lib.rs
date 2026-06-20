//! screeps-wasm-spawncreep
//!
//! Screeps AI - Creep 生成算法 WASM 模块

mod cost_calculator;
mod body_templates;

pub use cost_calculator::calc_body_cost;
pub use body_templates::{
    get_common_i_body,
    get_carrier_i_body,
    get_attacker_i_body,
    get_claimer_i_body,
};
