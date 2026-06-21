/** AP.developv2.L5.js - RCL5 小房间策略 */
const DevelopV2_L5 = {
    CONFIG: { REFRESH_INTERVAL: 100, CREEP_CONFIG: { CommonI:{minCount:2,maxCount:3,bodySize:'medium'}, CarrierI:{minCount:1,maxCount:2,bodySize:'small'} } },
    run: function(room) { try { if(Game.time%2!==0)return; const s=this.analyze(room); this._publishCreepNeeds(room,s); } catch(e){console.log("[DevelopV2-L5] ERROR:",e);} },
    analyze:function(room){const c=this._count(room);return{rcl:room.controller.level,creeps:c,storageEnergy:room.storage?(room.storage.store[RESOURCE_ENERGY]||0):0,controllerProgress:room.controller.progress/room.controller.progressTotal};},
    _publishCreepNeeds:function(room,state){const tb=require('lib.AP.taskboard'),cc=this.CONFIG.CREEP_CONFIG;const curC=(state.creeps.CommonI||0);if(curC<cc.CommonI.minCount)tb.strategy.needCreeps(room.name,{model:'CommonI',count:cc.CommonI.minCount-curC,priority:'harvest',data:{bodySize:cc.CommonI.bodySize}});if(state.storageEnergy>10000){const curCr=(state.creeps.CarrierI||0);if(curCr<cc.CarrierI.minCount)tb.strategy.needCreeps(room.name,{model:'CarrierI',count:cc.CarrierI.minCount-curCr,priority:'carry',data:{bodySize:cc.CarrierI.bodySize}});}},
    _count:function(room){const o={CommonI:0,CarrierI:0,AttackerI:0,ClaimerI:0};for(const c of room.find(FIND_MY_CREEPS))if(c.memory.model&&o[c.memory.model]!==undefined)o[c.memory.model]++;return o;}
};
module.exports=DevelopV2_L5;
