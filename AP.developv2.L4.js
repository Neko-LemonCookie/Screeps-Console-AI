/** AP.developv2.L4.js - RCL4 小房间策略 */
const DevelopV2_L4 = {
    CONFIG: { REFRESH_INTERVAL: 50, CREEP_CONFIG: { CommonI: { minCount: 3, maxCount: 4, bodySize: 'small' } } },
    run: function(room) { try { const s = this.analyze(room); if (!this._shouldRefresh(room)) return; this._publishCreepNeeds(room, s); } catch (e) { console.error("[DevelopV2-L4] ❌:", e); } },
    analyze: function(room) { const c = this._countCreeps(room); return { rcl: room.controller.level, energyAvailable: room.energyAvailable, creeps: c, commonICount: c.CommonI||0, controllerProgress: room.controller.progress/room.controller.progressTotal, storageBuilt: !!room.storage }; },
    _shouldRefresh: function(room) { const l = room.memory.lastStrategyRefresh||0; if (Game.time-l >= this.CONFIG.REFRESH_INTERVAL) { room.memory.lastStrategyRefresh=Game.time; return true; } return false; },
    _publishCreepNeeds: function(room, state) { const tb=require('lib.AP.taskboard'),cfg=this.CONFIG.CREEP_CONFIG.CommonI; if(state.commonICount<cfg.minCount) tb.strategy.needCreeps(room.name,{model:'CommonI',count:cfg.minCount-state.commonICount,priority:'harvest',data:{bodySize:cfg.bodySize}}); },
    _countCreeps: function(room) { const o={CommonI:0,CarrierI:0,AttackerI:0,ClaimerI:0}; for(const c of room.find(FIND_MY_CREEPS)) if(c.memory.model&&o[c.memory.model]!==undefined) o[c.memory.model]++; return o; }
};
module.exports = DevelopV2_L4;
