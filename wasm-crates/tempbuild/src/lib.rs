//! screeps-wasm-tempbuild
//!
//! Screeps AI - 基建布局算法 WASM Side Module
//!
//! 编译: cargo build --target wasm32-unknown-unknown --release
//!
//! 使用方式（Screeps JS）:
//!   const buf = require('tempbuild');
//!   const mod = new WebAssembly.Module(buf);
//!   const inst = new WebAssembly.Instance(mod, {});
//!   const e = inst.exports;
//!   const MEM = new Uint8Array(e.memory.buffer);
//!
//!   // 1. 写入墙坐标到输入缓冲区（每2字节=一个坐标 x,y）
//!   let inPtr = e.input_ptr();
//!   MEM.set([10,10, 11,12], inPtr); // 2个墙坐标
//!
//!   // 2. 调用计算，返回采矿位数量（每个位占2字节 x,y）
//!   let n = e.get_mining_spots(25, 25, 2);
//!
//!   // 3. 从输出缓冲区读取结果
//!   let outPtr = e.output_ptr();
//!   let spots = [];
//!   for (let i = 0; i < n; i++) {
//!       spots.push({ x: MEM[outPtr + i*2], y: MEM[outPtr + i*2 + 1] });
//!   }

/// 输入缓冲区：JS 写入墙坐标 [x0,y0, x1,y1, ...]
#[no_mangle]
pub static INPUT_BUF: [u8; 256] = [0; 256];

/// 输出缓冲区：WASM 写入采矿位坐标 [x0,y0, x1,y1, ...]
#[no_mangle]
pub static OUTPUT_BUF: [u8; 32] = [0; 32];

/// 获取输入缓冲区的内存偏移地址
#[no_mangle]
pub extern "C" fn input_ptr() -> i32 {
    unsafe { INPUT_BUF.as_ptr() as i32 }
}

/// 获取输出缓冲区的内存偏移地址
#[no_mangle]
pub extern "C" fn output_ptr() -> i32 {
    unsafe { OUTPUT_BUF.as_ptr() as i32 }
}

/// 计算可用采矿位 → 写入OUTPUT_BUF，返回数量（每个位2字节: x, y）
///
/// # Arguments
/// * `obj_x` / `obj_y` - 对象坐标 (0-49)
/// * `wall_count` - 墙坐标对数量（INPUT_BUF中已写入的数据量/2）
///
/// # Returns 采矿位数量（最多8个）
#[no_mangle]
pub extern "C" fn get_mining_spots(obj_x: i32, obj_y: i32, wall_count: i32) -> i32 {
    // 从输入缓冲区构建墙集合
    let mut wall_set = std::collections::HashSet::new();
    let base = unsafe { INPUT_BUF.as_ptr() };

    for i in 0..wall_count {
        let offset = (i * 2) as isize;
        let wx = unsafe { *base.offset(offset) };
        let wy = unsafe { *base.offset(offset + 1) };
        wall_set.insert((wx, wy));
    }

    // 扫描3x3邻域
    let mut spots = Vec::with_capacity(8);

    for dx in [-1i8, 0, 1] {
        for dy in [-1i8, 0, 1] {
            if dx == 0 && dy == 0 { continue; }

            let px = obj_x + dx as i32;
            let py = obj_y + dy as i32;

            if px < 0 || px > 49 || py < 0 || py > 49 { continue; }

            if !wall_set.contains(&(px as u8, py as u8)) {
                spots.push(px as u8);
                spots.push(py as u8);
            }
        }
    }

    // 写入输出缓冲区
    let count = (spots.len() / 2) as i32;
    unsafe {
        let out_base = OUTPUT_BUF.as_mut_ptr();
        for (i, &val) in spots.iter().enumerate() {
            *out_base.offset(i as isize) = val;
        }
    }

    count
}
