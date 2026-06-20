//! screeps-wasm-spawncreep
//!
//! Screeps AI - Creep 生成算法 WASM Side Module
//!
//! 编译: cargo build --target wasm32-unknown-unknown --release
//!
//! Body Part 编码（单字节，用于共享内存传输）:
//!   0 = move(M), 1 = work(W), 2 = carry(C),
//!   3 = attack(A), 4 = ranged_attack(R), 5 = claim(K)
//!
//! 使用方式（Screeps JS）:
//!   const buf = require('spawncreep');
//!   const mod = new WebAssembly.Module(buf);
//!   const inst = new WebAssembly.Instance(mod, {});
//!   const e = inst.exports;
//!   const MEM = new Uint8Array(e.memory.buffer);
//!   let ptr = e.output_ptr();
//!   let n = e.get_common_i_body(850);       // 返回部件数量
//!   let parts = MEM.subarray(ptr, ptr + n); // 读取编码后的部件数组

/// 共享输出缓冲区（JS 通过 output_ptr() 获取地址后读取）
#[no_mangle]
pub static OUTPUT_BUF: [u8; 64] = [0; 64];

/// 获取输出缓冲区的内存偏移地址
#[no_mangle]
pub extern "C" fn output_ptr() -> i32 {
    unsafe { OUTPUT_BUF.as_ptr() as i32 }
}

// === Body Part 常量 ===
const MOVE: u8 = 0;
const WORK: u8 = 1;
const CARRY: u8 = 2;
const ATTACK: u8 = 3;
const RANGED_ATTACK: u8 = 4;
const CLAIM: u8 = 5;

/// 将部件列表写入输出缓冲区，返回数量
fn write_parts(buf: &mut [u8], parts: &[u8]) -> i32 {
    let len = parts.len().min(buf.len());
    buf[..len].copy_from_slice(&parts[..len]);
    len as i32
}

/// 获取 CommonI 型 Creep 部件 → 写入OUTPUT_BUF，返回数量
#[no_mangle]
pub extern "C" fn get_common_i_body(energy_available: u32) -> i32 {
    let parts = match energy_available {
        850..=u32::MAX => &[WORK,WORK,WORK,WORK, CARRY,CARRY,CARRY,CARRY, MOVE,MOVE,MOVE,MOVE,MOVE],
        700..=849 => &[WORK,WORK,WORK,WORK, CARRY,CARRY,CARRY, MOVE,MOVE,MOVE,MOVE],
        600..=699 => &[WORK,WORK,WORK, CARRY,CARRY,CARRY, MOVE,MOVE,MOVE],
        550..=599 => &[WORK,WORK,WORK, CARRY,CARRY, MOVE,MOVE,MOVE],
        450..=549 => &[WORK,WORK,WORK, CARRY, MOVE,MOVE],
        400..=449 => &[WORK,WORK, CARRY,CARRY, MOVE,MOVE],
        200..=399 => &[WORK, CARRY, MOVE],
        _ => return 0,
    };
    unsafe { write_parts(&mut OUTPUT_BUF.clone(), parts) }
}

/// 获取 CarrierI 型 Creep 部件 → 写入OUTPUT_BUF，返回数量
#[no_mangle]
pub extern "C" fn get_carrier_i_body(energy_available: u32) -> i32 {
    const PAIR_COST: u32 = 100;
    const MAX_ENERGY: u32 = 800;

    let max_energy = energy_available.min(MAX_ENERGY);
    let pairs = max_energy / PAIR_COST;

    let mut parts = Vec::with_capacity((pairs * 2) as usize);
    for _ in 0..pairs {
        parts.push(CARRY);
        parts.push(MOVE);
    }

    unsafe { write_parts(&mut OUTPUT_BUF.clone(), &parts) }
}

/// 获取 AttackerI 型 Creep 部件 → 写入OUTPUT_BUF，返回数量
#[no_mangle]
pub extern "C" fn get_attacker_i_body(energy_available: u32) -> i32 {
    let parts = match energy_available {
        1180..=u32::MAX => &[ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK, RANGED_ATTACK,RANGED_ATTACK,
                              MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],
        980..=1179 => &[ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK, RANGED_ATTACK,
                             MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],
        920..=979 => &[ATTACK,ATTACK,ATTACK,ATTACK, RANGED_ATTACK,RANGED_ATTACK,
                            MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],
        780..=919 => &[ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,
                        MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],
        390..=779 => &[ATTACK,ATTACK,ATTACK, MOVE,MOVE,MOVE],
        _ => return 0,
    };
    unsafe { write_parts(&mut OUTPUT_BUF.clone(), parts) }
}

/// 获取 ClaimerI 型 Creep 部件 → 写入OUTPUT_BUF，返回数量
#[no_mangle]
pub extern "C" fn get_claimer_i_body(energy_available: u32) -> i32 {
    let parts = match energy_available {
        1300..=u32::MAX => &[CLAIM, CLAIM, MOVE, MOVE],
        650..=1299 => &[CLAIM, MOVE],
        _ => return 0,
    };
    unsafe { write_parts(&mut OUTPUT_BUF.clone(), parts) }
}

/// 计算部件列表总能量消耗
///
/// # Arguments
/// * `parts_ptr` - 部件编码数组的内存指针（由JS传入）
/// * `parts_len` - 数组长度
///
/// # Returns 总能量消耗
#[no_mangle]
pub extern "C" fn calc_body_cost(parts_ptr: i32, parts_len: i32) -> u32 {
    const COST_MAP: [u32; 6] = [50, 100, 50, 80, 150, 600]; // M,W,C,A,R,K

    let base = parts_ptr as *const u8;
    let mut total = 0u32;

    for i in 0..parts_len {
        let part_type = unsafe { *base.offset(i as isize) } as usize;
        if part_type < COST_MAP.len() {
            total += COST_MAP[part_type];
        }
    }

    total
}
