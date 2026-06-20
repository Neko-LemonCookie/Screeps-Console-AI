//! Creep 部件模板定义
//! 对应 JS: lib.AP.spawncreep 的 getCommonIBody/getCarrierIBody/getAttackerI/getClaimerIBody

use wasm_bindgen::prelude::*;

/// 获取 CommonI 型（通用型）Creep 部件列表
/// Energy Tiers:
/// - ≥850: 4WORK + 4CARRY + 5MOVE (13 parts)
/// - ≥700: 4WORK + 3CARRY + 4MOVE (11 parts)
/// - ≥600: 3WORK + 3CARRY + 3MOVE (9 parts)
/// - ≥550: 3WORK + 2CARRY + 3MOVE (8 parts)
/// - ≥450: 3WORK + 1CARRY + 2MOVE (6 parts)
/// - ≥400: 2WORK + 2CARRY + 2MOVE (6 parts)
/// - ≥200: 1WORK + 1CARRY + 1MOVE (3 parts)
/// - else: empty
#[wasm_bindgen]
pub fn get_common_i_body(energy_available: u32) -> Vec<String> {
    match energy_available {
        850..=u32::MAX => {
            let mut body = Vec::with_capacity(13);
            body.extend(std::iter::repeat("work".to_string()).take(4));
            body.extend(std::iter::repeat("carry".to_string()).take(4));
            body.extend(std::iter::repeat("move".to_string()).take(5));
            body
        },
        700..=849 => {
            let mut body = Vec::with_capacity(11);
            body.extend(std::iter::repeat("work".to_string()).take(4));
            body.extend(std::iter::repeat("carry".to_string()).take(3));
            body.extend(std::iter::repeat("move".to_string()).take(4));
            body
        },
        600..=699 => {
            let mut body = Vec::with_capacity(9);
            body.extend(std::iter::repeat("work".to_string()).take(3));
            body.extend(std::iter::repeat("carry".to_string()).take(3));
            body.extend(std::iter::repeat("move".to_string()).take(3));
            body
        },
        550..=599 => {
            let mut body = Vec::with_capacity(8);
            body.extend(std::iter::repeat("work".to_string()).take(3));
            body.extend(std::iter::repeat("carry".to_string()).take(2));
            body.extend(std::iter::repeat("move".to_string()).take(3));
            body
        },
        450..=549 => vec![
            "work".to_string(), "work".to_string(), "work".to_string(),
            "carry".to_string(),
            "move".to_string(), "move".to_string(),
        ],
        400..=449 => vec![
            "work".to_string(), "work".to_string(),
            "carry".to_string(), "carry".to_string(),
            "move".to_string(), "move".to_string(),
        ],
        200..=399 => vec![
            "work".to_string(), "carry".to_string(), "move".to_string(),
        ],
        _ => vec![],
    }
}

/// 获取 CarrierI 型（运输型）Creep 部件列表
/// [CARRY, MOVE] 循环，最高 800 能量（8对）
#[wasm_bindgen]
pub fn get_carrier_i_body(energy_available: u32) -> Vec<String> {
    const PAIR_COST: u32 = 100;
    const MAX_ENERGY: u32 = 800;

    let max_energy = energy_available.min(MAX_ENERGY);
    let pairs = max_energy / PAIR_COST;

    let mut body = Vec::with_capacity((pairs * 2) as usize);
    for _ in 0..pairs {
        body.push("carry".to_string());
        body.push("move".to_string());
    }

    body
}

/// 获取 AttackerI 型（攻击型）Creep 部件列表
#[wasm_bindgen]
pub fn get_attacker_i_body(energy_available: u32) -> Vec<String> {
    match energy_available {
        1180..=u32::MAX => {
            let mut body = Vec::with_capacity(16);
            body.extend(std::iter::repeat("attack".to_string()).take(6));
            body.extend(std::iter::repeat("ranged_attack".to_string()).take(2));
            body.extend(std::iter::repeat("move".to_string()).take(8));
            body
        },
        980..=1179 => {
            let mut body = Vec::with_capacity(14);
            body.extend(std::iter::repeat("attack".to_string()).take(6));
            body.push("ranged_attack".to_string());
            body.extend(std::iter::repeat("move".to_string()).take(7));
            body
        },
        920..=979 => {
            let mut body = Vec::with_capacity(12);
            body.extend(std::iter::repeat("attack".to_string()).take(4));
            body.extend(std::iter::repeat("ranged_attack".to_string()).take(2));
            body.extend(std::iter::repeat("move".to_string()).take(6));
            body
        },
        780..=919 => {
            let mut body = Vec::with_capacity(12);
            body.extend(std::iter::repeat("attack".to_string()).take(6));
            body.extend(std::iter::repeat("move".to_string()).take(6));
            body
        },
        390..=779 => vec![
            "attack".to_string(), "attack".to_string(), "attack".to_string(),
            "move".to_string(), "move".to_string(), "move".to_string(),
        ],
        _ => vec![],
    }
}

/// 获取 ClaimerI 型（占领型）Creep 部件列表
#[wasm_bindgen]
pub fn get_claimer_i_body(energy_available: u32) -> Vec<String> {
    match energy_available {
        1300..=u32::MAX => vec![
            "claim".to_string(), "claim".to_string(),
            "move".to_string(), "move".to_string(),
        ],
        650..=1299 => vec![
            "claim".to_string(), "move".to_string(),
        ],
        _ => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_common_i_max_tier() {
        let body = get_common_i_body(900);
        assert_eq!(body.len(), 13);
        assert_eq!(body.iter().filter(|p| *p == "work").count(), 4);
    }

    #[test]
    fn test_common_i_min_tier() {
        let body = get_common_i_body(200);
        assert_eq!(body.len(), 3);
    }

    #[test]
    fn test_carrier_i_max_pairs() {
        let body = get_carrier_i_body(1000);
        assert_eq!(body.len(), 16);
    }

    #[test]
    fn test_attacker_i_full_load() {
        let body = get_attacker_i_body(1200);
        assert_eq!(body.len(), 16);
    }

    #[test]
    fn test_claimer_i_double() {
        let body = get_claimer_i_body(1400);
        assert_eq!(body.len(), 4);
        assert_eq!(body.iter().filter(|p| *p == "claim").count(), 2);
    }
}
