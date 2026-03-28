// ext.locksourceid.js - 采矿位分配和锁定模块
module.exports = {
    /**
     * 运行采矿位分配和锁定逻辑
     * @param {Room} room - 房间对象（可选，不传则遍历所有房间）
     */
    run: function(room) {
        // ========== 采矿位管理 ==========
        if (room) {
            // 单房间模式
            this._processRoom(room);
        } else {
            // 遍历所有房间模式（向后兼容）
            for (var roomName in Game.rooms) {
                this._processRoom(Game.rooms[roomName]);
            }
        }
    },
    
    /**
     * 处理单个房间
     * @param {Room} room - 房间对象
     */
    _processRoom: function(room) {
        // 确保房间内存中有miningPositions对象
        if (!room.memory.miningPositions) {
            room.memory.miningPositions = {};
        }
        
        // 计算采矿位
        this._calculateMiningPositions(room);
        
        // 先进行一次分配（只处理未锁定的）
        this._processNewCreepsInRoom(room);
        
        // 然后进行二次分配（只处理已锁定的，优化位置）
        this._redistributeCreeps(room);
    },
    
    /**
     * 处理房间内新creep的第一次分配
     * @param {Room} room - 房间对象
     */
    _processNewCreepsInRoom: function(room) {
        // ========== 检查房间存储状态 ==========
        var storageHasEnergy = false;
        if (room.storage && room.storage.store && room.storage.store[RESOURCE_ENERGY] > 0) {
            storageHasEnergy = true;
        }
        
        // ========== 处理新creep ==========
        // 获取当前房间内的所有creep
        var allCreeps = [];
        for (var creepName in Game.creeps) {
            var creep = Game.creeps[creepName];
            if (creep.room.name === room.name) {
                allCreeps.push(creep);
            }
        }
        
        // 初始化内存属性
        for (var i = 0; i < allCreeps.length; i++) {
            var creep = allCreeps[i];
            
            // 初始化内存属性
            if (creep.memory.needLockID === undefined) {
                creep.memory.needLockID = false;
            }
            if (creep.memory.LockID === undefined) {
                creep.memory.LockID = false;
            }
            
            // 检查creep是否有WORK部件
            var hasWorkPart = this._hasWorkPart(creep);
            
            // 如果有存储且有能量，只给harvester设置needLockID
            if (storageHasEnergy) {
                if (creep.memory.role === 'harvester' && hasWorkPart) {
                    creep.memory.needLockID = true;
                } else {
                    creep.memory.needLockID = false;
                }
            } else {
                // 没有存储或存储没能量，所有有WORK部件的creep都需要采矿位
                creep.memory.needLockID = hasWorkPart;
            }
        }
        
        // 过滤出需要处理的creep
        var creepsNeedingLock = [];
        for (var i = 0; i < allCreeps.length; i++) {
            var creep = allCreeps[i];
            if (creep.memory.needLockID === true && creep.memory.LockID === false) {
                creepsNeedingLock.push(creep);
            }
        }
        
        // 如果没有需要处理的creep，直接返回
        if (creepsNeedingLock.length === 0) {
            return;
        }
        
        // 统计已占用的采矿位
        var occupiedSlots = this._countOccupiedSlots(allCreeps);
        
        // 计算可用采矿位
        var availableSlots = this._calculateAvailableSlots(room, occupiedSlots);
        
        // 按照优先级分配采矿位
        this._assignMiningSlots(room, creepsNeedingLock, availableSlots);
    },
    
    /**
     * 进行二次分配，优化已分配的creep
     * @param {Room} room - 房间对象
     */
    _redistributeCreeps: function(room) {
        // ========== 检查房间存储状态 ==========
        var storageHasEnergy = false;
        if (room.storage && room.storage.store && room.storage.store[RESOURCE_ENERGY] > 0) {
            storageHasEnergy = true;
        }
        
        // ========== 优化已分配creep ==========
        // 获取房间内所有有WORK部件、已锁定且sourceId存在的creep
        var lockedCreeps = [];
        for (var creepName in Game.creeps) {
            var creep = Game.creeps[creepName];
            if (creep.room.name === room.name && 
                this._hasWorkPart(creep) &&
                creep.memory.needLockID === true &&
                creep.memory.LockID === true &&
                creep.memory.sourceId) {
                
                // 如果有存储且有能量，只优化harvester
                if (storageHasEnergy && creep.memory.role !== 'harvester') {
                    continue;
                }
                
                lockedCreeps.push(creep);
            }
        }
        
        // 如果没有已锁定的creep，直接返回
        if (lockedCreeps.length === 0) {
            return;
        }
        
        // 获取房间内所有能量源，并过滤掉能量为0的
        var sources = room.find(FIND_SOURCES).filter(source => source.energy > 0);
        
        // 如果所有能量源都枯竭了，直接返回，避免CPU浪费
        if (sources.length === 0) {
            return;
        }
        
        // 为每个能量源计算基础分数（不依赖特定creep）
        var sourceScores = {};
        var sourceTotalSlots = {};
        
        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];
            var sourceId = source.id;
            sourceTotalSlots[sourceId] = room.memory.miningPositions[sourceId] || 3;
            
            // 计算能量源的基础分数（只考虑能量源属性）
            sourceScores[sourceId] = {
                harvester: this._calculateHarvesterSourceScore(source, room),
                builder: this._calculateBuilderSourceScore(source, room),
                upgrader: this._calculateUpgraderSourceScore(source, room),
                general: this._calculateGeneralSourceScore(source, room)
            };
        }
        
        // 统计当前占用情况
        var currentOccupancy = this._countOccupiedSlots(lockedCreeps);
        
        // 计算每个能量源的剩余容量
        var remainingCapacity = {};
        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];
            var sourceId = source.id;
            var occupied = currentOccupancy[sourceId] || 0;
            var totalSlots = sourceTotalSlots[sourceId];
            remainingCapacity[sourceId] = Math.max(0, totalSlots - occupied);
        }
        
        // 按照优先级顺序处理不同角色的creep
        var priorityOrder = ['harvester', 'builder', 'upgrader'];
        
        for (var i = 0; i < priorityOrder.length; i++) {
            var role = priorityOrder[i];
            
            // 如果有存储且有能量，只优化harvester
            if (storageHasEnergy && role !== 'harvester') {
                continue;
            }
            
            // 获取该角色的所有creep
            var roleCreeps = [];
            for (var j = 0; j < lockedCreeps.length; j++) {
                var creep = lockedCreeps[j];
                if (creep.memory.role === role) {
                    roleCreeps.push(creep);
                }
            }
            
            if (roleCreeps.length === 0) {
                continue;
            }
            
            // 找出所有需要优化的creep
            var creepsToOptimize = [];
            var wellPlacedCreeps = [];
            
            for (var j = 0; j < roleCreeps.length; j++) {
                var creep = roleCreeps[j];
                var currentSourceId = creep.memory.sourceId;
                var currentSource = Game.getObjectById(currentSourceId);
                
                // 如果当前能量源枯竭了，必须重新分配
                var mustReassign = !currentSource || currentSource.energy === 0;
                
                if (!currentSource || mustReassign) {
                    creepsToOptimize.push({
                        creep: creep,
                        currentSourceId: currentSourceId,
                        alternativeSource: null,
                        scoreImprovement: Infinity, // 强制重新分配
                        mustReassign: mustReassign
                    });
                    continue;
                }
                
                // 计算当前能量源对该creep的分数
                var currentScore = sourceScores[currentSourceId] ? 
                               (sourceScores[currentSourceId][role] || sourceScores[currentSourceId].general) : 
                               0;
                
                // 检查是否有更好的能量源可用
                var bestAlternativeScore = currentScore;
                var bestAlternativeSource = null;
                
                for (var k = 0; k < sources.length; k++) {
                    var source = sources[k];
                    var sourceId = source.id;
                    if (sourceId === currentSourceId) {
                        continue;
                    }
                    
                    // 如果该能量源已满，跳过
                    if (remainingCapacity[sourceId] <= 0) {
                        continue;
                    }
                    
                    var alternativeScore = sourceScores[sourceId][role] || 
                                           sourceScores[sourceId].general;
                    
                    // 只有当新能量源明显更好时才考虑切换（避免来回切换）
                    // 对于收获者：新能量源分数必须比当前高20%以上
                    // 对于其他角色：新能量源分数必须比当前高10%以上
                    var improvementThreshold = role === 'harvester' ? 1.2 : 1.1;
                    
                    if (alternativeScore > bestAlternativeScore * improvementThreshold) {
                        bestAlternativeScore = alternativeScore;
                        bestAlternativeSource = source;
                    }
                }
                
                if (bestAlternativeSource) {
                    creepsToOptimize.push({
                        creep: creep,
                        currentSourceId: currentSourceId,
                        alternativeSource: bestAlternativeSource,
                        scoreImprovement: bestAlternativeScore / currentScore,
                        mustReassign: false
                    });
                } else {
                    wellPlacedCreeps.push(creep);
                }
            }
            
            // 按分数提升程度排序，提升最大的先处理
            creepsToOptimize.sort(function(a, b) {
                if (a.mustReassign && !b.mustReassign) return -1;
                if (!a.mustReassign && b.mustReassign) return 1;
                return b.scoreImprovement - a.scoreImprovement;
            });
            
            // 逐个优化需要调整的creep
            for (var j = 0; j < creepsToOptimize.length; j++) {
                var optimization = creepsToOptimize[j];
                var creep = optimization.creep;
                var currentSourceId = optimization.currentSourceId;
                var alternativeSource = optimization.alternativeSource;
                var mustReassign = optimization.mustReassign;
                
                // 如果是必须重新分配，找一个有空位的能量源
                if (mustReassign && !alternativeSource) {
                    for (var k = 0; k < sources.length; k++) {
                        var source = sources[k];
                        var sourceId = source.id;
                        if (remainingCapacity[sourceId] > 0) {
                            alternativeSource = source;
                            break;
                        }
                    }
                }
                
                // 如果还是找不到可用的能量源，跳过（避免CPU浪费）
                if (!alternativeSource) {
                    continue;
                }
                
                var alternativeSourceId = alternativeSource.id;
                var scoreImprovement = optimization.scoreImprovement;
                
                // 再次检查剩余容量
                if (remainingCapacity[alternativeSourceId] <= 0) {
                    continue;
                }
                
                // 执行切换
                if (mustReassign) {
                    console.log('[' + room.name + '] 二次分配(强制): ' + creep.name + ' (' + role + ') 从 ' + currentSourceId + ' 切换到 ' + alternativeSourceId + ' (能量源枯竭)');
                } else {
                    console.log('[' + room.name + '] 二次分配: ' + creep.name + ' (' + role + ') 从 ' + currentSourceId + ' 切换到 ' + alternativeSourceId + ', 分数提升: ' + scoreImprovement.toFixed(2) + 'x');
                }
                
                // 更新占用统计
                if (currentSourceId && currentOccupancy[currentSourceId]) {
                    currentOccupancy[currentSourceId]--;
                }
                if (!currentOccupancy[alternativeSourceId]) {
                    currentOccupancy[alternativeSourceId] = 0;
                }
                currentOccupancy[alternativeSourceId]++;
                
                // 更新剩余容量
                if (currentSourceId) {
                    remainingCapacity[currentSourceId]++;
                }
                remainingCapacity[alternativeSourceId]--;
                
                // 更新creep的内存
                creep.memory.sourceId = alternativeSourceId;
            }
        }
    },
    
    /**
     * 计算能量源对收获者的基础分数
     * 收获者：能量源离LINK远近是绝对重要的因素，离spawn远近是次要因素
     */
    _calculateHarvesterSourceScore: function(source, room) {
        // ========== 计算收获者分数 ==========
        var score = 0;
        
        // 获取所有spawn和LINK
        var spawns = room.find(FIND_MY_SPAWNS);
        var links = room.find(FIND_MY_STRUCTURES, {
            filter: function(s) {
                return s.structureType === STRUCTURE_LINK;
            }
        });
        
        if (links.length > 0) {
            // 绝对重要：离LINK近的能量源
            var closestLink = source.pos.findClosestByRange(links);
            var linkDistance = source.pos.getRangeTo(closestLink);
            
            // 距离越近分数越高
            if (linkDistance <= 2) {
                score += 1000; // 非常近的LINK，极大优势
            } else if (linkDistance <= 5) {
                score += 500; // 中等距离
            } else {
                score += Math.max(100, 500 - linkDistance * 50); // 远距离
            }
            
            // 次要因素：离spawn近的
            if (spawns.length > 0) {
                var closestSpawn = source.pos.findClosestByRange(spawns);
                var spawnDistance = source.pos.getRangeTo(closestSpawn);
                score += Math.max(0, 200 - spawnDistance * 10);
            }
        } else if (spawns.length > 0) {
            // 没有LINK时，离spawn远近成为主要因素
            var closestSpawn = source.pos.findClosestByRange(spawns);
            var spawnDistance = source.pos.getRangeTo(closestSpawn);
            score += Math.max(100, 500 - spawnDistance * 30);
        }
        
        return Math.max(1, score); // 确保分数为正
    },
    
    /**
     * 计算能量源对建造者的基础分数
     * 建造者：能量源离建筑工地距离是最重要的因素
     */
    _calculateBuilderSourceScore: function(source, room) {
        // ========== 计算建造者分数 ==========
        var score = 0;
        
        // 获取所有建筑工地
        var constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        
        if (constructionSites.length > 0) {
            // 计算离最近建筑工地的距离
            var closestSite = source.pos.findClosestByRange(constructionSites);
            if (closestSite) {
                var siteDistance = source.pos.getRangeTo(closestSite);
                
                // 距离越近分数越高
                if (siteDistance <= 5) {
                    score += 800; // 近处的建筑工地
                } else if (siteDistance <= 10) {
                    score += 400; // 中等距离
                } else {
                    score += Math.max(100, 400 - siteDistance * 20); // 远距离
                }
            }
        }
        
        return Math.max(1, score);
    },
    
    /**
     * 计算能量源对升级者的基础分数
     * 升级者：能量源离控制器绝对距离是最重要的因素
     */
    _calculateUpgraderSourceScore: function(source, room) {
        // ========== 计算升级者分数 ==========
        var score = 0;
        
        // 获取控制器
        var controller = room.controller;
        
        if (controller) {
            var controllerDistance = source.pos.getRangeTo(controller);
            
            // 距离越近分数越高
            if (controllerDistance <= 5) {
                score += 1000; // 非常近的控制器
            } else if (controllerDistance <= 10) {
                score += 600; // 中等距离
            } else {
                score += Math.max(100, 600 - controllerDistance * 30); // 远距离
            }
        }
        
        return Math.max(1, score);
    },
    
    /**
     * 计算能量源的通用分数
     */
    _calculateGeneralSourceScore: function(source, room) {
        // ========== 计算通用分数 ==========
        // 通用分数主要考虑能量源的位置稳定性
        // 能量源的位置是不变的，所以我们可以给它一个固定分数
        // 使用能量源的坐标生成一个哈希值作为基础分数
        var hash = source.pos.x * 100 + source.pos.y;
        return 100 + (hash % 100); // 100-199之间的分数
    },
    
    /**
     * 计算房间内所有能量源的可用采矿位
     */
    _calculateMiningPositions: function(room) {
        // ========== 计算采矿位 ==========
        // 获取房间内所有能量源
        var sources = room.find(FIND_SOURCES);
        
        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];
            var availableSlots = 0;
            
            // 检查能量源周围3x3范围内的所有位置
            for (var x = -1; x <= 1; x++) {
                for (var y = -1; y <= 1; y++) {
                    if (x === 0 && y === 0) {
                        continue; // 跳过能量源本身
                    }
                    
                    var pos = new RoomPosition(
                        source.pos.x + x,
                        source.pos.y + y,
                        room.name
                    );
                    
                    if (this._isValidMiningPosition(pos)) {
                        availableSlots++;
                    }
                }
            }
            
            room.memory.miningPositions[source.id] = availableSlots;
        }
    },
    
    /**
     * 检查位置是否为有效的采矿位
     */
    _isValidMiningPosition: function(pos) {
        // ========== 检查采矿位有效性 ==========
        // 先检查地形，使用getTerrain()方法更高效
        var terrain = Game.map.getRoomTerrain(pos.roomName);
        if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) {
            return false;
        }
        
        // 检查是否有其他结构（除了墙和城墙）
        var structures = pos.lookFor(LOOK_STRUCTURES);
        for (var i = 0; i < structures.length; i++) {
            var structure = structures[i];
            if (structure.structureType !== STRUCTURE_WALL && structure.structureType !== STRUCTURE_RAMPART) {
                return false;
            }
        }
        
        // 检查是否有建筑工地
        var constructionSites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
        if (constructionSites.length > 0) {
            return false;
        }
        
        return true;
    },
    
    /**
     * 统计已占用的采矿位
     */
    _countOccupiedSlots: function(creeps) {
        // ========== 统计占用情况 ==========
        var occupiedSlots = {};
        
        for (var i = 0; i < creeps.length; i++) {
            var creep = creeps[i];
            if (creep.memory.LockID === true && creep.memory.sourceId) {
                var sourceId = creep.memory.sourceId;
                if (!occupiedSlots[sourceId]) {
                    occupiedSlots[sourceId] = 0;
                }
                occupiedSlots[sourceId]++;
            }
        }
        
        return occupiedSlots;
    },
    
    /**
     * 计算可用采矿位
     */
    _calculateAvailableSlots: function(room, occupiedSlots) {
        // ========== 计算可用采矿位 ==========
        var availableSlots = {};
        // 获取房间内所有能量源
        var sources = room.find(FIND_SOURCES);
        
        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];
            var sourceId = source.id;
            var totalSlots = room.memory.miningPositions[sourceId] || 3;
            var occupied = occupiedSlots[sourceId] || 0;
            availableSlots[sourceId] = Math.max(0, totalSlots - occupied);
        }
        
        return availableSlots;
    },
    
    /**
     * 按照优先级分配采矿位（一次分配）
     */
    _assignMiningSlots: function(room, creeps, availableSlots) {
        // ========== 检查房间存储状态 ==========
        var storageHasEnergy = false;
        if (room.storage && room.storage.store && room.storage.store[RESOURCE_ENERGY] > 0) {
            storageHasEnergy = true;
        }
        
        // ========== 分配采矿位 ==========
        // 获取房间内所有能量源，过滤掉能量为0的
        var sources = room.find(FIND_SOURCES).filter(source => source.energy > 0);
        
        // 如果所有能量源都枯竭了，直接返回，避免CPU浪费
        if (sources.length === 0) {
            return;
        }
        
        var priorityOrder = ['harvester', 'builder', 'upgrader', 'repairman'];
        
        for (var i = 0; i < priorityOrder.length; i++) {
            var role = priorityOrder[i];
            
            // 如果有存储且有能量，只分配harvester
            if (storageHasEnergy && role !== 'harvester') {
                continue;
            }
            
            // 获取该角色的所有creep
            var roleCreeps = [];
            for (var j = 0; j < creeps.length; j++) {
                var creep = creeps[j];
                if (creep.memory.role === role) {
                    roleCreeps.push(creep);
                }
            }
            
            // 为该角色的每个creep分配采矿位
            for (var j = 0; j < roleCreeps.length; j++) {
                var creep = roleCreeps[j];
                var assigned = false;
                
                if (role === 'harvester') {
                    assigned = this._assignToHarvester(creep, sources, availableSlots);
                } else if (role === 'builder') {
                    assigned = this._assignToBuilder(creep, sources, availableSlots);
                } else if (role === 'upgrader') {
                    assigned = this._assignToUpgrader(creep, sources, availableSlots);
                } else if (role === 'repairman') {
                    assigned = this._assignToRepairman(creep, sources, availableSlots);
                }
                
                if (assigned) {
                    availableSlots[assigned]--;
                }
            }
        }
        
        // 处理其他角色的creep
        var otherCreeps = [];
        for (var j = 0; j < creeps.length; j++) {
            var creep = creeps[j];
            var isPriority = false;
            for (var i = 0; i < priorityOrder.length; i++) {
                if (creep.memory.role === priorityOrder[i]) {
                    isPriority = true;
                    break;
                }
            }
            if (!isPriority) {
                otherCreeps.push(creep);
            }
        }
        
        // 如果有存储且有能量，其他角色不分配采矿位
        if (!storageHasEnergy) {
            for (var j = 0; j < otherCreeps.length; j++) {
                var creep = otherCreeps[j];
                var assigned = this._assignToOther(creep, sources, availableSlots);
                if (assigned) {
                    availableSlots[assigned]--;
                }
            }
        }
    },
    
    /**
     * 为采集者分配能量源（一次分配）
     */
    _assignToHarvester: function(creep, sources, availableSlots) {
        // ========== 分配给采集者 ==========
        var bestSource = null;
        var bestScore = -Infinity;
        
        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];
            var sourceId = source.id;
            
            // 跳过没有空位的能量源
            if (!availableSlots[sourceId] || availableSlots[sourceId] <= 0) {
                continue;
            }
            
            var score = this._calculateHarvesterSourceScore(source, creep.room);
            
            if (score > bestScore) {
                bestScore = score;
                bestSource = source;
            }
        }
        
        if (bestSource) {
            this._lockSource(creep, bestSource.id);
            return bestSource.id;
        }
        
        return null;
    },
    
    /**
     * 为建造者分配能量源（一次分配）
     */
    _assignToBuilder: function(creep, sources, availableSlots) {
        // ========== 分配给建造者 ==========
        var bestSource = null;
        var bestScore = -Infinity;
        
        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];
            var sourceId = source.id;
            
            // 跳过没有空位的能量源
            if (!availableSlots[sourceId] || availableSlots[sourceId] <= 0) {
                continue;
            }
            
            var score = this._calculateBuilderSourceScore(source, creep.room);
            
            if (score > bestScore) {
                bestScore = score;
                bestSource = source;
            }
        }
        
        if (bestSource) {
            this._lockSource(creep, bestSource.id);
            return bestSource.id;
        }
        
        return null;
    },
    
    /**
     * 为升级者分配能量源（一次分配）
     */
    _assignToUpgrader: function(creep, sources, availableSlots) {
        // ========== 分配给升级者 ==========
        var bestSource = null;
        var bestScore = -Infinity;
        
        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];
            var sourceId = source.id;
            
            // 跳过没有空位的能量源
            if (!availableSlots[sourceId] || availableSlots[sourceId] <= 0) {
                continue;
            }
            
            var score = this._calculateUpgraderSourceScore(source, creep.room);
            
            if (score > bestScore) {
                bestScore = score;
                bestSource = source;
            }
        }
        
        if (bestSource) {
            this._lockSource(creep, bestSource.id);
            return bestSource.id;
        }
        
        return null;
    },
    
    /**
     * 为修理者分配能量源（一次分配）
     */
    _assignToRepairman: function(creep, sources, availableSlots) {
        // ========== 分配给修理者 ==========
        var bestSource = null;
        var bestScore = -Infinity;
        
        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];
            var sourceId = source.id;
            
            // 跳过没有空位的能量源
            if (!availableSlots[sourceId] || availableSlots[sourceId] <= 0) {
                continue;
            }
            
            // 修理者考虑离自己近的
            var distance = creep.pos.getRangeTo(source);
            var score = 1000 / (distance + 1);
            
            if (score > bestScore) {
                bestScore = score;
                bestSource = source;
            }
        }
        
        if (bestSource) {
            this._lockSource(creep, bestSource.id);
            return bestSource.id;
        }
        
        return null;
    },
    
    /**
     * 为其他角色分配能量源（一次分配）
     */
    _assignToOther: function(creep, sources, availableSlots) {
        // ========== 分配给其他角色 ==========
        var bestSource = null;
        var bestScore = -Infinity;
        
        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];
            var sourceId = source.id;
            
            // 跳过没有空位的能量源
            if (!availableSlots[sourceId] || availableSlots[sourceId] <= 0) {
                continue;
            }
            
            // 其他角色考虑离自己近的
            var distance = creep.pos.getRangeTo(source);
            var score = 1000 / (distance + 1);
            
            if (score > bestScore) {
                bestScore = score;
                bestSource = source;
            }
        }
        
        if (bestSource) {
            this._lockSource(creep, bestSource.id);
            return bestSource.id;
        }
        
        return null;
    },
    
    /**
     * 为creep锁定能量源
     */
    _lockSource: function(creep, sourceId) {
        // ========== 锁定能量源 ==========
        creep.memory.sourceId = sourceId;
        creep.memory.LockID = true;
        creep.memory.needLockID = true;
    },
    
    /**
     * 检查creep是否有WORK部件
     */
    _hasWorkPart: function(creep) {
        // 检查creep是否有WORK部件
        for (var i = 0; i < creep.body.length; i++) {
            if (creep.body[i].type === WORK) {
                return true;
            }
        }
        return false;
    }
};