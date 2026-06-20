/**
 * module.references.js
 * 惰性加载版：所有模块在第一次访问时才加载，彻底避免循环引用
 */

// 缓存已加载的模块
const cache = {};

// 定义 getter，实现惰性加载
const refs = {};

// 核心库
Object.defineProperty(refs, 'taskboard', { get: () => cache.taskboard || (cache.taskboard = require('lib.AP.taskboard')) });
Object.defineProperty(refs, 'spawncreep', { get: () => cache.spawncreep || (cache.spawncreep = require('lib.AP.spawncreep')) });
Object.defineProperty(refs, 'market', { get: () => cache.market || (cache.market = require('lib.AP.market')) });
Object.defineProperty(refs, 'tempbuild', { get: () => cache.tempbuild || (cache.tempbuild = require('lib.AP.tempbuild')) });
Object.defineProperty(refs, 'automarket', { get: () => cache.automarket || (cache.automarket = require('lib.AP.automarket')) });
Object.defineProperty(refs, 'calculate_claim', { get: () => cache.calculate_claim || (cache.calculate_claim = require('lib.AP.calculate_claim')) });
Object.defineProperty(refs, 'search', { get: () => cache.search || (cache.search = require('lib.AP.search')) });
Object.defineProperty(refs, 'wasmLoader', { get: () => cache.wasmLoader || (cache.wasmLoader = require('lib.AP.wasm_loader')) });

// AP 核心逻辑
Object.defineProperty(refs, 'developv1', { get: () => cache.developv1 || (cache.developv1 = require('AP.developv1')) });
Object.defineProperty(refs, 'developv2', { get: () => cache.developv2 || (cache.developv2 = require('AP.developv2')) });
Object.defineProperty(refs, 'developv1L3', { get: () => cache.developv1L3 || (cache.developv1L3 = require('AP.developv1.L3')) });
Object.defineProperty(refs, 'developv1L5', { get: () => cache.developv1L5 || (cache.developv1L5 = require('AP.developv1.L5')) });
Object.defineProperty(refs, 'developv1L7', { get: () => cache.developv1L7 || (cache.developv1L7 = require('AP.developv1.L7')) });
Object.defineProperty(refs, 'developv1max', { get: () => cache.developv1max || (cache.developv1max = require('AP.developv1.max')) });
Object.defineProperty(refs, 'developv2L4', { get: () => cache.developv2L4 || (cache.developv2L4 = require('AP.developv2.L4')) });
Object.defineProperty(refs, 'developv2L5', { get: () => cache.developv2L5 || (cache.developv2L5 = require('AP.developv2.L5')) });
Object.defineProperty(refs, 'developv2max', { get: () => cache.developv2max || (cache.developv2max = require('AP.developv2.max')) });
Object.defineProperty(refs, 'claim', { get: () => cache.claim || (cache.claim = require('AP.claim')) });
Object.defineProperty(refs, 'fight', { get: () => cache.fight || (cache.fight = require('AP.fight')) });
Object.defineProperty(refs, 'taskhandler', { get: () => cache.taskhandler || (cache.taskhandler = require('AP.taskhandler')) });
Object.defineProperty(refs, 'autobuild', { get: () => cache.autobuild || (cache.autobuild = require('AP.autobuild')) });
Object.defineProperty(refs, 'memcleaner', { get: () => cache.memcleaner || (cache.memcleaner = require('AP.memcleaner')) });
Object.defineProperty(refs, 'roleDispatcher', { get: () => cache.roleDispatcher || (cache.roleDispatcher = require('module.roleDispatcher')) });

// 任务执行逻辑 (task.creep)
Object.defineProperty(refs, 'taskHarvest', { get: () => cache.taskHarvest || (cache.taskHarvest = require('task.creep.harvest')) });
Object.defineProperty(refs, 'taskUpgrade', { get: () => cache.taskUpgrade || (cache.taskUpgrade = require('task.creep.upgrade')) });
Object.defineProperty(refs, 'taskBuild', { get: () => cache.taskBuild || (cache.taskBuild = require('task.creep.build')) });
Object.defineProperty(refs, 'taskRepair', { get: () => cache.taskRepair || (cache.taskRepair = require('task.creep.repair')) });
Object.defineProperty(refs, 'taskCarry', { get: () => cache.taskCarry || (cache.taskCarry = require('task.creep.carry')) });
Object.defineProperty(refs, 'taskClaimUpgrade', { get: () => cache.taskClaimUpgrade || (cache.taskClaimUpgrade = require('task.creep.claimupgrade')) });
Object.defineProperty(refs, 'taskClaimBuild', { get: () => cache.taskClaimBuild || (cache.taskClaimBuild = require('task.creep.claimbuild')) });
Object.defineProperty(refs, 'taskGlobalCarry', { get: () => cache.taskGlobalCarry || (cache.taskGlobalCarry = require('task.creep.globalcarry')) });
Object.defineProperty(refs, 'taskAttack', { get: () => cache.taskAttack || (cache.taskAttack = require('task.creep.attack')) });
Object.defineProperty(refs, 'taskPolice', { get: () => cache.taskPolice || (cache.taskPolice = require('task.creep.police')) });
Object.defineProperty(refs, 'taskSign', { get: () => cache.taskSign || (cache.taskSign = require('task.creep.sign')) });
Object.defineProperty(refs, 'taskClaim', { get: () => cache.taskClaim || (cache.taskClaim = require('task.creep.claim')) });
Object.defineProperty(refs, 'taskReserve', { get: () => cache.taskReserve || (cache.taskReserve = require('task.creep.reserve')) });
Object.defineProperty(refs, 'taskBoost', { get: () => cache.taskBoost || (cache.taskBoost = require('task.creep.boost')) });

// 实体逻辑
Object.defineProperty(refs, 'unibot', { get: () => cache.unibot || (cache.unibot = require('creep.unibot')) });
Object.defineProperty(refs, 'buildingTower', { get: () => cache.buildingTower || (cache.buildingTower = require('building.tower')) });
Object.defineProperty(refs, 'buildingFactory', { get: () => cache.buildingFactory || (cache.buildingFactory = require('building.factory')) });
Object.defineProperty(refs, 'buildingNuker', { get: () => cache.buildingNuker || (cache.buildingNuker = require('building.nuker')) });
Object.defineProperty(refs, 'buildingTerminal', { get: () => cache.buildingTerminal || (cache.buildingTerminal = require('building.terminal')) });
Object.defineProperty(refs, 'buildingLab', { get: () => cache.buildingLab || (cache.buildingLab = require('building.lab')) });
Object.defineProperty(refs, 'buildingLink', { get: () => cache.buildingLink || (cache.buildingLink = require('building.link')) });
Object.defineProperty(refs, 'buildingSpawn', { get: () => cache.buildingSpawn || (cache.buildingSpawn = require('building.spawn')) });

module.exports = refs;
