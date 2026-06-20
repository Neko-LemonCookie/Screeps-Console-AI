/**
 * lib.AP.wasm_loader.js
 *
 * WASM Side Module 加载器（Screeps专用）
 *
 * Screeps 原生支持 Binary 模块：
 *   require('module_name') 返回 ArrayBuffer（.wasm 原始字节）
 *   直接用 WebAssembly.Module/Instance 加载，零胶水代码，零导入依赖
 *
 * 数据流：
 *   JS业务代码 → adapter(薄包装) → 本加载器 → WebAssembly Instance.exports
 *
 * Body Part 编码常量（与Rust侧一致）:
 *   0=move, 1=work, 2=carry, 3=attack, 4=ranged_attack, 5=claim
 */

var APWasmLoader = {
    // 已编译的模块实例（全局缓存，每tick复用）
    _instances: {},
    _memViews: {},   // 各模块的内存 Uint8Array 视图

    /**
     * 同步初始化所有WASM模块（main.js 入口调用一次即可）
     * 单个失败不影响其他，不可用时对应instance为null（adapter有JS回退）
     */
    initAll: function() {
        this._instances.calculate_claim = this._loadModule('calculate_claim');
        this._instances.spawncreep = this._loadModule('spawncreep');
        this._instances.tempbuild = this._loadModule('tempbuild');

        var ok = 0;
        for (var name in this._instances) {
            if (this._instances[name]) ok++;
        }
        console.log('[WasmLoader] Side Module 初始化: ' + ok + '/3 就绪');
    },

    /**
     * 加载单个WASM Side Module
     * @param {string} name 模块名（与文件名一致，如 'calculate_claim'）
     * @returns {object|null} WebAssembly Instance 的 exports 对象，失败返回null
     * @private
     */
    _loadModule: function(name) {
        try {
            // Screeps: require(Binary模块名) 返回 ArrayBuffer
            var binBuffer = require(name);
            if (!binBuffer || !(binBuffer instanceof ArrayBuffer)) {
                console.warn('[WasmLoader] ' + name + ': require未返回ArrayBuffer');
                return null;
            }

            // 编译 + 实例化（Side Module 无导入依赖，传空对象）
            var mod = new WebAssembly.Module(binBuffer);
            var inst = new WebAssembly.Instance(mod, {});

            // 缓存内存视图供adapter读取共享缓冲区
            if (inst.exports.memory) {
                this._memViews[name] = new Uint8Array(inst.exports.memory.buffer);
            }

            console.log('[WasmLoader] ' + name + ': OK (' + binBuffer.byteLength + ' bytes)');
            return inst.exports;
        } catch (e) {
            console.warn('[WasmLoader] ' + name + ' 加载失败: ' + (e.message || e));
            return null;
        }
    },

    /**
     * 获取指定模块的导出函数
     * @param {string} name 模块名
     * @returns {object|null} exports对象
     */
    getExports: function(name) {
        return this._instances[name] || null;
    },

    /**
     * 获取指定模块的内存视图（用于读取共享缓冲区）
     * @param {string} name 模块名
     * @returns {Uint8Array|null}
     */
    getMemory: function(name) {
        return this._memViews[name] || null;
    },

    /**
     * 检查指定模块是否可用
     */
    isReady: function(name) {
        return this._instances[name] !== null && this._instances[name] !== undefined;
    }
};

// === Body Part 编码/解码常量（与Rust侧完全一致）===
APWasmLoader.PART = {
    MOVE: 0, WORK: 1, CARRY: 2,
    ATTACK: 3, RANGED_ATTACK: 4, CLAIM: 5,
    /** 将编码字节还原为Screeps部件名称 */
    decode: function(code) {
        var names = ['move', 'work', 'carry', 'attack', 'ranged_attack', 'claim'];
        return names[code] || 'move';
    },
    /** 将Screeps部件名称编码为字节 */
    encode: function(name) {
        var map = { move:0, work:1, carry:2, attack:3, ranged_attack:4, claim:5 };
        return map[name] !== undefined ? map[name] : 0;
    }
};

module.exports = APWasmLoader;
