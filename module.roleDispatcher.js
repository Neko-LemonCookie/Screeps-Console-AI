// module.roleDispatcher.js - 角色调度器

var modules = require('module.references');

// 角色到模块的映射
var roleMap = {
    'harvester': modules.roleHarvester,
    'preharvester': modules.rolePreHarvester,
    'upgrader': modules.roleUpgrader,
    'builder': modules.roleBuilder,
    'protector': modules.roleProtector,
    'attacker': modules.roleAttacker,
    'claimer': modules.roleClaimer,
    'claimUpgrader': modules.roleClaimUpgrader,
    'claimBuilder': modules.roleClaimBuilder,
    'maomao': modules.roleMaomao,
    'policemaomao': modules.rolePoliceMaomao,
    'player': modules.rolePlayer,
    'repairman': modules.roleRepairman,
    'mineralHarvester': modules.roleMineralHarvester,
    'cutecat': modules.roleCuteCat,
    'carrier': modules.roleCarrier
};

module.exports = {
    /** @param {Room} room - 房间对象 */
    run: function() {
        for (var name in Game.creeps) {
            var creep = Game.creeps[name];
            
            // 检查是否有角色内存
            if (!creep.memory.role) {
                // 没有角色，根据身体部件分配角色
                var hasWorkPart = false;
                for (var i = 0; i < creep.body.length; i++) {
                    if (creep.body[i].type === WORK) {
                        hasWorkPart = true;
                        break;
                    }
                }
                
                if (hasWorkPart) {
                    creep.memory.role = 'harvester';
                } else {
                    creep.memory.role = 'protector';
                }
            }
            
            var roleModule = roleMap[creep.memory.role];
            
            if (roleModule) {
                roleModule.run(creep);
            } else if (creep.memory.role) {
            }
        }
    }
};