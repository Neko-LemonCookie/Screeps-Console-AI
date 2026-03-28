// module.references.js - 集中管理所有模块引用

module.exports = {
    // 角色模块
    roleHarvester: require('role.harvester'),
    rolePreHarvester: require('role.preharvester'),
    roleUpgrader: require('role.upgrader'),
    roleBuilder: require('role.builder'),
    roleProtector: require('role.protector'),
    roleAttacker: require('role.attacker'),
    roleClaimer: require('role.claimer'),
    roleClaimUpgrader: require('role.claimupgrader'),
    roleClaimBuilder: require('role.claimBuilder'),    
    roleMaomao: require('role.maomao'),
    rolePoliceMaomao: require('role.policemaomao'),
    rolePlayer: require('role.player'),
    roleRepairman: require('role.repairman'),
    roleMineralHarvester: require('role.mineralHarvester'),
    roleLink: require('role.link'),
    roleCuteCat: require('role.cutecat'),
    roleCarrier: require('role.carrier'),
    
    // 扩展模块
    roleTower: require('role.tower'),
    roleLab: require('role.lab'),
    roleFactory: require('role.factory'),
    createCreep: require('ext.createcreep'),
    mincreateCreep: require('ext.mincreatecreep'),
    createClaim: require('ext.createclaim'),
    Market: require('ext.market'),
    AutoMarket: require('auto.market'),
    autoBuild: require('ext.autobuild'),
    lockSourceID: require('ext.locksourceid')
};