// main.js - 主循环（多Spawn支持版，带最小房间旗帜检测）
var modules = require('module.references');
var roleDispatcher = require('module.roleDispatcher');
var Crazy = require('ext.crazy');

// 全局电源开关：power(true) 正常模式，power(false) 仅生成+调度
global.power = function(enable) {
    global.powerMode = enable;
    console.log('⚡ 电源模式设置为: ' + (enable ? 'ON (全功能)' : 'OFF (仅生成+调度)'));
};

module.exports.loop = function () {
    // ---------- 电源管理模式 ----------
    // 如果电源关闭（global.powerMode === false），只执行生成和调度，跳过所有其他操作
    if (global.powerMode === false) {
        // 获取所有spawn（必须）
        var spawns = Object.values(Game.spawns);
        if (spawns.length > 0) {
            // 运行生成逻辑（只在spawn空闲时）
            for (var i = 0; i < spawns.length; i++) {
                var spawn = spawns[i];
                if (!spawn.spawning) {
                    // 直接调用普通生成模块，不区分最小房间
                    modules.mincreateCreep.run(spawn);
                }
            }
        }

        // 调度所有creep
        roleDispatcher.run();

        // 立即返回，不执行任何其他代码（包括内存清理、旗帜收集、统计、房间模块等）
        return;
    }

    // ---------- 正常模式（电源开启） ----------
    // 1. 清理内存
    for (var name in Memory.creeps) {
        if (!Game.creeps[name]) delete Memory.creeps[name];
    }

    // 2. 获取所有spawn
    var spawns = Object.values(Game.spawns);
    if (spawns.length === 0) return;

    // 3. 收集最小可行房间（通过 Unable+房间名 旗帜标记）
    var minimalRooms = new Set();
    for (var flagName in Game.flags) {
        var flag = Game.flags[flagName];
        if (flag.room && flagName.startsWith("Unable")) {
            minimalRooms.add(flag.room.name);
        }
    }

    // 4. 统计信息 - 只保留详细统计（每500 tick）
    var allCreeps = Object.keys(Game.creeps).length;
    var allRoles = [
        'harvester', 'upgrader', 'builder', 'protector',
        'attacker', 'claimer', 'claimUpgrader', 'claimHarvester',
        'maomao', 'repairman', 'link'
    ];

    if (Game.time % 500 == 0) {
        var roleCounts = {};
        allRoles.forEach(function(role) {
            roleCounts[role] = _.filter(Game.creeps, function(c) {
                return c.memory.role == role;
            }).length;
        });

        var otherCreeps = _.filter(Game.creeps, function(c) {
            return !allRoles.includes(c.memory.role);
        });

        var roleStrings = [];
        allRoles.forEach(function(role) {
            if (roleCounts[role] > 0) {
                var roleNames = {
                    'harvester': '采',
                    'upgrader': '升',
                    'builder': '建',
                    'protector': '防',
                    'attacker': '攻',
                    'claimer': '占',
                    'claimUpgrader': '远升',
                    'claimHarvester': '远采',
                    'maomao': '🐱',
                    'repairman': '修',
                    'link': '链'
                };
                var displayName = roleNames[role] || role;
                roleStrings.push(displayName + ':' + roleCounts[role]);
            }
        });

        console.log('[T' + Game.time + '] 总人口:' + allCreeps + ' 角色:' + roleStrings.join(' ') + (otherCreeps.length > 0 ? ' 其他:' + otherCreeps.length : ''));

        spawns.forEach(function(spawn, index) {
            var room = spawn.room;
            var sites = room.find(FIND_CONSTRUCTION_SITES);
            var harvestersInRoom = _.filter(Game.creeps, function(c) {
                return c.memory.role == 'harvester' && c.room.name == room.name;
            }).length;
            console.log('  房间' + (index+1) + ': ' + room.name + ' 能量:' + room.energyAvailable + '/' + room.energyCapacityAvailable + ' 采集者:' + harvestersInRoom + ' 工地:' + sites.length);
        });
    }

    // 5. 运行生成和管理模块（在所有spawn上运行）
    spawns.forEach(function(spawn) {
        if (!spawn.spawning) {
            var roomName = spawn.room.name;
            if (minimalRooms.has(roomName)) {
                modules.mincreateCreep.run(spawn);
            } else {
                modules.createCreep.run(spawn);
                //modules.createClaim.run(spawn);
            }
        }
    });

    // 6. 运行其他管理模块（每个房间运行一次，避免重复）
    var uniqueRooms = [];
    spawns.forEach(function(spawn) {
        var roomName = spawn.room.name;
        if (!uniqueRooms.includes(roomName)) {
            uniqueRooms.push(roomName);
            var room = spawn.room;

            modules.roleTower.run(room);

            if (!minimalRooms.has(roomName)) {
                modules.roleLab.run(room);
                //modules.roleFactory.run(room);
                modules.autoBuild.run(room);
                modules.roleLink.run(room);
                modules.Market.run(room);
                modules.AutoMarket.run(room);
                modules.lockSourceID.run(room);
            }
        }
    });

    // 7. 调度所有creep
    roleDispatcher.run();
};