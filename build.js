/**
 * build.js
 *
 * 一键打包脚本：将所有Screeps运行时需要的文件复制到 dist/ 目录
 *
 * 用法：node build.js
 *
 * dist/ 目录结构可直接复制到游戏文件夹或通过screeps-cli上传
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// === 运行时需要的文件清单（相对于根目录） ===
const RUNTIME_FILES = [
    // 入口 & 模块系统
    'main.js',
    'module.references.js',
    'module.roleDispatcher.js',

    // 决策AI层
    'AP.developv1.js',
    'AP.developv1.L3.js',
    'AP.developv1.L5.js',
    'AP.developv1.L7.js',
    'AP.developv1.max.js',
    'AP.developv2.js',
    'AP.developv2.L4.js',
    'AP.developv2.L5.js',
    'AP.developv2.max.js',
    'AP.claim.js',
    'AP.fight.js',

    // 集成层
    'AP.taskhandler.js',
    'AP.autobuild.js',
    'AP.memcleaner.js',

    // 核心库
    'lib.AP.taskboard.js',
    'lib.AP.search.js',
    'lib.AP.market.js',
    'lib.AP.automarket.js',
    'lib.AP.spawncreep.js',
    'lib.AP.tempbuild.js',
    'lib.AP.calculate_claim.js',
    'lib.AP.taskHelper.js',
    'lib.AP.wasm_loader.js',

    // 建筑模块
    'building.spawn.js',
    'building.link.js',
    'building.lab.js',
    'building.factory.js',
    'building.terminal.js',
    'building.tower.js',
    'building.nuker.js',

    // Creep任务
    'task.creep.harvest.js',
    'task.creep.upgrade.js',
    'task.creep.build.js',
    'task.creep.repair.js',
    'task.creep.carry.js',
    'task.creep.attack.js',
    'task.creep.claim.js',
    'task.creep.reserve.js',
    'task.creep.globalcarry.js',
    'task.creep.boost.js',
    'task.creep.sign.js',
    'task.creep.police.js',
    'task.creep.claimbuild.js',
    'task.creep.claimupgrade.js',

    // Creep行为
    'creep.unibot.js',

    // WASM适配器
    'js-adapters/wasm_calculate_claim.js',
    'js-adapters/wasm_spawncreep.js',
    'js-adapters/wasm_tempbuild.js',

    // 用户工具
    'User.tasksender.js',

    // WASM字节包装器（Uint8Array JS文件）
    'wasm/calculate_claim.js',
    'wasm/spawncreep.js',
    'wasm/tempbuild.js',
];

// === WASM胶水代码（pkg目录，运行时必须） ===
const PKG_FILES = [
    'wasm-crates/calculate_claim/pkg/screeps_wasm_calculate_claim.js',
    'wasm-crates/calculate_claim/pkg/screeps_wasm_calculate_claim_bg.wasm',
    'wasm-crates/spawncreep/pkg/screeps_wasm_spawncreep.js',
    'wasm-crates/spawncreep/pkg/screeps_wasm_spawncreep_bg.wasm',
    'wasm-crates/tempbuild/pkg/screeps_wasm_tempbuild.js',
    'wasm-crates/tempbuild/pkg/screeps_wasm_tempbuild_bg.wasm',
];

// === 工具函数 ===
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function copyFile(src, dst) {
    ensureDir(path.dirname(dst));
    fs.copyFileSync(src, dst);
}

function checkFile(filePath) {
    const full = path.join(ROOT, filePath);
    if (!fs.existsSync(full)) {
        console.error('  [MISSING] ' + filePath);
        return false;
    }
    return true;
}

// === 主流程 ===
console.log('========================================');
console.log('  Screeps AI Build Script');
console.log('  Output: dist/');
console.log('========================================');
console.log('');

// 清理旧的输出
if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
}
console.log('[1/3] 清理旧输出... OK');

// 复制主文件
let missing = 0;
let copied = 0;

console.log('\n[2/3] 复制运行时文件...');
for (const file of RUNTIME_FILES) {
    if (checkFile(file)) {
        copyFile(path.join(ROOT, file), path.join(DIST, file));
        copied++;
    } else {
        missing++;
    }
}

// 复制WASM胶水代码
console.log('\n  复制WASM胶水代码...');
for (const file of PKG_FILES) {
    if (checkFile(file)) {
        copyFile(path.join(ROOT, file), path.join(DIST, file));
        copied++;
    } else {
        missing++;
    }
}

// 统计
console.log('\n[3/3] 打包完成!');
console.log('  复制: ' + copied + ' 文件');
if (missing > 0) {
    console.error('  缺失: ' + missing + ' 文件 ← 需要先构建WASM');
} else {
    console.log('  缺失: 0 (完整)');
}

// 输出大小统计
function calcSize(dir) {
    let total = 0;
    let count = 0;
    function walk(d) {
        const items = fs.readdirSync(d);
        for (const item of items) {
            const full = path.join(d, item);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
                walk(full);
            } else {
                total += stat.size;
                count++;
            }
        }
    }
    walk(dir);
    return { count, sizeKB: Math.round(total / 1024) };
}

const stats = calcSize(DIST);
console.log('  总计: ' + stats.count + ' 文件, ~' + stats.sizeKB + ' KB');
console.log('');
console.log('使用方法:');
console.log('  1. 复制 dist/ 内全部内容到游戏脚本文件夹');
console.log('  2. 或用 screeps-cli: screeps sync');
console.log('');
if (missing > 0) {
    console.warn('  ⚠ 有缺失文件！请先在 wasm-crates/ 下运行 wasm-pack build --target nodejs');
    process.exit(1);
} else {
    console.log('  ✓ 全部就绪，可以直接部署！');
}
