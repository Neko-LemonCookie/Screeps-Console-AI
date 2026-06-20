/**
 * WASM Side Module 单元测试
 *
 * 测试3个WASM crate的所有导出函数:
 *   1. calculate_claim - 房间占领评分
 *   2. spawncreep - Creep生成算法
 *   3. tempbuild - 基建布局算法
 */

const fs = require('fs');
const path = require('path');

// WASM文件路径
const WASM_DIR = path.join(__dirname, 'wasm-crates', 'target', 'wasm32-unknown-unknown', 'release');

// 加载WASM模块 (Side Module模式：零导入依赖)
function loadWasm(name) {
    const wasmPath = path.join(WASM_DIR, name);
    const binBuffer = fs.readFileSync(wasmPath);
    const mod = new WebAssembly.Module(binBuffer);
    const inst = new WebAssembly.Instance(mod, {});
    return inst.exports;
}

// ========== 测试框架 ==========
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertEqual(testName, actual, expected) {
    totalTests++;
    if (actual === expected) {
        passedTests++;
        console.log(`  [PASS] ${testName}: ${actual}`);
    } else {
        failedTests++;
        console.error(`  [FAIL] ${testName}: expected ${expected}, got ${actual}`);
    }
}

function assertNotEqual(testName, actual, notExpected) {
    totalTests++;
    if (actual !== notExpected) {
        passedTests++;
        console.log(`  [PASS] ${testName}: ${actual} != ${notExpected}`);
    } else {
        failedTests++;
        console.error(`  [FAIL] ${testName}: got unexpected value ${actual}`);
    }
}

function assertArrayEqual(testName, actualArr, expectedArr) {
    totalTests++;
    if (actualArr.length !== expectedArr.length) {
        failedTests++;
        console.error(`  [FAIL] ${testName}: length mismatch expected=${expectedArr.length} got=${actualArr.length}`);
        return;
    }
    let match = true;
    for (let i = 0; i < actualArr.length; i++) {
        if (actualArr[i] !== expectedArr[i]) {
            match = false;
            break;
        }
    }
    if (match) {
        passedTests++;
        console.log(`  [PASS] ${testName}: [${actualArr}]`);
    } else {
        failedTests++;
        console.error(`  [FAIL] ${testName}: expected [${expectedArr}], got [${actualArr}]`);
    }
}

// Body Part 编码常量
const PART = { MOVE: 0, WORK: 1, CARRY: 2, ATTACK: 3, RANGED_ATTACK: 4, CLAIM: 5 };

async function runAllTests() {
    console.log('\n========================================');
    console.log('  WASM Side Module Unit Tests');
    console.log('========================================\n');

    // ---------- 1. calculate_claim ----------
    console.log('[Module 1] screeps_wasm_calculate_claim');
    const claim = loadWasm('screeps_wasm_calculate_claim.wasm');

    console.log('\n  score_terrain() tests:');
    // 完美房间：墙少(<20%) + 沼泽少(<35%) → 25分
    assertEqual('完美地形 (100墙,200沼泽,0建筑墙)',
        claim.score_terrain(100, 200, 0), 25);
    // 墙多 (>45%) → -5分
    assertEqual('高墙密度 (1500墙,100沼泽,0建筑墙)',
        claim.score_terrain(1500, 100, 0), 0);  // -5 + 5(swamp<35%) = 0
    // 大量建筑墙也算墙
    assertEqual('建筑墙计入总墙数 (0墙,0沼泽,600建筑墙)',
        claim.score_terrain(0, 0, 600), 15);     // 600/2500=0.24→+20, swamp=0→+5 = 25... wait
                                                    // 600/2500=0.24 < 0.2 → +20, swamp=0 → +5 = 25

    // 边界值测试
    assertEqual('边界: 499墙刚好<20% (499/2500=0.1996)',
        claim.score_terrain(499, 0, 0), 25);      // +20 +5 = 25
    assertEqual('边界: 500墙刚好=20% (500/2500=0.20)',
        claim.score_terrain(500, 0, 0), 15);     // 不满足<0.20→+10, swamp<35%→+5 = 15
    assertEqual('边界: 875墙刚好=35% (875/2500=0.35)',
        claim.score_terrain(875, 0, 0), 10);      // 不满足<0.35→+5, +5 = 10
    assertEqual('边界: 1125墙刚好=45% (1125/2500=0.45)',
        claim.score_terrain(1125, 0, 0), 0);      // 不满足<0.45→-5, +5 = 0

    console.log('\n  score_sources() tests:');
    // 双源近距离 → 高分
    assertEqual('双源近距离 (dist=10)',
        claim.score_sources(2, 10, 10, 15, 18), 20);  // 2*5 + 10 = 20
    // 双源远距离 → 扣分
    assertEqual('双源远距离 (dist=40)',
        claim.score_sources(2, 5, 5, 50, 45), 5);      // 2*5 - 5 = 5
    // 单源
    assertEqual('单源',
        claim.score_sources(1, 10, 10, 0, 0), 5);       // 1*5 = 5
    // 无源
    assertEqual('无源',
        claim.score_sources(0, 0, 0, 0, 0), 0);

    // ---------- 2. spawncreep ----------
    console.log('\n[Module 2] screeps_wasm_spawncreep');
    const spawn = loadWasm('screeps_wasm_spawncreep.wasm');

    // 需要memory视图来读取共享缓冲区
    const memView = new Uint8Array(spawn.memory.buffer);

    function readOutputBuf(count) {
        const ptr = spawn.output_ptr();
        return Array.from(memView.slice(ptr, ptr + count));
    }

    console.log('\n  get_common_i_body() tests:');
    // T1: >=850 energy → 13 parts (4W,4C,5M)
    let count = spawn.get_common_i_body(900);
    assertEqual('T1能量>=850 返回数量', count, 13);
    assertArrayEqual('T1部件列表', readOutputBuf(count),
        [PART.WORK,PART.WORK,PART.WORK,PART.WORK,
         PART.CARRY,PART.CARRY,PART.CARRY,PART.CARRY,
         PART.MOVE,PART.MOVE,PART.MOVE,PART.MOVE,PART.MOVE]);

    // T2: 700-849 → 11 parts (4W,3C,4M)
    count = spawn.get_common_i_body(750);
    assertEqual('T2能量700-849 返回数量', count, 11);
    assertArrayEqual('T2部件列表', readOutputBuf(count),
        [PART.WORK,PART.WORK,PART.WORK,PART.WORK,
         PART.CARRY,PART.CARRY,PART.CARRY,
         PART.MOVE,PART.MOVE,PART.MOVE,PART.MOVE]);

    // T3: 600-699 → 9 parts (3W,3C,3M)
    count = spawn.get_common_i_body(650);
    assertEqual('T3能量600-699 返回数量', count, 9);
    assertArrayEqual('T3部件列表', readOutputBuf(count),
        [PART.WORK,PART.WORK,PART.WORK,
         PART.CARRY,PART.CARRY,PART.CARRY,
         PART.MOVE,PART.MOVE,PART.MOVE]);

    // T7: 200-399 → 3 parts (1W,1C,1M)
    count = spawn.get_common_i_body(300);
    assertEqual('T7能量200-399 返回数量', count, 3);
    assertArrayEqual('T7部件列表', readOutputBuf(count),
        [PART.WORK, PART.CARRY, PART.MOVE]);

    // 能量不足
    count = spawn.get_common_i_body(100);
    assertEqual('能量不足<200 返回0', count, 0);

    console.log('\n  get_carrier_i_body() tests:');
    // Carrier动态计算 CARRY+MOVE 对
    count = spawn.get_carrier_i_body(800);
    assertEqual('800能量=8对CM 返回16字节', count, 16);
    let carrierParts = readOutputBuf(count);
    assertEqual('Carrier全部是CARRY/MOVE交替',
        carrierParts.every((v, i) => v === (i % 2 === 0 ? PART.CARRY : PART.MOVE)), true);

    count = spawn.get_carrier_i_body(150);
    assertEqual('150能量=1对CM 返回2字节', count, 2);

    count = spawn.get_carrier_i_body(50);
    assertEqual('50能量不足1对 返回0', count, 0);

    console.log('\n  get_attacker_i_body() tests:');
    // T1: >=1180 → 16 parts (6A,2R,8M)
    count = spawn.get_attacker_i_body(1200);
    assertEqual('T1能量>=1180 返回16', count, 16);

    // T5: 390-779 → 6 parts (3A,3M)
    count = spawn.get_attacker_i_body(500);
    assertEqual('T5能量390-779 返回6', count, 6);
    assertArrayEqual('T5部件列表', readOutputBuf(count),
        [PART.ATTACK, PART.ATTACK, PART.ATTACK,
         PART.MOVE, PART.MOVE, PART.MOVE]);

    console.log('\n  get_claimer_i_body() tests:');
    // T1: >=1300 → 4 parts (2K,2M)
    count = spawn.get_claimer_i_body(1400);
    assertEqual('T1能量>=1300 返回4', count, 4);
    assertArrayEqual('T1部件列表', readOutputBuf(count),
        [PART.CLAIM, PART.CLAIM, PART.MOVE, PART.MOVE]);

    // T2: 650-1299 → 2 parts (1K,1M)
    count = spawn.get_claimer_i_body(700);
    assertEqual('T2能量650-1299 返回2', count, 2);
    assertArrayEqual('T2部件列表', readOutputBuf(count),
        [PART.CLAIM, PART.MOVE]);

    // 能量不足
    count = spawn.get_claimer_i_body(500);
    assertEqual('Claimer能量不足 返回0', count, 0);

    console.log('\n  calc_body_cost() tests:');
    // 手动构造一个body数组写入内存来测试cost计算
    // 用简单方式：直接传指针和长度
    // 先写一些parts到缓冲区
    const testParts = [PART.MOVE, PART.WORK, PART.CARRY, PART.MOVE]; // M,W,C,M = 50+100+50+50 = 250
    const testPtr = spawn.output_ptr();
    for (let i = 0; i < testParts.length; i++) {
        memView[testPtr + i] = testParts[i];
    }
    assertEqual('M+W+C+M cost',
        spawn.calc_body_cost(testPtr, testParts.length), 250);

    // CLAIM = 600
    const claimParts = [PART.CLAIM];
    for (let i = 0; i < claimParts.length; i++) {
        memView[testPtr + i] = claimParts[i];
    }
    assertEqual('CLAIM cost',
        spawn.calc_body_cost(testPtr, claimParts.length), 600);

    // 空数组
    assertEqual('空body cost',
        spawn.calc_body_cost(testPtr, 0), 0);

    // ---------- 3. tempbuild ----------
    console.log('\n[Module 3] screeps_wasm_tempbuild');
    const temp = loadWasm('screeps_wasm_tempbuild.wasm');
    const tempMemView = new Uint8Array(temp.memory.buffer);

    function writeInputBuf(coords) {
        const ptr = temp.input_ptr();
        for (let i = 0; i < coords.length; i++) {
            tempMemView[ptr + i] = coords[i];
        }
    }

    function readTempOutputBuf(count) {
        const ptr = temp.output_ptr();
        return Array.from(tempMemView.slice(ptr, ptr + count * 2));
    }

    console.log('\n  get_mining_spots() tests:');
    // 场景1：对象在中心(25,25)，周围没有墙 → 应返回8个位置(排除中心)
    writeInputBuf([]);  // 无墙
    count = temp.get_mining_spots(25, 25, 0);
    assertEqual('中心无墙返回8个采矿位', count, 8);

    // 场景2：对象在角落(0,0)，只有3个有效邻域
    writeInputBuf([]);
    count = temp.get_mining_spots(0, 0, 0);
    assertEqual('角落无墙返回3个采矿位', count, 3);

    // 场景3：对象在边缘(0,25)，有5个有效邻域
    writeInputBuf([]);
    count = temp.get_mining_spots(0, 25, 0);
    assertEqual('边缘无墙返回5个采矿位', count, 5);

    // 场景4：有墙阻挡
    // 对象在(25,25)，在(24,25)有墙 → 应返回7个
    writeInputBuf([24, 25]);  // 左边有墙
    count = temp.get_mining_spots(25, 25, 1);
    assertEqual('1面有墙返回7个采矿位', count, 7);

    // 场景5：多个墙
    writeInputBuf([24, 25, 26, 25, 25, 24]);  // 左右上有墙
    count = temp.get_mining_spots(25, 25, 3);
    assertEqual('3面有墙返回5个采矿位', count, 5);

    // 场景6：完全被围堵
    // 围堵(25,25)的全部8个邻域
    writeInputBuf([
        24, 24, 25, 24, 26, 24,  // 上排
        24, 25,         26, 25,  // 中排(左右)
        24, 26, 25, 26, 26, 26   // 下排
    ]);
    count = temp.get_mining_spots(25, 25, 8);
    assertEqual('全包围返回0个采矿位', count, 0);

    // 场景7：越界坐标应忽略
    writeInputBuf([]);
    count = temp.get_mining_spots(49, 49, 0);
    assertEqual('右下角返回3个采矿位', count, 3);

    // ========== 结果汇总 ==========
    console.log('\n========================================');
    console.log(`  Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
    console.log('========================================\n');

    if (failedTests > 0) {
        process.exit(1);
    } else {
        console.log('All tests PASSED!\n');
        process.exit(0);
    }
}

runAllTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
