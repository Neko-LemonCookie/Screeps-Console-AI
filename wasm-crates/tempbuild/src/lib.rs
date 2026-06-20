//! screeps-wasm-tempbuild
//!
//! Screeps AI - 基建布局算法 WASM Side Module
//!
//! 编译: cargo build --target wasm32-unknown-unknown --release

/// 输入缓冲区：JS 写入墙坐标 [x0,y0, x1,y1, ...] (256字节)
#[unsafe(no_mangle)]
pub static mut INPUT_BUF: [u8; 256] = [0; 256];

/// 输出缓冲区：WASM 写入采矿位坐标 [x0,y0, x1,y1, ...] (32字节)
#[unsafe(no_mangle)]
pub static mut OUTPUT_BUF: [u8; 32] = [0; 32];

/// 获取输入缓冲区的内存偏移地址（不创建引用）
#[unsafe(no_mangle)]
pub extern "C" fn input_ptr() -> i32 {
    core::ptr::addr_of_mut!(INPUT_BUF) as *mut u8 as i32
}

/// 获取输出缓冲区的内存偏移地址（不创建引用）
#[unsafe(no_mangle)]
pub extern "C" fn output_ptr() -> i32 {
    core::ptr::addr_of_mut!(OUTPUT_BUF) as *mut u8 as i32
}

/// 计算可用采矿位 → 写入OUTPUT_BUF，返回数量（每个位2字节: x, y）
///
/// # Arguments
/// * `obj_x` / `obj_y` - 对象坐标 (0-49)
/// * `wall_count` - 墙坐标对数量（INPUT_BUF中已写入的数据量/2）
#[unsafe(no_mangle)]
pub extern "C" fn get_mining_spots(obj_x: i32, obj_y: i32, wall_count: i32) -> i32 {
    // 用裸指针从INPUT_BUF读取墙坐标
    let mut wall_set: [(u8, u8); 128] = [(0, 0); 128];
    let actual_walls = (wall_count as usize).min(128);

    unsafe {
        let in_ptr = core::ptr::addr_of!(INPUT_BUF) as *const u8;
        for i in 0..actual_walls {
            let off = (i * 2) as isize;
            wall_set[i].0 = *in_ptr.add(off as usize);
            wall_set[i].1 = *in_ptr.add(off as usize + 1);
        }
    }

    // 扫描3x3邻域，收集可用位置
    let mut spots: [u8; 16] = [0; 16];
    let mut spot_count: usize = 0;

    for dx in [-1i8, 0, 1] {
        for dy in [-1i8, 0, 1] {
            if dx == 0 && dy == 0 { continue; }

            let px = obj_x + dx as i32;
            let py = obj_y + dy as i32;

            if px < 0 || px > 49 || py < 0 || py > 49 { continue; }

            let blocked = (0..actual_walls).any(|i| {
                wall_set[i].0 == (px as u8) && wall_set[i].1 == (py as u8)
            });

            if !blocked && spot_count < 16 {
                spots[spot_count] = px as u8;
                spot_count += 1;
                spots[spot_count] = py as u8;
                spot_count += 1;
            }
        }
    }

    // 用裸指针写入OUTPUT_BUF
    let out_ptr = core::ptr::addr_of_mut!(OUTPUT_BUF) as *mut u8;
    for i in 0..spot_count {
        unsafe { *out_ptr.add(i) = spots[i]; }
    }

    (spot_count / 2) as i32
}
