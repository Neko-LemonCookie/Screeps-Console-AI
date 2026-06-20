/**
 * wasm-crates/tests/benchmark.js
 *
 * WASM vs JS 性能对比测试工具
 *
 * 使用方法（在 Screeps 控制台或 main.js 中调用）：
 *   require('./tests/benchmark').run();
 *
 * 输出：各函数的执行时间对比和加速比
 */

const spawncreepWasm = require('../../js-adapters/wasm_spawncreep');
const spawncreepJs = require('../../lib.AP.spawncreep');

module.exports = {
    /**
     * 运行完整性能基准测试套件
     * @returns {Promise<Object>} 测试结果汇总
     */
    run: async function() {
        console.log("=== 🚀 WASM Performance Benchmark ===");
        console.log("开始时间: Tick " + Game.time);

        // Step 1: 等待 WASM 加载
        console.log("\n[1/4] 初始化 WASM 模块...");
        await spawncreepWasm.init();

        const results = {};

        // Test 1: calcBodyCost 高频调用测试
        results.calcBodyCost = this.benchmarkCalcBodyCost(10000);

        // Test 2: getCommonIBody 各能量档次测试
        results.getCommonIBody = this.benchmarkGetCommonIBody(1000);

        // Test 3: 全型号综合测试
        results.allModels = this.benchmarkAllModels(500);

        // 输出汇总
        console.log("\n=== 📊 Performance Summary ===");
        for (const [testName, result] of Object.entries(results)) {
            console.log(`\n${testName}:`);
            console.log(`  Total JS time:  ${result.totalJs.toFixed(4)} ms`);
            console.log(`  Total WASM time: ${result.totalWasm.toFixed(4)} ms`);
            console.log(`  Average speedup: ${(result.avgSpeedup).toFixed(2)}x`);
        }

        console.log("\n=== ✅ Benchmark Complete ===");
        return results;
    },

    /**
     * calcBodyCost 性能测试
     * @param {number} iterations 迭代次数
     * @returns {Object} 测试结果
     */
    benchmarkCalcBodyCost: function(iterations) {
        const testBody = ['move', 'work', 'carry', 'move', 'work', 'work', 'carry', 'move'];

        console.log(`\n[2/4] Testing calcBodyCost (${iterations} iterations)...`);

        // Warm up
        for (let i = 0; i < 100; i++) {
            spawncreepWasm.calcBodyCost(testBody);
            spawncreepJs.calcBodyCost(testBody);
        }

        // JS timing
        const jsStart = Game.cpu.getUsed();
        for (let i = 0; i < iterations; i++) {
            spawncreepJs.calcBodyCost(testBody);
        }
        const jsTime = Game.cpu.getUsed() - jsStart;

        // WASM timing
        const wasmStart = Game.cpu.getUsed();
        for (let i = 0; i < iterations; i++) {
            spawncreepWasm.calcBodyCost(testBody);
        }
        const wasmTime = Game.cpu.getUsed() - wasmStart;

        const speedup = jsTime / wasmTime;

        console.log(`  calcBodyCost:`);
        console.log(`    JS:  ${jsTime.toFixed(4)} ms`);
        console.log(`    WASM: ${wasmTime.toFixed(4)} ms`);
        console.log(`    Speedup: ${speedup.toFixed(2)}x`);

        return {
            totalJs: jsTime,
            totalWasm: wasmTime,
            avgSpeedup: speedup
        };
    },

    /**
     * getCommonIBody 各档次性能测试
     * @param {number} iterations 每个档次的迭代次数
     * @returns {Object} 测试结果
     */
    benchmarkGetCommonIBody: function(iterations) {
        const energies = [200, 400, 550, 600, 700, 850, 900];

        console.log(`\n[3/4] Testing getCommonIBody (${iterations} iterations per tier)...`);

        let totalJs = 0;
        let totalWasm = 0;
        let speedups = [];

        for (const energy of energies) {
            const jsStart = Game.cpu.getUsed();
            for (let i = 0; i < iterations; i++) {
                spawncreepJs.getCommonIBody(energy);
            }
            const jsTime = Game.cpu.getUsed() - jsStart;

            const wasmStart = Game.cpu.getUsed();
            for (let i = 0; i < iterations; i++) {
                spawncreepWasm.getCommonIBody(energy);
            }
            const wasmTime = Game.cpu.getUsed() - wasmStart;

            const speedup = jsTime / wasmTime;
            speedups.push(speedup);

            totalJs += jsTime;
            totalWasm += wasmTime;

            console.log(`  ${energy} energy: JS=${jsTime.toFixed(3)}ms WASM=${wasmTime.toFixed(3)}ms ${speedup.toFixed(2)}x`);
        }

        const avgSpeedup = speedups.reduce((a, b) => a + b, 0) / speedups.length;

        return {
            totalJs: totalJs,
            totalWasm: totalWasm,
            avgSpeedup: avgSpeedup
        };
    },

    /**
     * 所有型号模板综合测试
     * @param {number} iterations 迭代次数
     * @returns {Object} 测试结果
     */
    benchmarkAllModels: function(iterations) {
        const models = [
            { name: 'CommonI', fnJs: () => spawncreepJs.getCommonIBody(850), fnWasm: () => spawncreepWasm.getCommonIBody(850) },
            { name: 'CarrierI', fnJs: () => spawncreepJs.getCarrierIBody(800), fnWasm: () => spawncreepWasm.getCarrierIBody(800) },
            { name: 'AttackerI', fnJs: () => spawncreepJs.getAttackerI(1180), fnWasm: () => spawncreepWasm.getAttackerI(1180) },
            { name: 'ClaimerI', fnJs: () => spawncreepJs.getClaimerIBody(1300), fnWasm: () => spawncreepWasm.getClaimerIBody(1300) },
        ];

        console.log(`\n[4/4] Testing all models (${iterations} iterations each)...`);

        let totalJs = 0;
        let totalWasm = 0;
        let speedups = [];

        for (const model of models) {
            const jsStart = Game.cpu.getUsed();
            for (let i = 0; i < iterations; i++) {
                model.fnJs();
            }
            const jsTime = Game.cpu.getUsed() - jsStart;

            const wasmStart = Game.cpu.getUsed();
            for (let i = 0; i < iterations; i++) {
                model.fnWasm();
            }
            const wasmTime = Game.cpu.getUsed() - wasmStart;

            const speedup = jsTime / Math.max(wasmTime, 0.0001); // 避免除零
            speedups.push(speedup);

            totalJs += jsTime;
            totalWasm += wasmTime;

            console.log(`  ${model.name}: JS=${jsTime.toFixed(4)}ms WASM=${wasmTime.toFixed(4)}ms ${speedup.toFixed(2)}x`);
        }

        const avgSpeedup = speedups.reduce((a, b) => a + b, 0) / speedups.length;

        return {
            totalJs: totalJs,
            totalWasm: totalWasm,
            avgSpeedup: avgSpeedup
        };
    }
};
