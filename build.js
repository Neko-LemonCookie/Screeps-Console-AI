/**
 * build.js
 *
 * 一键打包脚本：扁平化所有文件到 dist/ 根目录（Screeps魔改CommonJS要求）
 *
 * Screeps的require()只支持扁平命名空间，不支持子目录路径：
 *   require('lib.AP.taskboard')     ✅ 扁平名称OK
 *   require('wasm/calc.js')         ❌ 带路径会报错
 *
 * 本脚本自动完成：
 *   1. 复制所有运行时文件到 dist/
 *   2. 扁平化：子目录文件重命名到根目录（加前缀防冲突）
 *   3. 替换所有 require() 路径为扁平名称
 *   4. 排除不需要的二进制文件（.wasm由initSync字节加载）
 *
 * 用法：node build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// ============================================================
// 文件清单：源路径 → 扁平目标名（Screeps根目录下的文件名）
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

    // === WASM字节包装器（wasm/ → wasm_bytes. 前缀）===
    ['wasm/calculate_claim.js',                   'wasm_bytes.calculate_claim.js'],
    ['wasm/spawncreep.js',                        'wasm_bytes.spawncreep.js'],
    ['wasm/tempbuild.js',                         'wasm_bytes.tempbuild.js'],

    // === WASM胶水代码（pkg/ → glue. 前缀，仅JS，不含.wasm二进制）===
    ['wasm-crates/calculate_claim/pkg/screeps_wasm_calculate_claim.js',
                                                'glue.calculate_claim.js'],
    ['wasm-crates/spawncreep/pkg/screeps_wasm_spawncreep.js',
                                                'glue.spawncreep.js'],
    ['wasm-crates/tempbuild/pkg/screeps_wasm_tempbuild.js',
                                                'glue.tempbuild.js'],
];

// ============================================================
// require() 路径替换规则（在复制后的文件中执行）
// key = 源码中的原始require路径, value = 扁平化后的模块名
// ============================================================
const REQUIRE_REPLACEMENTS = {
    // WASM胶水代码路径 → 扁平名称
    "wasm-crates/calculate_claim/pkg/screeps_wasm_calculate_claim.js": 'glue.calculate_claim',
    "wasm-crates/spawncreep/pkg/screeps_wasm_spawncreep.js":          'glue.spawncreep',
    "wasm-crates/tempbuild/pkg/screeps_wasm_tempbuild.js":            'glue.tempbuild',

    // WASM字节包装器动态路径 → 扁平前缀
    // 这个需要特殊处理：'wasm/' + name + '.js' → 'wasm_bytes.' + name
};

// ============================================================
// 工具函数
// ============================================================

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function checkFile(filePath) {
    const full = path.join(ROOT, filePath);
    return fs.existsSync(full);
}

/**
 * 对单个文件内容执行require路径替换
 */
function replaceRequires(content, sourcePath) {
    var result = content;

    // 固定路径替换
    for (var oldPath in REQUIRE_REPLACEMENTS) {
        var newPath = REQUIRE_REPLACEMENTS[oldPath];
        // 替换 require('old_path') 形式
        result = result.replace(
            new RegExp("require\\('" + escapeRegex(oldPath) + "'\\)", 'g'),
            "require('" + newPath + "')"
        );
        // 也处理 require("old_path") 双引号形式
        result = result.replace(
            new RegExp('require("' + escapeRegex(oldPath) + '")', 'g'),
            'require("' + newPath + '")'
        );
    }

    // 动态路径替换：require('wasm/' + name + '.js')
    // 只在 lib.AP.wasm_loader.js 中出现
    result = result.replace(
        /require\('wasm\/' \+ name \+ '\.js'\)/g,
        "require('wasm_bytes.' + name)"
    );

    // js-adapters 路径替换（如果未来有其他地方引用）
    result = result.replace(
        /require\('js-adapters\/([^']+)'\)/g,
        "require('adapter.$1')"
    );

    return result;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// 主流程
// ============================================================

console.log('========================================');
console.log('  Screeps AI Build Script (Flat Mode)');
console.log('  Output: dist/ (all files at root level)');
console.log('========================================');
console.log('');

// 清理旧的输出
if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
}
ensureDir(DIST);
console.log('[1/4] 清理旧输出... OK');

// 复制并扁平化
var missing = 0;
var copied = 0;
var replaced = 0;

console.log('\n[2/4] 复制并扁平化文件...');
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

    // 读取内容
    var content = fs.readFileSync(srcFull, 'utf8');

    // 执行require路径替换
    var newContent = replaceRequires(content, srcPath);
    if (newContent !== content) {
        replaced++;
    }

    // 写入扁平化后的文件
    fs.writeFileSync(dstFull, newContent, 'utf8');
    copied++;
}

// 统计
console.log('\n[3/4] 打包完成!');
console.log('  复制: ' + copied + ' 文件');
console.log('  路径替换: ' + replaced + ' 文件');
if (missing > 0) {
    console.error('  缺失: ' + missing + ' 文件 ← 需要先构建WASM');
} else {
    console.log('  缺失: 0 (完整)');
}

// 输出大小统计 & 文件列表验证
var files = fs.readdirSync(DIST).filter(function(f) {
    return fs.statSync(path.join(DIST, f)).isFile();
});
var totalSize = 0;
files.forEach(function(f) {
    totalSize += fs.statSync(path.join(DIST, f)).size;
});

console.log('\n[4/4] 验证:');
console.log('  总计: ' + files.length + ' 文件, ~' + Math.round(totalSize / 1024) + ' KB');
console.log('  目录层数: 1 (全部扁平)');
console.log('');

// 列出所有文件
console.log('  文件清单:');
files.sort().forEach(function(f) {
    var sz = fs.statSync(path.join(DIST, f)).size;
    console.log('    ' + f + ' (' + Math.round(sz / 1024) + 'KB)');
});

console.log('');
console.log('使用方法:');
console.log('  1. 复制 dist/ 内全部文件到游戏脚本文件夹（不是子文件夹！）');
console.log('  2. 所有文件必须在同一级目录，Screeps不支持子目录');
console.log('');

if (missing > 0) {
    console.warn('  ⚠ 有缺失文件！请先在 wasm-crates/ 下运行 wasm-pack build --target nodejs');
    process.exit(1);
} else {
    console.log('  ✓ 全部就绪，可以直接部署！');
}
