//! screeps-wasm-calculate-claim
//!
//! Screeps AI - 房间占领评分算法 WASM Side Module
//!
//! 编译: cargo build --target wasm32-unknown-unknown --release
//! 输出: target/wasm32-unknown-unknown/release/screeps_wasm_calculate_claim.wasm
//!
//! 使用方式（Screeps JS）:
//!   const buf = require('calculate_claim');
//!   const mod = new WebAssembly.Module(buf);
//!   const inst = new WebAssembly.Instance(mod, {});
//!   const e = inst.exports;
//!   let score = e.score_terrain(300, 700, 50);  // wall, swamp, building_wall counts

/// 计算地形得分 (-999 ~ +25)
///
/// # Arguments
/// * `wall_count`      - 自然墙数量
/// * `swamp_count`     - 沼泽地数量  
/// * `building_wall_count` - 人造墙数量
///
/// # Scoring Rules:
/// - Wall ratio < 20%: +20 | < 35%: +10 | < 45%: +5 | >= 45%: -5
/// - Swamp ratio < 35%: +5 | < 40%: +3 | > 50%: -5
#[no_mangle]
pub extern "C" fn score_terrain(wall_count: i32, swamp_count: i32, building_wall_count: i32) -> i32 {
    const TOTAL_CELLS: f64 = 2500.0;

    let total_walls = (wall_count + building_wall_count) as f64;
    let wall_ratio = total_walls / TOTAL_CELLS;
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

/// 计算能量源得分 (0 ~ 25)
///
/// # Arguments
/// * `source_count` - 能量源数量 (0-3, Screeps最多3个)
/// * `s0_x`, `s0_y` - 第一个能量源坐标
/// * `s1_x`, `s1_y` - 第二个能量源坐标（如果count>=2）
///
/// # Scoring Rules:
/// - 每个 Source: +5 base
/// - 双源距离 < 20: +10 bonus
/// - 双源距离 > 30: -5 penalty
#[no_mangle]
pub extern "C" fn score_sources(
    source_count: i32,
    s0_x: i32, s0_y: i32,
    s1_x: i32, s1_y: i32,
) -> i32 {
    let mut score = source_count * 5;

    if source_count >= 2 {
        let dx = (s0_x - s1_x).abs();
        let dy = (s0_y - s1_y).abs();
        let distance = dx + dy;

        if distance < 20 {
            score += 10;
        } else if distance > 30 {
            score -= 5;
        }
    }

    score
}
