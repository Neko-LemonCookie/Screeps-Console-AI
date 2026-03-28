// ext.createcreep.js - 最小可行版：只生成保护者、收获者、升级者，每种最多一个
module.exports = {
    // 主入口：由每个空闲Spawn调用
    run: function(mainSpawn) {
        var room = mainSpawn.room;
        var roomName = room.name;

        // 如果正在生成中，直接返回
        if (mainSpawn.spawning) return;

        // 统计当前房间内三种角色的数量（包括正在生成的）
        var harvesters = this._countRoleInRoom(roomName, 'harvester');
        var upgraders = this._countRoleInRoom(roomName, 'upgrader');
        var protectors = this._countRoleInRoom(roomName, 'protector');

        var energy = room.energyAvailable;

        // 按优先级检查并生成
        var creepName = '', role = '', body = [];

        // 1. 收获者（最多1个）
        if (harvesters < 1) {
            role = 'harvester';
            body = this.getHarvesterBody(energy);
            creepName = 'H_' + Game.time;
        }
        // 2. 升级者（最多1个）
        else if (upgraders < 1) {
            role = 'upgrader';
            body = this.getUpgraderBody(energy);
            creepName = 'U_' + Game.time;
        }
        // 3. 保护者（最多1个）
        else if (protectors < 1) {
            role = 'protector';
            body = this.getProtectorBody(energy);
            creepName = 'P_' + Game.time;
        }

        // 执行生成
        if (role && body.length > 0) {
            var cost = 0;
            for (var i = 0; i < body.length; i++) {
                cost += BODYPART_COST[body[i]];
            }
            if (energy >= cost) {
                var result = mainSpawn.spawnCreep(body, creepName, {
                    memory: { role: role }
                });
                if (result == OK) {
                    var emoji = { 'harvester': '⛏️', 'upgrader': '⬆️', 'protector': '🛡️' }[role];
                    console.log('[' + roomName + '] ' + emoji + ' 生成' + role + ': ' + creepName + ' (' + cost + '能量)');
                }
            }
        }
    },

    // 统计指定角色在指定房间的数量（包括正在生成的）
    _countRoleInRoom: function(roomName, role) {
        var count = 0;
        // 统计存活的creep
        for (var name in Game.creeps) {
            var creep = Game.creeps[name];
            if (creep.memory.role === role && creep.room.name === roomName) {
                count++;
            }
        }
        // 统计正在生成的creep（所有spawn中）
        for (var spawnName in Game.spawns) {
            var spawn = Game.spawns[spawnName];
            if (spawn.spawning && spawn.room.name === roomName) {
                var spawningCreep = Memory.creeps[spawn.spawning.name];
                if (spawningCreep && spawningCreep.role === role) {
                    count++;
                }
            }
        }
        return count;
    },

    // ================== 身体部件配置 ==================
    getHarvesterBody: function(energy) {
        if (energy >= 850) return [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
        if (energy >= 700) return [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        if (energy >= 600) return [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (energy >= 550) return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (energy >= 450) return [WORK, WORK, WORK, CARRY, MOVE, MOVE];
        if (energy >= 400) return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
        if (energy >= 300) return [WORK, WORK, CARRY, MOVE];
        return [];
    },

    getUpgraderBody: function(energy) {
        if (energy >= 850) return [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (energy >= 700) return [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (energy >= 600) return [WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (energy >= 550) return [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE];
        if (energy >= 450) return [WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE];
        if (energy >= 400) return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
        return [];
    },

    getProtectorBody: function(energy) {
        if (energy >= 280) return [CARRY, CARRY, MOVE, MOVE, ATTACK];
        return [];
    }
};