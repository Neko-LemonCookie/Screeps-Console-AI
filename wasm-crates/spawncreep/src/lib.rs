//! screeps-wasm-spawncreep
//!
//! Screeps AI - Creep 生成算法 WASM Side Module
//!
//! 编译: cargo build --target wasm32-unknown-unknown --release
//!
//! Body Part 编码（单字节）:
//!   0 = move(M), 1 = work(W), 2 = carry(C),
//!   3 = attack(A), 4 = ranged_attack(R), 5 = claim(K)

const MOVE: u8 = 0;
const WORK: u8 = 1;
const CARRY: u8 = 2;
const ATTACK: u8 = 3;
const RANGED_ATTACK: u8 = 4;
const CLAIM: u8 = 5;

/// 共享输出缓冲区（64字节，JS通过output_ptr获取地址后读取）
#[unsafe(no_mangle)]
pub static mut OUTPUT_BUF: [u8; 64] = [0; 64];

/// 获取输出缓冲区地址（返回i32指针值，不创建引用）
#[unsafe(no_mangle)]
pub extern "C" fn output_ptr() -> i32 {
    core::ptr::addr_of_mut!(OUTPUT_BUF) as *mut u8 as i32
}

/// 写入部件到OUTPUT_BUF，返回数量
fn write_parts(parts: &[u8]) -> i32 {
    let buf_ptr = core::ptr::addr_of_mut!(OUTPUT_BUF) as *mut u8;
    let len = parts.len().min(64);
    unsafe { core::ptr::copy_nonoverlapping(parts.as_ptr(), buf_ptr, len); }
    len as i32
}

/// 获取 CommonI 型 Creep 部件 → 写入OUTPUT_BUF，返回数量
#[unsafe(no_mangle)]
pub extern "C" fn get_common_i_body(energy_available: u32) -> i32 {
    const T1: &[u8] = &[WORK,WORK,WORK,WORK, CARRY,CARRY,CARRY,CARRY, MOVE,MOVE,MOVE,MOVE,MOVE];
    const T2: &[u8] = &[WORK,WORK,WORK,WORK, CARRY,CARRY,CARRY, MOVE,MOVE,MOVE,MOVE];
    const T3: &[u8] = &[WORK,WORK,WORK, CARRY,CARRY,CARRY, MOVE,MOVE,MOVE];
    const T4: &[u8] = &[WORK,WORK,WORK, CARRY,CARRY, MOVE,MOVE,MOVE];
    const T5: &[u8] = &[WORK,WORK,WORK, CARRY, MOVE,MOVE];
    const T6: &[u8] = &[WORK,WORK, CARRY,CARRY, MOVE,MOVE];
    const T7: &[u8] = &[WORK, CARRY, MOVE];

    match energy_available {
        850..=u32::MAX => write_parts(T1),
        700..=849     => write_parts(T2),
        600..=699     => write_parts(T3),
        550..=599     => write_parts(T4),
        450..=549     => write_parts(T5),
        400..=449     => write_parts(T6),
        200..=399     => write_parts(T7),
        _             => 0,
    }
}

/// 获取 CarrierI 型 Creep 部件 → 写入OUTPUT_BUF，返回数量
#[unsafe(no_mangle)]
pub extern "C" fn get_carrier_i_body(energy_available: u32) -> i32 {
    const PAIR_COST: u32 = 100;
    const MAX_ENERGY: u32 = 800;

    let max_energy = energy_available.min(MAX_ENERGY);
    let pairs = (max_energy / PAIR_COST) as usize;
    let total_bytes = pairs * 2;

    if total_bytes == 0 || total_bytes > 64 { return 0; }

    // 直接写入OUTPUT_BUF的裸指针
    let buf_ptr = core::ptr::addr_of_mut!(OUTPUT_BUF) as *mut u8;
    for i in 0..pairs {
        let off = i * 2;
        unsafe { *buf_ptr.add(off) = CARRY; }
        unsafe { *buf_ptr.add(off + 1) = MOVE; }
    }
    total_bytes as i32
}

/// 获取 AttackerI 型 Creep 部件 → 写入OUTPUT_BUF，返回数量
#[unsafe(no_mangle)]
pub extern "C" fn get_attacker_i_body(energy_available: u32) -> i32 {
    const T1: &[u8] = &[
        ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,
        RANGED_ATTACK,RANGED_ATTACK,
        MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,
    ];
    const T2: &[u8] = &[
        ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,
        RANGED_ATTACK,
        MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,
    ];
    const T3: &[u8] = &[
        ATTACK,ATTACK,ATTACK,ATTACK,
        RANGED_ATTACK,RANGED_ATTACK,
        MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,
    ];
    const T4: &[u8] = &[
        ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,
        MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,
    ];
    const T5: &[u8] = &[ATTACK,ATTACK,ATTACK, MOVE,MOVE,MOVE];

    match energy_available {
        1180..=u32::MAX => write_parts(T1),
        980..=1179     => write_parts(T2),
        920..=979      => write_parts(T3),
        780..=919      => write_parts(T4),
        390..=779      => write_parts(T5),
        _              => 0,
    }
}

/// 获取 ClaimerI 型 Creep 部件 → 写入OUTPUT_BUF，返回数量
#[unsafe(no_mangle)]
pub extern "C" fn get_claimer_i_body(energy_available: u32) -> i32 {
    const T1: &[u8] = &[CLAIM, CLAIM, MOVE, MOVE];
    const T2: &[u8] = &[CLAIM, MOVE];

    match energy_available {
        1300..=u32::MAX => write_parts(T1),
        650..=1299      => write_parts(T2),
        _               => 0,
    }
}

/// 计算部件列表总能量消耗
/// parts_ptr: 部件编码数组内存指针, parts_len: 数组长度
#[unsafe(no_mangle)]
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
