// ext.createcreep.js - 最终优化版（预生成独立函数，矿物耗尽检查，有效连接感知）
module.exports = {
    // 主入口：由每个空闲Spawn调用
    run: function(mainSpawn) {
        var room = mainSpawn.room;
        var roomName = room.name;
        
        // 如果正在生成中，直接返回
        if (mainSpawn.spawning) return;
        
        // --- 统计房间内所有角色的实时数量（存活 + 正在生成）---
        var counts = this._getRoleCounts(room);
        
        // 提取常用数量（房间角色）
        var harvesters = counts.harvester + counts.preharvester;  // 总采集者（含预采集）
        var pureHarvesters = counts.harvester;                    // 纯采集者
        var upgraders = counts.upgrader;
        var builders = counts.builder;
        var repairmen = counts.repairman;
        var protectors = counts.protector;
        var mineralHarvesters = counts.mineralHarvester;
        var carriers = counts.carrier;
        
        // 全局角色（全地图唯一）
        var maomaos = counts.maomao;
        var cutecats = counts.cutecat;
        var policemaomaos = counts.policemaomao;
        
        // 获取房间数据
        var sites = room.find(FIND_CONSTRUCTION_SITES);
        var roomController = room.controller;
        var roomRCL = roomController ? roomController.level : 0;
        var policeFlag = Game.flags['PoliceTangYuanStandby'];
        var energy = room.energyAvailable;
        
        // 1. 检查紧急模式（RCL4级以上）
        if (!Memory.emergencyMode || !Memory.emergencyMode.active) {
            if (roomRCL >= 4) {
                this._checkAndSetEmergencyMode(room, pureHarvesters);
            }
        }
        
        // 紧急模式：生成最低配置采集者
        if (Memory.emergencyMode && Memory.emergencyMode.active) {
            if (pureHarvesters < 4 && energy >= 200) {
                var body = [WORK, CARRY, MOVE];
                var creepName = 'H_EMG_' + Game.time;
                var result = mainSpawn.spawnCreep(body, creepName, {
                    memory: { role: 'harvester' }
                });
                if (result == OK) {
                    console.log('[' + roomName + '] 🚨 紧急模式生成采集者: ' + creepName + ' (200能量)');
                }
            }
            return; // 紧急模式下不处理其他生成
        }
        
        // --- 正常生成逻辑（按优先级顺序）---
        var creepName = '', creepRole = '', actualMemoryRole = '';
        var body = [];
        
        // 策略1：基础采集者
        if (harvesters < 3) {
            creepName = 'H_' + Game.time;
            creepRole = 'harvester';
            actualMemoryRole = 'preharvester';
            body = this.getHarvesterBody(energy);
        }
        // 策略2：提前生成即将死亡的采集者（RCL4+）
        else if (roomRCL >= 4 && this._needsPreSpawnHarvester(room, harvesters, energy)) {
            creepName = 'H_pre_' + Game.time;
            creepRole = 'harvester';
            actualMemoryRole = 'preharvester';
            body = this.getHarvesterBody(energy);
        }
        // 策略3：动态建造者（使用升级者身体，增加WORK）
        else if (sites.length > 0 && builders < Math.min(1 + Math.floor(sites.length / 15), 3)) {
            creepName = 'B_' + Game.time;
            creepRole = 'builder';
            actualMemoryRole = 'builder';
            body = this.getUpgraderBody(energy);
        }
        // 策略4：升级者
        else if (upgraders < 2) {
            creepName = 'U_' + Game.time;
            creepRole = 'upgrader';
            actualMemoryRole = 'upgrader';
            body = this.getUpgraderBody(energy);
        }
        // 策略5：提前生成即将死亡的升级者（RCL4+）
        else if (roomRCL >= 4 && this._needsPreSpawnUpgrader(room, upgraders, energy)) {
            creepName = 'U_pre_' + Game.time;
            creepRole = 'upgrader';
            actualMemoryRole = 'upgrader';
            body = this.getUpgraderBody(energy);
        }
        // 策略6：警察猫猫（全局唯一）
        else if (policeFlag && policemaomaos < 1) {
            creepName = 'PoliceTangYuan';
            creepRole = 'policemaomao';
            actualMemoryRole = 'policemaomao';
            body = this.getPoliceBody(energy);
        }
        // 策略7：修理者（使用升级者身体）
        else if (repairmen < 1) {
            creepName = 'R_' + Game.time;
            creepRole = 'repairman';
            actualMemoryRole = 'repairman';
            body = this.getUpgraderBody(energy);
        }
        // 策略8：保护者
        else if (protectors < 1) {
            creepName = 'P_' + Game.time;
            creepRole = 'protector';
            actualMemoryRole = 'protector';
            body = this.getProtectorBody(energy);
        }
        // 策略9：猫猫（全局唯一）
        else if (maomaos < 1) {
            creepName = 'TangYuanLonelyCat';
            creepRole = 'maomao';
            actualMemoryRole = 'maomao';
            body = [CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE];
        }
        // 策略10：可爱猫猫（全局唯一）
        else if (cutecats < 1) {
            creepName = 'TangYuanLovelyCat';
            creepRole = 'cutecat';
            actualMemoryRole = 'cutecat';
            body = [CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE];
        }
        // 策略11：矿物采集者（直接使用采集者身体，且矿物未耗尽）
        else if (mineralHarvesters < 1 && this._hasMineralRemaining(room)) {
            creepName = 'M_' + Game.time;
            creepRole = 'mineralHarvester';
            actualMemoryRole = 'mineralHarvester';
            body = this.getHarvesterBody(energy);
        }
        // 策略12：Carrier（需要连接配置，且考虑有效连接）
        else if (this._shouldSpawnCarrier(room, carriers)) {
            this.spawnCarrier(mainSpawn, room);
            return;
        }

        // 执行生成（非Carrier角色）
        if (creepName && creepRole && body.length > 0) {
            var cost = 0;
            for (var i = 0; i < body.length; i++) {
                cost += BODYPART_COST[body[i]];
            }
            if (energy >= cost) {
                var result = mainSpawn.spawnCreep(body, creepName, {
                    memory: {
                        role: actualMemoryRole,
                        boosted: false
                    }
                });
                if (result == OK) {
                    var roleEmoji = {
                        'protector': '🛡️',
                        'harvester': '⛏️',
                        'upgrader': '⬆️',
                        'builder': '🔨',
                        'repairman': '🔧',
                        'maomao': '🐱',
                        'cutecat': '⭐',
                        'mineralHarvester': '💎',
                        'policemaomao': '👮',
                        'preharvester': '⛏️'
                    }[actualMemoryRole] || creepRole;

                    var logRoleName = actualMemoryRole === 'preharvester' ? 'harvester' : creepRole;
                    console.log('[' + roomName + '] 🚀 ' + roleEmoji + ' 生成' + logRoleName + ': ' + creepName + ' (' + cost + '能量)');
                }
            }
        }
    },

    // ================== 新增预生成判断函数 ==================
    // 判断是否需要预生成采集者（基于总采集者数量和即将死亡的纯采集者）
    _needsPreSpawnHarvester: function(room, totalHarvesters, energy) {
        var dyingHarvesters = 0;
        for (var name in Game.creeps) {
            var c = Game.creeps[name];
            if (c.memory.role === 'harvester' && c.room.name === room.name && c.ticksToLive <= 50) {
                dyingHarvesters++;
            }
        }
        if (dyingHarvesters === 0) return false;
        var remainingAfterDeath = totalHarvesters - dyingHarvesters;
        return (remainingAfterDeath < 3 && energy >= 400);
    },

    // 判断是否需要预生成升级者
    _needsPreSpawnUpgrader: function(room, totalUpgraders, energy) {
        var dyingUpgraders = 0;
        for (var name in Game.creeps) {
            var c = Game.creeps[name];
            if (c.memory.role === 'upgrader' && c.room.name === room.name && c.ticksToLive <= 50) {
                dyingUpgraders++;
            }
        }
        if (dyingUpgraders === 0) return false;
        var remainingAfterDeath = totalUpgraders - dyingUpgraders;
        return (remainingAfterDeath < 2 && energy >= 400);
    },

    // ================== 矿物耗尽检查 ==================
    _hasMineralRemaining: function(room) {
        var minerals = room.find(FIND_MINERALS);
        if (minerals.length === 0) return false;
        var mineral = minerals[0];
        var extractors = room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_EXTRACTOR; }
        });
        if (extractors.length === 0) return false;
        return mineral.mineralAmount > 0;
    },

    // ================== 角色统计函数（无缓存）==================
    _getRoleCounts: function(room) {
        var counts = {
            harvester: 0,
            preharvester: 0,
            upgrader: 0,
            builder: 0,
            repairman: 0,
            protector: 0,
            maomao: 0,
            cutecat: 0,
            mineralHarvester: 0,
            policemaomao: 0,
            carrier: 0
        };

        // 存活creep
        for (var name in Game.creeps) {
            var creep = Game.creeps[name];
            var role = creep.memory.role;
            if (counts.hasOwnProperty(role)) {
                if (role === 'maomao' || role === 'cutecat' || role === 'policemaomao') {
                    counts[role]++; // 全局角色
                } else {
                    if (creep.room.name === room.name) {
                        counts[role]++; // 房间角色
                    }
                }
            }
        }

        // 正在生成的creep
        for (var spawnName in Game.spawns) {
            var spawn = Game.spawns[spawnName];
            if (spawn.spawning) {
                var creepMemory = Memory.creeps[spawn.spawning.name];
                if (creepMemory) {
                    var role = creepMemory.role;
                    if (counts.hasOwnProperty(role)) {
                        if (role === 'maomao' || role === 'cutecat' || role === 'policemaomao') {
                            counts[role]++; // 全局角色
                        } else {
                            if (spawn.room.name === room.name) {
                                counts[role]++; // 只计入同房间
                            }
                        }
                    }
                }
            }
        }

        return counts;
    },

    // ================== Carrier相关函数（增强有效连接判断）=================
    // 判断连接条件是否满足（复制自 roleCarrier 的逻辑）
    _checkCondition: function(conditionParsed, target) {
        if (!conditionParsed) return true; // 无条件视为真
        var targetAmount = target.store[conditionParsed.resourceType] || 0;
        switch(conditionParsed.operator) {
            case '>': return targetAmount > conditionParsed.value;
            case '>=': return targetAmount >= conditionParsed.value;
            case '<': return targetAmount < conditionParsed.value;
            case '<=': return targetAmount <= conditionParsed.value;
            case '==': return targetAmount === conditionParsed.value;
            case '!=': return targetAmount !== conditionParsed.value;
            default: return false;
        }
    },

    _shouldSpawnCarrier: function(room, currentCarriers) {
        var roomName = room.name;

        if (!Memory.TangYuanLonelyCat || !Memory.TangYuanLonelyCat.Carrier ||
            !Memory.TangYuanLonelyCat.Carrier[roomName] ||
            !Memory.TangYuanLonelyCat.Carrier[roomName].Connections) {
            return false;
        }

        var connections = Memory.TangYuanLonelyCat.Carrier[roomName].Connections;
        var validConnections = 0;

        for (var i = 0; i < connections.length; i++) {
            var conn = connections[i];
            var source = Game.getObjectById(conn.sourceId);
            var target = Game.getObjectById(conn.targetId);
            if (!source || !target || !source.store || !target.store) continue;

            // 检查条件（使用预解析的 conditionParsed）
            if (!this._checkCondition(conn.conditionParsed, target)) continue;

            // 可选：检查源是否有资源（但 Carrier 可能搬运未来资源，可不检查）
            // 为了更准确，可以检查源是否有资源（非ALL类型下），但可能资源刚被取走，暂时忽略
            validConnections++;
        }

        var needed = validConnections > 0 ? Math.ceil(validConnections / 3) : 0;
        return currentCarriers < needed;
    },

    spawnCarrier: function(spawn, room) {
        var energy = room.energyAvailable;
        var roomName = room.name;
        var body = [];
        var cost = 0;
        var creepName = '';

        if (energy >= 200) {
            body = [CARRY, MOVE, CARRY, MOVE];
            cost = 200;
            creepName = 'Carrier_' + Game.time;
        } else if (energy >= 100) {
            body = [CARRY, MOVE];
            cost = 100;
            creepName = 'Carr_' + Game.time;
        } else {
            return;
        }

        if (Game.creeps[creepName]) {
            creepName = creepName + '_' + Math.floor(Math.random() * 100);
        }

        var result = spawn.spawnCreep(body, creepName, {
            memory: {
                role: 'carrier',
                room: roomName,
                spawnTime: Game.time,
                performance: { totalTransfers: 0, lastTransfer: Game.time }
            }
        });

        if (result == OK) {
            console.log('[' + roomName + '] 🚛 生成Carrier: ' + creepName + ' (' + cost + '能量)');
            this._setDefaultCarrierTask(creepName, roomName);
        } else {
            console.log('[' + roomName + '] ❌ 生成Carrier失败: ' + result);
        }
    },

    _setDefaultCarrierTask: function(creepName, roomName) {
        var creep = Game.creeps[creepName];
        if (!creep) return;

        var connections = Memory.TangYuanLonelyCat.Carrier[roomName].Connections;
        if (connections.length === 0) return;

        // 遍历所有连接，寻找第一个源有资源、目标有空间且条件满足的连接
        for (var i = 0; i < connections.length; i++) {
            var conn = connections[i];
            var source = Game.getObjectById(conn.sourceId);
            var target = Game.getObjectById(conn.targetId);
            if (!source || !target || !source.store || !target.store) continue;

            // 检查条件
            if (!this._checkCondition(conn.conditionParsed, target)) continue;

            // 检查目标是否有空间接收该资源（仅当资源类型明确时）
            var resourceType = null;
            if (conn.resourceType !== 'ALL') {
                // 如果目标没有空闲容量，跳过
                if (target.store.getFreeCapacity(conn.resourceType) === 0) continue;
                resourceType = conn.resourceType;
            } else {
                // ALL 类型：需要确定源中哪种资源可搬运，且目标有空间接收该资源
                var storeKeys = Object.keys(source.store);
                for (var j = 0; j < storeKeys.length; j++) {
                    var res = storeKeys[j];
                    if (source.store[res] > 0 && target.store.getFreeCapacity(res) > 0) {
                        resourceType = res;
                        break;
                    }
                }
                if (!resourceType) continue; // 无可用资源
            }

            // 检查源中是否有资源
            if (source.store[resourceType] > 0) {
                creep.memory.currentTask = {
                    sourceId: conn.sourceId,
                    targetId: conn.targetId,
                    resourceType: resourceType,
                    conditionParsed: conn.conditionParsed // 携带预解析条件，便于后续检查
                };
                console.log('[' + roomName + '] ℹ️ 为Carrier ' + creepName + ' 设置初始任务: ' + resourceType + ' (从连接' + i + ')');
                return;
            }
        }

        // 如果没有找到合适任务，不设置任务，让 Carrier 自行寻找
        console.log('[' + roomName + '] ℹ️ Carrier ' + creepName + ' 无初始任务，将待机');
    },

    // ================== 紧急模式检查 ==================
    _checkAndSetEmergencyMode: function(room, pureHarvesterCount) {
        var need = false;
        var reason = '';

        if (pureHarvesterCount < 2 && room.energyAvailable < 400) {
            need = true;
            reason = '采集者不足(' + pureHarvesterCount + ')且能量低(' + room.energyAvailable + ')';
        }

        if (room.controller && room.controller.level >= 4) {
            var liveHarvesters = [];
            for (var name in Game.creeps) {
                var c = Game.creeps[name];
                if (c.memory.role === 'harvester' && c.room.name === room.name) {
                    liveHarvesters.push(c);
                }
            }
            var dying = [];
            for (var i = 0; i < liveHarvesters.length; i++) {
                if (liveHarvesters[i].ticksToLive <= 50) dying.push(liveHarvesters[i]);
            }
            if (dying.length > 0 && pureHarvesterCount - dying.length < 2 && room.energyAvailable < 400) {
                need = true;
                reason = '采集者即将死亡(' + dying.length + '个)且能量低(' + room.energyAvailable + ')';
            }
        }

        if (need && (!Memory.emergencyMode || !Memory.emergencyMode.active)) {
            Memory.emergencyMode = {
                active: true,
                startTime: Game.time,
                reason: reason,
                triggeredBy: room.name
            };
            console.log('[' + room.name + '] ⚠️ 紧急模式已激活: ' + reason);
        }
    },

    // ================== 辅助函数 ==================
    roomHasExtractorAndMineral: function(room) {
        var extractors = room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_EXTRACTOR; }
        });
        var minerals = room.find(FIND_MINERALS);
        return extractors.length > 0 && minerals.length > 0;
    },

    // 身体部件配置
    getPoliceBody: function(energy) {
        var pairCost = 150;
        var maxPairs = 6;
        var pairs = Math.min(Math.floor(energy / pairCost), maxPairs);
        if (pairs <= 0) return [];
        var body = [];
        for (var i = 0; i < pairs; i++) {
            body.push(ATTACK);
            body.push(MOVE);
        }
        return body;
    },

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
        if (energy >= 750) return [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (energy >= 650) return [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (energy >= 550) return [WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (energy >= 450) return [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE];
        if (energy >= 400) return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
        return [];
    },

    getBuilderBody: function(energy) {
        if (energy >= 850) return [WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        if (energy >= 700) return [WORK, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
        if (energy >= 600) return [WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
        if (energy >= 550) return [WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        if (energy >= 450) return [WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (energy >= 400) return [WORK, CARRY, CARRY, MOVE, MOVE];
        return [];
    },

    getProtectorBody: function(energy) {
        if (energy >= 280) return [CARRY, CARRY, MOVE, MOVE, ATTACK];
        return [];
    },

    // Carrier 工具方法（可选）
    markOldestCarrierForRecycle: function(carriers, keepCount) {
        if (carriers.length <= keepCount) return;
        carriers.sort(function(a, b) { return (a.memory.spawnTime || 0) - (b.memory.spawnTime || 0); });
        var recycleCount = carriers.length - keepCount;
        for (var i = 0; i < recycleCount; i++) {
            if (!carriers[i].memory.currentTask || carriers[i].store.getUsedCapacity() == 0) {
                carriers[i].memory.shouldRecycle = true;
                console.log('[' + carriers[i].room.name + '] 🗑️ 标记Carrier ' + carriers[i].name + ' 为回收状态');
            }
        }
    },

    cleanupOldCarriers: function() {
        var carriers = _.filter(Game.creeps, function(c) { return c.memory.role == 'carrier'; });
        var removed = 0;
        for (var i = 0; i < carriers.length; i++) {
            var creep = carriers[i];
            var roomName = creep.memory.room;
            if (!Memory.TangYuanLonelyCat || !Memory.TangYuanLonelyCat.Carrier ||
                !Memory.TangYuanLonelyCat.Carrier[roomName] ||
                Memory.TangYuanLonelyCat.Carrier[roomName].Connections.length === 0) {
                creep.memory.shouldRecycle = true;
                removed++;
            }
        }
        if (removed > 0) console.log('🧹 标记了' + removed + '个无任务Carrier待回收');
    },

    showCarrierStatus: function() {
        console.log('📊 Carrier系统状态报告:');
        console.log('═══════════════════════════════════════════════');
        var totalCarriers = 0, totalConnections = 0, totalNeeded = 0;
        for (var roomName in Game.rooms) {
            var room = Game.rooms[roomName];
            var carriers = _.filter(Game.creeps, function(c) { return c.memory.role == 'carrier' && c.room.name == roomName; });
            var connections = 0;
            if (Memory.TangYuanLonelyCat && Memory.TangYuanLonelyCat.Carrier && Memory.TangYuanLonelyCat.Carrier[roomName]) {
                connections = Memory.TangYuanLonelyCat.Carrier[roomName].Connections.length;
            }
            var needed = connections > 0 ? Math.ceil(connections / 3) : 0;
            if (carriers.length > 0 || connections > 0) {
                console.log('🏠 ' + roomName + ':');
                console.log('  连接数: ' + connections + ', 需要Carrier: ' + needed + ', 现有Carrier: ' + carriers.length);
                for (var i = 0; i < carriers.length; i++) {
                    var c = carriers[i];
                    var task = c.memory.currentTask ? '有任务' : '空闲';
                    var res = '';
                    if (c.store.getUsedCapacity() > 0) {
                        var type = Object.keys(c.store)[0];
                        res = '携带:' + type + '(' + c.store[type] + ')';
                    }
                    var flag = c.memory.shouldRecycle ? ' [回收标记]' : '';
                    console.log('    ' + c.name + ': ' + task + ' ' + res + ' TTL:' + c.ticksToLive + flag);
                }
                totalCarriers += carriers.length;
                totalConnections += connections;
                totalNeeded += needed;
            }
        }
        console.log('═══════════════════════════════════════════════');
        console.log('总计: ' + totalCarriers + '个Carrier / 需要' + totalNeeded + '个 / ' + totalConnections + '个连接');
        var all = _.filter(Game.creeps, function(c) { return c.memory.role == 'carrier'; });
        var avg = 0;
        if (all.length > 0) {
            var sum = 0;
            for (var i = 0; i < all.length; i++) sum += all[i].ticksToLive;
            avg = Math.floor(sum / all.length);
        }
        console.log('平均剩余寿命: ' + avg + 'tick');
        console.log('配置规则: 每3个有效连接分配1个Carrier');
        console.log('═══════════════════════════════════════════════');
    }
};