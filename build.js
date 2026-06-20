/**
 * build.js
 *
 * 一键打包脚本：扁平化到 dist/ 根目录（Screeps Side Module 要求）
 *
 * Screeps 的 require() 只支持扁平命名空间，不支持子目录路径：
 *   require('lib.AP.taskboard')     ✅ 扁平名称OK
 *   require('calculate_claim')      ✅ Binary WASM 模块也OK！
 *   require('wasm/calc.js')         ❌ 带路径会报错
 *
 * 本脚本自动完成：
 *   1. 复制所有JS运行时文件到 dist/
 *   2. 复制WASM二进制文件（.wasm）作为Binary模块
 *   3. 扁平化：子目录文件重命名（加前缀防冲突）
 *   4. 替换所有 require() 路径为扁平名称
 *
 * 用法：node build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// ============================================================
// 文件清单：源路径 → 扁平目标名
// ============================================================

const FILE_MAP = [
    // === 入口 & 模块系统 ===
    ['main.js',                                    'main.js'],
    ['module.references.js',                       'module.references.js'],
    ['module.roleDispatcher.js',                   'module.roleDispatcher.js'],

    // === 决策AI层 ===
    ['AP.developv1.js',                            'AP.developv1.js'],
    ['AP.developv1.L3.js',                         'AP.developv1.L3.js'],
    ['AP.developv1.L5.js',                         'AP.developv1.L5.js'],
    ['AP.developv1.L7.js',                         'AP.developv1.L7.js'],
    ['AP.developv1.max.js',                        'AP.developv1.max.js'],
    ['AP.developv2.js',                            'AP.developv2.js'],
    ['AP.developv2.L4.js',                         'AP.developv2.L4.js'],
    ['AP.developv2.L5.js',                         'AP.developv2.L5.js'],
    ['AP.developv2.max.js',                        'AP.developv2.max.js'],
    ['AP.claim.js',                                'AP.claim.js'],
    ['AP.fight.js',                                'AP.fight.js'],

    // === 集成层 ===
    ['AP.taskhandler.js',                          'AP.taskhandler.js'],
    ['AP.autobuild.js',                            'AP.autobuild.js'],
    ['AP.memcleaner.js',                           'AP.memcleaner.js'],

    // === 核心库 ===
    ['lib.AP.taskboard.js',                        'lib.AP.taskboard.js'],
    ['lib.AP.search.js',                           'lib.AP.search.js'],
    ['lib.AP.market.js',                           'lib.AP.market.js'],
    ['lib.AP.automarket.js',                       'lib.AP.automarket.js'],
    ['lib.AP.spawncreep.js',                       'lib.AP.spawncreep.js'],
    ['lib.AP.tempbuild.js',                        'lib.AP.tempbuild.js'],
    ['lib.AP.calculate_claim.js',                  'lib.AP.calculate_claim.js'],
    ['lib.AP.taskHelper.js',                       'lib.AP.taskHelper.js'],
    ['lib.AP.wasm_loader.js',                      'lib.AP.wasm_loader.js'],

    // === 建筑模块 ===
    ['building.spawn.js',                          'building.spawn.js'],
    ['building.link.js',                           'building.link.js'],
    ['building.lab.js',                            'building.lab.js'],
    ['building.factory.js',                        'building.factory.js'],
    ['building.terminal.js',                       'building.terminal.js'],
    ['building.tower.js',                          'building.tower.js'],
    ['building.nuker.js',                          'building.nuker.js'],

    // === Creep任务 ===
    ['task.creep.harvest.js',                      'task.creep.harvest.js'],
    ['task.creep.upgrade.js',                     'task.creep.upgrade.js'],
    ['task.creep.build.js',                       'task.creep.build.js'],
    ['task.creep.repair.js',                      'task.creep.repair.js'],
    ['task.creep.carry.js',                       'task.creep.carry.js'],
    ['task.creep.attack.js',                      'task.creep.attack.js'],
    ['task.creep.claim.js',                       'task.creep.claim.js'],
    ['task.creep.reserve.js',                     'task.creep.reserve.js'],
    ['task.creep.globalcarry.js',                 'task.creep.globalcarry.js'],
    ['task.creep.boost.js',                       'task.creep.boost.js'],
    ['task.creep.sign.js',                        'task.creep.sign.js'],
    ['task.creep.police.js',                      'task.creep.police.js'],
    ['task.creep.claimbuild.js',                  'task.creep.claimbuild.js'],
    ['task.creep.claimupgrade.js',                'task.creep.claimupgrade.js'],

    // === Creep行为 ===
    ['creep.unibot.js',                           'creep.unibot.js'],

    // === WASM适配器（js-adapters/ → adapter. 前缀）===
    ['js-adapters/wasm_calculate_claim.js',       'adapter.wasm_calculate_claim.js'],
    ['js-adapters/wasm_spawncreep.js',            'adapter.wasm_spawncreep.js'],
    ['js-adapters/wasm_tempbuild.js',             'adapter.wasm_tempbuild.js'],

    // === 用户工具 ===
    ['User.tasksender.js',                        'User.tasksender.js'],

    // ============================================================
    // ★★★ WASM 二进制模块（Side Module，直接require加载）★★★
    // Screeps 原生支持：require('name') 返回 ArrayBuffer
    // 然后用 WebAssembly.Module(buf) + Instance(mod, {}) 加载
    // ============================================================
    ['wasm-crates/target/wasm32-unknown-unknown/release/screeps_wasm_calculate_claim.wasm',
                                                'calculate_claim.wasm'],
    ['wasm-crates/target/wasm32-unknown-unknown/release/screeps_wasm_spawncreep.wasm',
                                                'spawncreep.wasm'],
    ['wasm-crates/target/wasm32-unknown-unknown/release/screeps_wasm_tempbuild.wasm',
                                                'tempbuild.wasm'],
];

// ============================================================
// 工具函数
// ============================================================

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function checkFile(filePath) {
    return fs.existsSync(path.join(ROOT, filePath));
}

/** 对JS文件内容执行 require() 路径替换 */
function replaceRequires(content) {
    var result = content;

    // js-adapters 路径替换
    result = result.replace(
        /require\('js-adapters\/([^']+)'\)/g,
        "require('adapter.$1')"
    );

    return result;
}

// ============================================================
// 主流程
// ============================================================

console.log('========================================');
console.log('  Screeps AI Build Script (Side Module)');
console.log('  Output: dist/ (flat, JS + .wasm Binary)');
console.log('========================================');
console.log('');

if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
ensureDir(DIST);
console.log('[1/3] 清理旧输出... OK');

var missing = 0;
var copied = 0;
var replaced = 0;
var wasmTotalSize = 0;

console.log('\n[2/3] 复制文件...');
for (var i = 0; i < FILE_MAP.length; i++) {
    var srcPath = FILE_MAP[i][0];
    var dstName = FILE_MAP[i][1];

    if (!checkFile(srcPath)) {
        console.error('  [MISSING] ' + srcPath);
        missing++;
        continue;
    }

    var srcFull = path.join(ROOT, srcPath);
    var dstFull = path.join(DIST, dstName);

    // 区分二进制和文本文件
    var isWasm = dstName.endsWith('.wasm');

    if (isWasm) {
        // 二进制文件直接复制（不修改）
        fs.copyFileSync(srcFull, dstFull);
        var sz = fs.statSync(dstFull).size;
        wasmTotalSize += sz;
        console.log('  [WASM] ' + dstName + ' (' + Math.round(sz / 1024) + 'KB)');
    } else {
        // JS文件：读取 → 替换require路径 → 写入
        var content = fs.readFileSync(srcFull, 'utf8');
        var newContent = replaceRequires(content);
        if (newContent !== content) replaced++;
        fs.writeFileSync(dstFull, newContent, 'utf8');
    }

    copied++;
}

// 统计
console.log('\n[3/3] 打包完成!');
console.log('  JS文件: ' + (copied - countWasm()) + ' 个');
console.log('  WASM文件: ' + countWasm() + ' 个 (' + Math.round(wasmTotalSize / 1024) + 'KB)');
console.log('  路径替换: ' + replaced + ' 个JS文件');

if (missing > 0) {
    console.error('  缺失: ' + missing + ' ← 需要先: cd wasm-crates && cargo build --target wasm32-unknown-unknown --release');
} else {
    console.log('  缺失: 0 (完整)');
}

var files = fs.readdirSync(DIST).filter(function(f) {
    return fs.statSync(path.join(DIST, f)).isFile();
});
var totalSize = 0;
files.forEach(function(f) { totalSize += fs.statSync(path.join(DIST, f)).size; });

console.log('\n验证:');
console.log('  总计: ' + files.length + ' 文件, ~' + Math.round(totalSize / 1024) + ' KB');
console.log('  目录层数: 1 (全部扁平)\n');

console.log('  文件清单:');
files.sort().forEach(function(f) {
    var sz = fs.statSync(path.join(DIST, f)).size;
    var tag = f.endsWith('.wasm') ? '[BIN]' : '     ';
    console.log('    ' + tag + ' ' + f + ' (' + Math.round(sz / 1024) + 'KB)');
});

console.log('\n使用方法:');
console.log('  1. 复制 dist/* 到游戏脚本文件夹（全部同一级目录）');
console.log('  2. .wasm 文件在游戏中上传为 Binary 模块类型');
console.log('  3. JS代码通过 require("modulename") 自动获取WASM字节\n');

if (missing > 0) {
    process.exit(1);
} else {
    console.log('  ✓ 全部就绪！');
}

function countWasm() {
    var c = 0;
    for (var i = 0; i < FILE_MAP.length; i++) {
        if (FILE_MAP[i][1].endsWith('.wasm')) c++;
    }
    return c;
}
