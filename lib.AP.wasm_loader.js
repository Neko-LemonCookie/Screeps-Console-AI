/**
 * lib.AP.wasm_loader.js
 *
 * 统一WASM模块加载器（Screeps专用）
 *
 * 设计原则：
 * - Screeps不支持 import.meta.url / fetch()，使用 initSync + 内联字节同步加载
 * - 所有WASM模块在此集中初始化，各adapter通过本文件获取实例
 * - 加载失败时自动降级为null，adapter侧有JS回退实现
 *
 * 依赖：
 *   wasm/calculate_claim.js  → Uint8Array (calculate_claim.wasm 原始字节)
 *   wasm/spawncreep.js       → Uint8Array (spawncreep.wasm 原始字节)
 *   wasm/tempbuild.js        → Uint8Array (tempbuild.wasm 原始字节)
 *   wasm-crates/*/pkg/*.js   → wasm-pack 生成的胶水代码（导出 initSync）
 */

const APWasmLoader = {
    // 已初始化的WASM模块实例（供adapter引用）
    calculate_claim: null,
    spawncreep: null,
    tempbuild: null,

    // 初始化状态标志
    _initialized: false,

    /**
     * 同步初始化所有WASM模块（在 memcleaner 或 main.js 入口处调用一次即可）
     * 每个模块独立 try-catch，单个失败不影响其他
     */
    initAll: function() {
        if (this._initialized) return;
        this._initialized = true;

        this.calculate_claim = this._initModule('calculate_claim', function(bytes) {
            var glue = require('wasm-crates/calculate_claim/pkg/screeps_wasm_calculate_claim.js');
            glue.initSync(bytes);
            return glue;
        });

        this.spawncreep = this._initModule('spawncreep', function(bytes) {
            var glue = require('wasm-crates/spawncreep/pkg/screeps_wasm_spawncreep.js');
            glue.initSync(bytes);
            return glue;
        });

        this.tempbuild = this._initModule('tempbuild', function(bytes) {
            var glue = require('wasm-crates/tempbuild/pkg/screeps_wasm_tempbuild.js');
            glue.initSync(bytes);
            return glue;
        });

        var okCount = [this.calculate_claim, this.spawncreep, this.tempbuild].filter(Boolean).length;
        console.log("[WasmLoader] 初始化完成: " + okCount + "/3 模块就绪");
    },

    /**
     * 单模块初始化（带容错）
     * @param {string} name 模块名（用于日志）
     * @param {function} loaderFn 接受bytes返回glue对象的函数
     * @returns {object|null} 初始化后的glue对象，失败返回null
     * @private
     */
    _initModule: function(name, loaderFn) {
        try {
            var bytes = require('wasm/' + name + '.js');
            if (!bytes || !(bytes instanceof Uint8Array)) {
                console.warn("[WasmLoader] " + name + ": 字节文件无效");
                return null;
            }
            var module = loaderFn(bytes);
            console.log("[WasmLoader] " + name + ": OK");
            return module;
        } catch (e) {
            console.warn("[WasmLoader] " + name + " 加载失败: " + (e.message || e));
            return null;
        }
    },

    /**
     * 检查指定模块是否可用
     * @param {string} name 'calculate_claim' | 'spawncreep' | 'tempbuild'
     * @returns {boolean}
     */
    isReady: function(name) {
        return this[name] !== null;
    }
};

module.exports = APWasmLoader;
