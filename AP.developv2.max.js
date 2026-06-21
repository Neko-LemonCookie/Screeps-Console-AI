/** AP.developv2.max.js - RCL8 Max 小房间策略 */
const DevelopV2_Max = {
    CONFIG: { REFRESH_INTERVAL: 200, CREEP_CONFIG: { CommonI:{minCount:1,maxCount:2,bodySize:'large',enableBoost:true}, CarrierI:{minCount:2,maxCount:3,bodySize:'large',enableBoost:true}, AttackerI:{minCount:1,maxCount:2,bodySize:'medium'} } },
    run: function(room) { try { if(Game.time%2!==0)return; const s=this.analyze(room); this._publishCreepNeeds(room,s); } catch(e){console.log("[DevelopV2-Max] ERROR:",e);} },
    analyze:function(room){return{rcl:room.controller.level,creeps:this._count(room),storageEnergy:room.storage?(room.storage.store[RESOURCE_ENERGY]||0):0};},
    _publishCreepNeeds:function(room,state){const tb=require('lib.AP.taskboard');for(const m in this.CONFIG.CREEP_CONFIG){const c=this.CONFIG.CREEP_CONFIG[m];const cur=(state.creeps[m]||0);if(cur>=c.maxCount)continue;if(cur<c.minCount)tb.strategy.needCreeps(room.name,{model:m,count:c.minCount-cur,priority:m==='AttackerI'?'attack':m==='CarrierI'?'carry':'harvest',data:{bodySize:c.bodySize,enableBoost:c.enableBoost}});}},
    _count:function(room){const o={CommonI:0,CarrierI:0,AttackerI:0,ClaimerI:0};for(const c of room.find(FIND_MY_CREEPS))if(c.memory.model&&o[c.memory.model]!==undefined)o[c.memory.model]++;return o;}
};
module.exports=DevelopV2_Max;
