//! Creep 部件能量成本计算
//! 对应 JS: lib.AP.spawncreep.calcBodyCost()

use wasm_bindgen::prelude::*;

/// Screeps 官方部件能量消耗表
const BODYPART_COST_MAP: &[(&str, u32)] = &[
    ("move", 50),
    ("work", 100),
    ("carry", 50),
    ("attack", 80),
    ("ranged_attack", 150),
    ("heal", 250),
    ("claim", 600),
    ("tough", 10),
];

/// 计算部件列表的总能量消耗
#[wasm_bindgen]
pub fn calc_body_cost(body: Vec<String>) -> u32 {
    let mut total_cost = 0u32;

    for part in &body {
        if let Some((_, cost)) = BODYPART_COST_MAP.iter().find(|(name, _)| *name == part.as_str()) {
            total_cost += cost;
        }
    }

    total_cost
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calc_basic_body() {
        let body = vec!["move".to_string(), "work".to_string(), "carry".to_string()];
        assert_eq!(calc_body_cost(body), 200);
    }

    #[test]
    fn test_calc_empty_body() {
        let body: Vec<String> = vec![];
        assert_eq!(calc_body_cost(body), 0);
    }

    #[test]
    fn test_calc_unknown_part_ignored() {
        let body = vec!["move".to_string(), "unknown_part".to_string()];
        assert_eq!(calc_body_cost(body), 50);
    }
}
