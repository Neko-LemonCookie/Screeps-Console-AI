//! 能量源分布评分算法
//! 对应 JS: lib.AP.calculate_claim._scoreSources()

use crate::data_types::SourcePosition;
use wasm_bindgen::prelude::*;

/// 计算能量源得分（0 ~ 25）
///
/// Scoring Rules:
/// - 每个 Source: +5 base
/// - 双源距离 < 20: +10 bonus
/// - 双源距离 > 30: -5 penalty
#[wasm_bindgen]
pub fn score_sources(sources: Vec<SourcePosition>) -> i32 {
    let count = sources.len();
    let mut score = (count as i32) * 5;

    if count >= 2 {
        let dx = (sources[0].x as i16 - sources[1].x as i16).abs();
        let dy = (sources[0].y as i16 - sources[1].y as i16).abs();
        let distance = dx + dy;

        if distance < 20 {
            score += 10;
        } else if distance > 30 {
            score -= 5;
        }
    }

    score
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data_types::SourcePosition;

    #[test]
    fn test_two_close_sources() {
        let sources = vec![
            SourcePosition { x: 10, y: 10 },
            SourcePosition { x: 15, y: 12 }, // distance = 7
        ];
        let score = score_sources(sources);
        assert_eq!(score, 20); // 2*5 + 10
    }

    #[test]
    fn test_single_source() {
        let sources = vec![SourcePosition { x: 25, y: 25 }];
        let score = score_sources(sources);
        assert_eq!(score, 5);
    }
}
