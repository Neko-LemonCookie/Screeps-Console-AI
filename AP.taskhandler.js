/**
 * AP.taskhandler.js
 * 任务处理器，负责根据任务情况生成 creep。
 * 兼顾 carry 任务的创建和工厂生产流程。
 */

const modules = require('module.references');

const APTaskhandler = {
    /**
     * 运行任务处理器
     */
    run: function() {
        // 【Phase 3】处理Strategy任务（决策层→执行层转换）
        this._processStrategyTasks();

        // 0. 自动创建 build 任务
        this._autoCreateBuildTasks();
        
        // 1. 统计需要额外生成多少 creep
        const creepNeeds = this._calculateCreepNeeds();
        
        // 2. 为每个房间生成需要的 creep
        for (const roomName in creepNeeds) {
            const needs = creepNeeds[roomName];
            if (needs.length === 0) continue;
            
            const room = Game.rooms[roomName];
            if (!room || !room.controller || !room.controller.my) continue;
            
            // 按优先级生成 creep
            for (const need of needs) {
                this._spawnCreepForTask(room, need);
            }
        }
        
        // 3. 处理终端能量运输任务
        this._handleTerminalEnergyTransport();

        // 4. 处理 LAB 反应任务（在工厂之前，防止资源错配）
        this._handleLabReaction();
        
        // 5. 处理工厂生产流程
        this._handleFactoryProduction();
    },

    /**
     * 【新增】处理Strategy任务（决策层→执行层转换）
     * @private
     */
    _processStrategyTasks: function() {
        if (!Memory.Taskboard || !Memory.Taskboard.Task || !Memory.Taskboard.Task.Strategy) return;
        
        const taskboard = require('lib.AP.taskboard');
        
        for (const roomName in Memory.Taskboard.Task.Strategy) {
            const tasks = Memory.Taskboard.Task.Strategy[roomName];
            if (!Array.isArray(tasks)) continue;
            
            // 倒序遍历以便安全删除
            for (let i = tasks.length - 1; i >= 0; i--) {
                const task = tasks[i];
                
                // 跳过已处理的任务
                if (task.takenBy) continue;
                
                // 根据任务类型分发处理
                switch (task.type) {
                    case 'need_creeps':
                        this._handleNeedCreeps(taskboard, roomName, task);
                        break;
                        
                    case 'market_action':
                        this._handleMarketAction(taskboard, roomName, task);
                        break;
                        
                    case 'lab_production':
                        this._handleLabProduction(taskboard, roomName, task);
                        break;
                        
                    default:
                        console.log("[TaskHandler] WARN: 未知的Strategy任务类型: " + task.type);
                }
                
                // 标记为已处理
                task.takenBy = 'taskhandler';
            }
            
            // 【新增】清理已处理的过期Strategy任务（防止内存泄漏）
            // 保留最近500tick的任务用于调试，更早的删除
            const now = Game.time;
            Memory.Taskboard.Task.Strategy[roomName] = tasks.filter(function(task) {
                if (!task.takenBy) return true;  // 未处理的保留
                if (!task.createdTime) return true;  // 无时间戳的保留（异常保护）
                return (now - task.createdTime) < 500;  // 500tick内的保留，超时删除
            });
        }
    },

    /**
     * 【新增】处理Creep需求：转换为具体的Spawn任务
     * @param {Object} taskboard Taskboard实例
     * @param {string} roomName 房间名
     * @param {Object} strategyTask Strategy任务对象
     * @private
     */
    _handleNeedCreeps: function(taskboard, roomName, strategyTask) {
        const model = strategyTask.data && strategyTask.data.model;
        const deficit = strategyTask.data && strategyTask.data.count;  // 策略层传的是差值（还需多少个）
        const priority = (strategyTask.data && strategyTask.data.priority) || 'harvest';
        const taskOnly = strategyTask.data && strategyTask.data.data && strategyTask.data.data.taskOnly;
        const spawnOnly = strategyTask.data && strategyTask.data.data && strategyTask.data.data.spawnOnly;
        const taskTarget = (taskOnly && strategyTask.data && strategyTask.data.targetCount) || 1;

        if (!model) return;

        const currentCount = this._countCreepsByModel(roomName, model);
        const idleCount = this._countIdleCreepsByModel(roomName, model);

        // taskOnly模式：只发布Creep任务，不生成新creep（用于upgrade/repair等辅助任务）
        if (taskOnly) {
            this._publishCreepTasks(taskboard, roomName, priority, taskTarget);
            return;
        }

        if (!deficit || deficit <= 0) return;

        // spawnOnly模式：只生成creep，不发Creep任务（任务由taskOnly单独管理）
        if (!spawnOnly) {
            const totalTarget = currentCount + deficit;
            this._publishCreepTasks(taskboard, roomName, priority, totalTarget);
        }

        // ========== 第二步：按需发布Spawn任务（差值已经是需补数）==========
        if (deficit <= 0) return;

        // 用房间实际能量容量计算模板能量值
        const adapter = require('adapter.wasm_spawncreep');
        const room = Game.rooms[roomName];
        const roomEnergyCap = room ? room.energyCapacityAvailable : 300;
        var energy;
        switch (model) {
            case 'CommonI': energy = adapter.calcBodyCost(adapter.getCommonIBody(roomEnergyCap)); break;
            case 'CarrierI': energy = adapter.calcBodyCost(adapter.getCarrierIBody(roomEnergyCap)); break;
            case 'AttackerI': energy = adapter.calcBodyCost(adapter.getAttackerIBody(roomEnergyCap)); break;
            case 'ClaimerI': energy = adapter.calcBodyCost(adapter.getClaimerIBody(roomEnergyCap)); break;
            default: energy = 200; break;
        }

        // 【新增】考虑等待中的 spawn 任务，避免重复生成
        const existingSpawnTasks = modules.taskboard.getTasks(roomName, 'Buildings');
        const waitingSpawnTasks = existingSpawnTasks.filter(t => t.type === 'spawn' && !t.takenBy);

        for (const task of waitingSpawnTasks) {
            const taskModel = task.data.model;
            switch (taskModel) {
                case 'AttackerI':
                    deficit--;
                    break;
                case 'CarrierI':
                    deficit--;
                    break;
                case 'ClaimerI':
                    deficit--;
                    break;
                case 'CommonI':
                    deficit--;
                    break;
            }
        }

        // 每次最多补3个
        const spawnCount = Math.min(deficit, 3);
        for (var i = 0; i < spawnCount; i++) {
            taskboard.buildings.spawn(roomName, model, priority, { energy: energy, model: model });
        }

        if (Game.time % 100 === 0) {
            console.log("[TaskHandler] Spawn: " + model + " 需补" + deficit +
                       ", 场上" + currentCount + "+空闲" + idleCount + ", 补+" + spawnCount +
                       " (energy=" + energy + ")");
        }
    },

    /**
     * 发布Creep任务（流式，每周期都执行）
     * 确保任务队列中有足够的工作让unibot接单
     * @private
     */
    _publishCreepTasks: function(taskboard, roomName, taskType, targetCount) {
        if (!taskboard.creeps[taskType]) return;

        // 统计全部同类型任务（含已分配），避免任务堆积
        var existingTasks = taskboard.getTasks(roomName, 'Creeps') || [];
        var totalCount = 0;
        for (var i = 0; i < existingTasks.length; i++) {
            if (existingTasks[i].type === taskType) totalCount++;
        }

        // 补充到目标数量
        var toAdd = targetCount - totalCount;
        if (toAdd <= 0) return;

        // 直接写入任务板（绕过 creeps.* 方法的参数校验，
        // 因为流式任务的 sourceId/targetId 由 unibot 领取时动态绑定）
        for (var j = 0; j < toAdd; j++) {
            taskboard._addTask('Creeps', roomName, taskType, { autoAssign: true });
        }
    },

    /**
     * 【新增】将bodySize字符串转换为实际能量值
     * small=450(4part基础体) medium=700(6part) large=850(8part) max=房间容量上限
     * @private
     */
    _resolveEnergy: function(bodySize, room) {
        const sizeMap = {
            'small': 450,
            'medium': 700,
            'large': 850,
            'max': room ? room.energyCapacityAvailable : 800
        };
        return sizeMap[bodySize] || 550;  // 默认medium
    },

    /**
     * 统计指定型号的Creep数量（全局统计，包括跨房工作的creep）
     * @param {string} roomName 房间名（用于 spawnRoom 匹配）
     * @param {string} model Creep型号
     * @returns {number} 数量
     * @private
     */
    _countCreepsByModel: function(roomName, model) {
        let count = 0;
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.memory.model === model && creep.memory.spawnRoom === roomName) count++;
        }
        return count;
    },

    /**
     * 统计空闲Creep数量（有creep但没接任务的）
     * @private
     */
    _countIdleCreepsByModel: function(roomName, model) {
        var count = 0;
        if (!Game.rooms[roomName]) return count;

        var creeps = Game.rooms[roomName].find(FIND_MY_CREEPS);
        for (var i = 0; i < creeps.length; i++) {
            var c = creeps[i];
            if (c.memory.model !== model) continue;
            // 空闲：没任务 或 任务已完成（takenBy不是自己）
            if (!c.memory.taskType || !this._isCreepBusy(c)) count++;
        }
        return count;
    },

    /**
     * 检查creep是否正在执行任务
     * @private
     */
    _isCreepBusy: function(creep) {
        if (!Memory.Taskboard || !Memory.Taskboard.Task || !Memory.Taskboard.Task.Creeps) return false;
        var roomTasks = Memory.Taskboard.Task.Creeps[creep.room.name];
        if (!roomTasks) return false;
        for (var i = 0; i < roomTasks.length; i++) {
            if (roomTasks[i].takenBy === creep.name) return true;
        }
        return false;
    },

    /**
     * 【新增】处理市场操作需求
     * @private
     */
    _handleMarketAction: function(taskboard, roomName, task) {
        if (typeof ENABLE_MARKET !== 'undefined' && !ENABLE_MARKET) return;
        
        const action = task.data && task.data.action;
        const resource = task.data && task.data.resource;
        const amount = task.data && task.data.amount;
        
        console.log("[TaskHandler] 🏷️ 市场操作请求: " + action + " " + amount + " " + resource + 
                   " in " + roomName);
        // 具体市场操作由buildingTerminal或market模块执行
    },

    /**
     * 【新增】处理Lab生产需求
     * @private
     */
    _handleLabProduction: function(taskboard, roomName, task) {
        const compound = task.data && task.data.compound;
        const targetAmount = task.data && task.data.targetAmount;
        
        console.log("[TaskHandler] 🧪 Lab生产请求: 生产 " + targetAmount + " " + compound + 
                   " in " + roomName);
        // 具体生产由building.lab.js或独立lab管理模块执行
    },

    /**
     * 自动创建 build 任务
     * @private
     */
    _autoCreateBuildTasks: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;
            
            // 查找所有建筑工地
            const siteIds = modules.search.get.constructionSites(room.name);
            if (!siteIds || siteIds.length === 0) continue;
            
            // 检查是否已经有 build 任务
            const existingBuildTasks = modules.taskboard.getTasks(roomName, 'Creeps');
            const existingEnergySources = new Set();
            
            for (const task of existingBuildTasks) {
                if (task.type === 'build' && task.data && task.data.targetId) {
                    existingEnergySources.add(task.data.targetId);
                }
            }
            
            // 按照优先级查找能量来源
            const energySources = this._findEnergySourcesByPriority(room);
            
            // 为每个能量来源创建 build 任务（优先选择存储和容器，避免使用终端和市场相关资源）
            for (const sourceId of energySources) {
                if (!existingEnergySources.has(sourceId)) {
                    // 检查是否是终端，如果是则跳过（终端能量应保留用于市场）
                    const sourceObj = Game.getObjectById(sourceId);
                    if (sourceObj && sourceObj.structureType === STRUCTURE_TERMINAL) continue;

                    modules.taskboard.creeps.build(roomName, sourceId);
                    // 每个能量来源只创建一个 build 任务
                    break;
                }
            }
        }
    },

    /**
     * 按照优先级查找能量来源
     * 优先级：存储 > LINK > 容器 > 地板（散落能量） > 终端 > 自己挖
     * @private
     */
    _findEnergySourcesByPriority: function(room) {
        const sources = [];
        
        // 1. 存储 (Storage)
        const storage = room.storage;
        if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            sources.push(storage.id);
        }
        
        // 2. LINK
        const links = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        });
        for (const link of links) {
            sources.push(link.id);
        }
        
        // 3. 容器 (Container)
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        });
        for (const container of containers) {
            sources.push(container.id);
        }
        
        // 4. 地板（散落能量）
        const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 0
        });
        if (droppedEnergy.length > 0) {
            // 取离散落能量最近的 Source 作为代理（散落能量无独立ID）
            const nearestToDropped = room.find(FIND_SOURCES, {
                filter: s => s.pos.findInRange(droppedEnergy, 3).length > 0
            });
            if (nearestToDropped.length > 0) {
                sources.push(nearestToDropped[0].id);
            } else {
                // 兜底：取房间内任意一个Source
                const sourcesInRoom = room.find(FIND_SOURCES);
                if (sourcesInRoom.length > 0) {
                    sources.push(sourcesInRoom[0].id);
                }
            }
        }
        
        // 5. 终端 (Terminal)
        const terminal = room.terminal;
        if (terminal && terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            sources.push(terminal.id);
        }
        
        // 6. 自己挖 (Source)
        const sourceList = room.find(FIND_SOURCES);
        for (const source of sourceList) {
            sources.push(source.id);
        }
        
        return sources;
    },

    /**
     * 计算需要额外生成多少 creep
     * @private
     */
    _calculateCreepNeeds: function() {
        const creepNeeds = {};
        
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;
            
            const needs = [];
            
            // 获取该房间的所有 Creeps 任务
            const tasks = modules.taskboard.getTasks(roomName, 'Creeps');
            if (!Array.isArray(tasks)) continue;
            
            // 统计任务数量
            const taskCounts = {};
            for (const task of tasks) {
                if (!taskCounts[task.type]) taskCounts[task.type] = 0;
                taskCounts[task.type]++;
            }
            
            // 统计有效 creep
            const validCreeps = this._countValidCreeps(roomName);

            // 【新增】考虑等待中的 spawn 任务
            const existingSpawnTasks = modules.taskboard.getTasks(roomName, 'Buildings');
            const waitingSpawnTasks = existingSpawnTasks.filter(t => t.type === 'spawn' && !t.takenBy);

            for (const task of waitingSpawnTasks) {
                const model = task.data.model;
                switch (model) {
                    case 'AttackerI':
                        validCreeps['police'] = (validCreeps['police'] || 0) + 1;
                        break;
                    case 'CarrierI':
                        validCreeps['carry'] = (validCreeps['carry'] || 0) + 1;
                        break;
                    case 'ClaimerI':
                        validCreeps['claim'] = (validCreeps['claim'] || 0) + 1;
                        break;
                    case 'CommonI':
                        validCreeps['harvest'] = (validCreeps['harvest'] || 0) + 1;
                        break;
                }
            }

            // 1. repair/attack/claim/claimupgrade/globalcarry: 每个任务对应一个 creep
            // 注意：harvest/upgrade 已由策略系统接管，此处不再生成 spawn 需求
            const longTermTasks = ['repair', 'attack', 'claim', 'claimupgrade', 'globalcarry'];
            for (const taskType of longTermTasks) {
                const needed = (taskCounts[taskType] || 0) - (validCreeps[taskType] || 0);
                for (let i = 0; i < needed; i++) {
                    needs.push({ type: taskType, priority: this._getTaskPriority(taskType) });
                }
            }
            
            // 2. build: 计算建筑工地需要的能量，每 5K 对应一个 build 任务，每个任务对应一个 creep
            const buildTasks = tasks.filter(t => t.type === 'build');
            let buildCreepsNeeded = this._calculateBuildCreeps(room, buildTasks.length);

            // 【新增】考虑等待中的 spawn 任务（已在上方统计）
            for (const task of waitingSpawnTasks) {
                const model = task.data.model;
                if (model === 'CommonI') {
                    buildCreepsNeeded++;
                }
            }

            const currentBuildCreeps = validCreeps['build'] || 0;
            const needed = Math.max(0, buildCreepsNeeded - currentBuildCreeps);
            for (let i = 0; i < needed; i++) {
                needs.push({ type: 'build', priority: this._getTaskPriority('build') });
            }
            
            // 3. police: 如果有 police 任务，需要 3 个 creep（硬编码）
            const policeTasks = tasks.filter(t => t.type === 'police');
            if (policeTasks.length > 0) {
                const policeNeeded = 3 - (validCreeps['police'] || 0);
                for (let i = 0; i < policeNeeded; i++) {
                    needs.push({ type: 'police', priority: this._getTaskPriority('police') });
                }
            }
            
            // 4. carry: 每三个任务生成一个 creep
            const carryTasks = tasks.filter(t => t.type === 'carry');
            if (carryTasks.length > 0) {
                const carryCreepsNeeded = Math.ceil(carryTasks.length / 3);
                const currentCarryCreeps = validCreeps['carry'] || 0;
                const needed = Math.max(0, carryCreepsNeeded - currentCarryCreeps);
                for (let i = 0; i < needed; i++) {
                    needs.push({ type: 'carry', priority: this._getTaskPriority('carry') });
                }
            }
            
            // 5. 忽略 sign 和 boost 任务
            // sign: 不生成 creep
            // boost: 临时任务，不为此生成 creep
            
            // 按优先级排序
            needs.sort((a, b) => a.priority - b.priority);
            
            if (needs.length > 0) {
                creepNeeds[roomName] = needs;
            }
        }
        
        return creepNeeds;
    },

    /**
     * 统计有效 creep
     * @private
     */
    _countValidCreeps: function(roomName) {
        const validCreeps = {};
        const room = Game.rooms[roomName];
        if (!room) return validCreeps;

        // 1. 统计当前房间内的有效 creep（仅遍历本房间，不全局扫描）
        const roomCreeps = room.find(FIND_MY_CREEPS);
        const longTermTasks = ['attack', 'police', 'globalcarry', 'claim', 'claimupgrade', 'claimbuild'];

        for (const creep of roomCreeps) {
            const taskType = creep.memory.taskType;
            const model = creep.memory.model;

            // 长期任务的 creep 不视为可调度资源（harvest/upgrade 除外，需计入防重复生成）
            if (longTermTasks.indexOf(taskType) !== -1) continue;

            if (!taskType || taskType === 'unibot') {
                // 没接任务的 creep，根据型号分配潜在能力（每种型号只计1个，不重复计数）
                if (model === 'CommonI') {
                    validCreeps['harvest'] = (validCreeps['harvest'] || 0) + 1;
                } else if (model === 'CarrierI') {
                    validCreeps['carry'] = (validCreeps['carry'] || 0) + 1;
                } else if (model === 'AttackerI') {
                    validCreeps['police'] = (validCreeps['police'] || 0) + 1;
                } else if (model === 'ClaimerI') {
                    validCreeps['claim'] = (validCreeps['claim'] || 0) + 1;
                }
            } else {
                // 接了任务的 creep，按任务类型统计
                validCreeps[taskType] = (validCreeps[taskType] || 0) + 1;
            }
        }
        
        // 2. 统计正在等待的 spawn 任务，避免重复生成
        const existingSpawnTasks = modules.taskboard.getTasks(roomName, 'Buildings');
        const waitingSpawnTasks = existingSpawnTasks.filter(t => t.type === 'spawn' && !t.takenBy);
        
        for (const task of waitingSpawnTasks) {
            const model = task.data.model;
            switch (model) {
                case 'AttackerI':
                    validCreeps['police'] = (validCreeps['police'] || 0) + 1;
                    break;
                case 'CarrierI':
                    validCreeps['carry'] = (validCreeps['carry'] || 0) + 1;
                    break;
                case 'ClaimerI':
                    validCreeps['claim'] = (validCreeps['claim'] || 0) + 1;
                    break;
                case 'CommonI':
                    validCreeps['harvest'] = (validCreeps['harvest'] || 0) + 1;
                    break;
            }
        }
        
        return validCreeps;
    },

    /**
     * 计算 build 任务需要的 creep 数量
     * @private
     */
    _calculateBuildCreeps: function(room, buildTaskCount) {
        const siteIds = modules.search.get.constructionSites(room.name);
        if (!siteIds || siteIds.length === 0) return 0;

        let totalEnergy = 0;
        for (const siteId of siteIds) {
            const site = Game.getObjectById(siteId);
            if (site) {
                totalEnergy += site.progressTotal;
            }
        }

        // 每 5K 对应一个 build 任务，每个任务对应一个 creep
        let buildCreepsNeeded = Math.ceil(totalEnergy / 5000);

        // 【新增】低等级房间多分配 build creep（RCL ≤ 3 加一倍，RCL 4 以上正常）
        if (room.controller && room.controller.level <= 3) {
            buildCreepsNeeded = Math.ceil(buildCreepsNeeded * 2);
        }

        return buildCreepsNeeded;
    },

    /**
     * 获取任务优先级
     * @private
     */
    _getTaskPriority: function(taskType) {
        const priorityMap = {
            'attack': 1,
            'police': 2,
            'harvest': 3,
            'repair': 4,
            'build': 5,
            'upgrade': 6,
            'carry': 7,
            'claim': 8,
            'claimupgrade': 9,
            'claimbuild': 10,
            'globalcarry': 11,
            'reserve': 12
        };
        return priorityMap[taskType] || 99;
    },

    /**
     * 为任务生成 creep
     * @private
     */
    _spawnCreepForTask: function(room, need) {
        const taskType = need.type;
        
        // 根据 taskType 确定型号
        let model = 'CommonI';
        
        switch (taskType) {
            case 'attack':
                model = 'AttackerI';
                break;
            case 'police':
                model = 'AttackerI';
                break;
            case 'carry':
            case 'globalcarry':
                model = 'CarrierI';
                break;
            case 'claim':
            case 'reserve':
                model = 'ClaimerI';
                break;
            case 'claimupgrade':
            case 'claimbuild':
                model = 'CommonI';
                break;
            default:
                model = 'CommonI';
                break;
        }
        
        // 计算能量，确保不低于最小需求
        let energy = Math.floor(room.energyAvailable * 0.8);
        // 确保能量至少满足最小配置需求
        const minEnergyRequirements = {
            'CommonI': 200,
            'CarrierI': 100,
            'AttackerI': 600,
            'ClaimerI': 650
        };
        energy = Math.max(energy, minEnergyRequirements[model] || 200);
        
        // 发布 spawn 任务（4参数版本：roomName, model, priority, data）
        modules.taskboard.buildings.spawn(room.name, model, need.priority, { energy: energy, model: model });
    },

    /**
     * 处理终端能量运输任务
     * @private
     */
    _handleTerminalEnergyTransport: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            const terminalId = modules.search.get.structure(roomName, 'terminal');
            const terminal = terminalId ? Game.getObjectById(terminalId) : null;
            if (!terminal) continue;

            const storageId = modules.search.get.structure(roomName, 'storage');
            const storage = storageId ? Game.getObjectById(storageId) : null;

            if (!storage) continue;

            // 检查是否已有能量运输任务
            const tasks = modules.taskboard.getTasks(roomName, 'Creeps');
            const hasEnergyTransport = tasks.some(t => t.type === 'carry' && t.data.toId === terminal.id);

            // 如果存储内能量 > 80000 且没有能量运输任务，建立 carry 任务
            if (storage.store[RESOURCE_ENERGY] > 80000 && !hasEnergyTransport) {
                const sourceId = storage.id;
                const toId = terminal.id;
                modules.taskboard.creeps.carry(roomName, sourceId, toId, RESOURCE_ENERGY);
            }
        }
    },

    /**
     * 处理工厂生产流程
     * @private
     */
    _handleFactoryProduction: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            const factoryId = modules.search.get.structure(roomName, 'factory');
            const factory = factoryId ? Game.getObjectById(factoryId) : null;
            if (!factory) continue;

            const terminalId = modules.search.get.structure(roomName, 'terminal');
            const terminal = terminalId ? Game.getObjectById(terminalId) : null;
            if (!terminal) continue;

            const storageId = modules.search.get.structure(roomName, 'storage');
            const storage = storageId ? Game.getObjectById(storageId) : null;
            if (!storage) continue;
            
            // 检查存储内的矿产
            // 检查 LAB 反应是否活跃，如果是则不使用 O 或 U
            const labReactionActive = Memory.rooms[roomName] && Memory.rooms[roomName].labReactionActive;
            
            const mineralTypes = ['O', 'L', 'K', 'Z', 'U', 'H', 'X'];
            let bestMineral = null;
            let maxAmount = 0;
            
            for (const mineralType of mineralTypes) {
                // 如果 LAB 反应活跃，跳过 O 和 U
                if (labReactionActive && (mineralType === 'O' || mineralType === 'U')) continue;
                
                const amount = storage.store[mineralType] || 0;
                if (amount > 10000 && amount > maxAmount) {
                    maxAmount = amount;
                    bestMineral = mineralType;
                }
            }
            
            // 如果有矿产 > 10000 且能量 > 80000，建立生产流程
            if (bestMineral && storage.store[RESOURCE_ENERGY] > 80000) {
                this._setupFactoryProduction(roomName, storage, factory, terminal, bestMineral);
            }
        }
    },

    /**
     * 设置工厂生产流程
     * @private
     */
    _setupFactoryProduction: function(roomName, storage, factory, terminal, mineralType) {
        const tasks = modules.taskboard.getTasks(roomName, 'Creeps');
        const buildingTasks = modules.taskboard.getTasks(roomName, 'Buildings');
        
        // 检查是否已有相关的 carry 任务
        const hasEnergyCarry = tasks.some(t => t.type === 'carry' && t.data.toId === factory.id);
        const hasMineralCarry = tasks.some(t => t.type === 'carry' && t.data.toId === factory.id && t.data.resourceType === mineralType);
        
        // 检查是否已有 produce 任务
        const hasProduce = buildingTasks.some(t => t.type === 'produce' && t.data.resourceType === this._getFactoryProduct(mineralType));

        // 如果没有相关任务，建立两个 carry 任务和 produce 任务
        if (!hasEnergyCarry && !hasMineralCarry && !hasProduce) {
            // 运能量到工厂
            modules.taskboard.creeps.carry(roomName, storage.id, factory.id, RESOURCE_ENERGY);
            // 运矿产到工厂
            modules.taskboard.creeps.carry(roomName, storage.id, factory.id, mineralType);
            // 发布 produce 任务
            const productType = this._getFactoryProduct(mineralType);
            modules.taskboard.buildings.produce(roomName, productType);

            // 设置工厂产物运输任务
            this._setupFactoryProductTransport(roomName, factory, terminal, productType);
        }

        // 检查工厂产物是否达到 5000
        const productType = this._getFactoryProduct(mineralType);
        if (factory.store[productType] >= 5000) {
            // 发布 carry 任务将工厂产物运到终端
            const hasProductCarry = tasks.some(t => t.type === 'carry' && t.data.fromId === factory.id && t.data.toId === terminal.id);
            if (!hasProductCarry) {
                modules.taskboard.creeps.carry(roomName, factory.id, terminal.id, productType);
            }

            // 发布 marketSell 任务
            const hasMarketSell = buildingTasks.some(t => t.type === 'marketSell' && t.data.resourceType === productType);
            if (!hasMarketSell) {
                const sellAmount = Math.floor(factory.store[productType] / 2);
                modules.taskboard.buildings.marketSell(roomName, productType, sellAmount, false);
            }
        }

        // 检测 LAB 状态，如果有 LAB 满了 UO 且能量满了，发布 boost WORK 任务
        this._checkAndPublishBoostTask(roomName, buildingTasks);
    },

    /**
     * 检测 LAB 状态并发布 boost 任务
     * 如果某个反应 LAB 有 UO 且是满的，能量也是满的，发布 boost WORK 任务
     * @private
     */
    _checkAndPublishBoostTask: function(roomName, buildingTasks) {
        // 获取 LAB 组
        const labGroups = modules.search.fetch.labGroup(roomName);
        if (!labGroups || labGroups.length === 0) return;

        // 检查第一组 LAB（UO 反应组）
        const firstGroup = labGroups[0];
        if (!firstGroup.outputLabs || firstGroup.outputLabs.length === 0) return;

        for (const outputLab of firstGroup.outputLabs) {
            if (!outputLab) continue;

            // 检查 LAB 是否有 UO 且是满的（容量 3000）
            const uoAmount = outputLab.store['UO'] || 0;
            const energyAmount = outputLab.store[RESOURCE_ENERGY] || 0;

            // UO 满了（>= 3000）且能量满了（>= 2000）
            if (uoAmount >= 3000 && energyAmount >= 2000) {
                // 检查是否已有 boost WORK 任务
                const hasBoostWork = buildingTasks.some(t => t.type === 'boost' && t.data && t.data.bodyPart === 'work');
                if (!hasBoostWork) {
                    // 发布 boost WORK 任务
                    modules.taskboard.buildings.boost(roomName, 'work');
                }
            }
        }
    },

    /**
     * 获取工厂产物类型
     * @private
     */
    _getFactoryProduct: function(mineralType) {
        const productMap = {
            'O': 'oxidant',
            'L': 'utrium_bar',
            'K': 'lemergium_bar',
            'Z': 'zynthium_bar',
            'U': 'reductant',
            'H': 'hydrogen_bar',
            'X': 'composite_bar'
        };
        return productMap[mineralType] || 'composite_bar';
    },

    /**
     * 设置工厂产物运输任务
     * @private
     */
    _setupFactoryProductTransport: function(roomName, factory, terminal, productType) {
        // 这个方法在 _setupFactoryProduction 中已经处理了
        // 保留为未来扩展使用
    },

    /**
     * 处理 LAB 反应任务
     * 逻辑：
     * 1. 如果存储里有 U 或 O 的任意一种，且数量 > 10000，且信用点 > 1000000
     *    尝试购买另外一种，数量 10000，运到存储
     * 2. 如果存储里 U 和 O 都有，且数量均 > 10000
     *    使用第一组 LAB 进行 UO 反应，将 O 和 U 运到原料 LAB，能量运到反应 LAB
     * 3. 对于 9x9 房间，使用第二组 LAB 进行其他反应
     *    检查存储中其他可反应的资源对，运到第二组 LAB，产物运回存储
     * @private
     */
    _handleLabReaction: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            const storageId = modules.search.get.structure(roomName, 'storage');
            const storage = storageId ? Game.getObjectById(storageId) : null;
            if (!storage) continue;

            const terminalId = modules.search.get.structure(roomName, 'terminal');
            const terminal = terminalId ? Game.getObjectById(terminalId) : null;

            const labIds = modules.search.get.structure(roomName, 'labs');
            if (!labIds || labIds.length === 0) continue;

            // 使用 API 查找 LAB 组（返回数组）
            const labGroups = modules.search.fetch.labGroup(roomName);
            if (!labGroups || labGroups.length === 0) continue;

            // 获取现有任务
            const tasks = modules.taskboard.getTasks(roomName, 'Creeps');
            const buildingTasks = modules.taskboard.getTasks(roomName, 'Buildings');

            // ========== 第一组 LAB：UO 反应 ==========
            this._handleUOLabReaction(roomName, room, storage, terminal, labGroups[0], tasks, buildingTasks);

            // ========== 第二组 LAB：其他反应（仅 9x9 房间） ==========
            if (labGroups.length >= 2) {
                this._handleSecondaryLabReaction(roomName, room, storage, labGroups[1], tasks);
            }
        }
    },

    /**
     * 处理第一组 LAB 的 UO 反应
     * @private
     */
    _handleUOLabReaction: function(roomName, room, storage, terminal, firstGroup, tasks, buildingTasks) {
        // 检查存储中的 U 和 O 数量
        const uAmount = storage.store['U'] || 0;
        const oAmount = storage.store['O'] || 0;

        // 检查是否已有 LAB 反应相关的 carry 任务
        const hasLabCarryTask = tasks.some(t => t.type === 'carry' && t.data && t.data.isLabReaction);

        // 步骤 1: 如果只有 U 或 O 中的一种，且数量 > 10000，且信用点 > 1000000，购买另一种
        if (!hasLabCarryTask && terminal) {
            if (uAmount > 10000 && oAmount < 10000 && Game.market.credits > 1000000) {
                // 有 U 缺 O，购买 O
                const hasBuyTask = buildingTasks.some(t => t.type === 'marketBuy' && t.data.resourceType === 'O');
                const hasTransportTask = tasks.some(t => t.type === 'globalcarry' && t.data.resourceType === 'O');
                if (!hasBuyTask && !hasTransportTask) {
                    modules.taskboard.buildings.marketBuy(roomName, 'O', 10000);
                }
            } else if (oAmount > 10000 && uAmount < 10000 && Game.market.credits > 1000000) {
                // 有 O 缺 U，购买 U
                const hasBuyTask = buildingTasks.some(t => t.type === 'marketBuy' && t.data.resourceType === 'U');
                const hasTransportTask = tasks.some(t => t.type === 'globalcarry' && t.data.resourceType === 'U');
                if (!hasBuyTask && !hasTransportTask) {
                    modules.taskboard.buildings.marketBuy(roomName, 'U', 10000);
                }
            }
        }

        // 步骤 2: 如果 U 和 O 都有，且数量均 > 10000，建立 LAB 反应任务
        if (uAmount >= 10000 && oAmount >= 10000) {
            const inputLab1 = firstGroup.inputLabs[0];
            const inputLab2 = firstGroup.inputLabs[1];
            const outputLab = firstGroup.outputLabs[0];

            if (!inputLab1 || !inputLab2 || !outputLab) return;

            // 检查是否已有 LAB 反应相关的 carry 任务
            const hasOTransport = tasks.some(t => t.type === 'carry' && t.data.toId === inputLab1.id && t.data.resourceType === 'O');
            const hasUTransport = tasks.some(t => t.type === 'carry' && t.data.toId === inputLab2.id && t.data.resourceType === 'U');
            const hasEnergyTransport = tasks.some(t => t.type === 'carry' && t.data.toId === outputLab.id && t.data.resourceType === RESOURCE_ENERGY);

            // 建立三个 carry 任务
            if (!hasOTransport) {
                modules.taskboard.creeps.carry(roomName, storage.id, inputLab1.id, 'O');
                // 标记为 LAB 反应任务
                const newTasks = modules.taskboard.getTasks(roomName, 'Creeps');
                const newTask = newTasks[newTasks.length - 1];
                if (newTask) newTask.data.isLabReaction = true;
            }
            if (!hasUTransport) {
                modules.taskboard.creeps.carry(roomName, storage.id, inputLab2.id, 'U');
                const newTasks = modules.taskboard.getTasks(roomName, 'Creeps');
                const newTask = newTasks[newTasks.length - 1];
                if (newTask) newTask.data.isLabReaction = true;
            }
            if (!hasEnergyTransport) {
                modules.taskboard.creeps.carry(roomName, storage.id, outputLab.id, RESOURCE_ENERGY);
                const newTasks = modules.taskboard.getTasks(roomName, 'Creeps');
                const newTask = newTasks[newTasks.length - 1];
                if (newTask) newTask.data.isLabReaction = true;
            }

            // 设置标志，防止工厂使用 O 或 U
            if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
            Memory.rooms[roomName].labReactionActive = true;
        } else {
            // 清理标志
            if (Memory.rooms[roomName]) {
                Memory.rooms[roomName].labReactionActive = false;
            }
        }
    },

    /**
     * 处理第二组 LAB 的其他反应
     * 检查存储中可反应的资源对，不购买，没有就算了
     * @private
     */
    _handleSecondaryLabReaction: function(roomName, room, storage, secondGroup, tasks) {
        const inputLab1 = secondGroup.inputLabs[0];
        const inputLab2 = secondGroup.inputLabs[1];
        const outputLab = secondGroup.outputLabs[0];

        if (!inputLab1 || !inputLab2 || !outputLab) return;

        // 定义可反应的资源对（基础化合物）
        const reactionPairs = [
            { res1: 'H', res2: 'O', product: 'OH' },      // 氢氧化物
            { res1: 'H', res2: 'L', product: 'LH' },      // 液态化合物
            { res1: 'H', res2: 'U', product: 'UH' },      // 氢化铀
            { res1: 'H', res2: 'K', product: 'KH' },      // 氢化钾
            { res1: 'H', res2: 'Z', product: 'ZH' },      // 氢化锆
            { res1: 'O', res2: 'L', product: 'LO' },      // 氧化锂
            { res1: 'O', res2: 'U', product: 'UO' },      // 氧化铀
            { res1: 'O', res2: 'K', product: 'KO' },      // 氧化钾
            { res1: 'O', res2: 'Z', product: 'ZO' },      // 氧化锆
            { res1: 'Z', res2: 'K', product: 'ZK' },      // 锆钾化合物
            { res1: 'Z', res2: 'L', product: 'ZL' },      // 锆锂化合物
            { res1: 'Z', res2: 'U', product: 'ZU' },      // 锆铀化合物
            { res1: 'L', res2: 'K', product: 'LK' },      // 锂钾化合物
            { res1: 'L', res2: 'U', product: 'LU' },      // 锂铀化合物
            { res1: 'K', res2: 'U', product: 'KU' }       // 钾铀化合物
        ];

        // 查找存储中可反应的资源对
        let bestPair = null;
        let maxMinAmount = 0;

        for (const pair of reactionPairs) {
            const amount1 = storage.store[pair.res1] || 0;
            const amount2 = storage.store[pair.res2] || 0;
            const minAmount = Math.min(amount1, amount2);

            // 两种资源都大于 5000 才能进行反应
            if (amount1 >= 5000 && amount2 >= 5000 && minAmount > maxMinAmount) {
                maxMinAmount = minAmount;
                bestPair = pair;
            }
        }

        if (!bestPair) return;

        // 检查是否已有相关的 carry 任务
        const hasRes1Transport = tasks.some(t => t.type === 'carry' && t.data.toId === inputLab1.id && t.data.resourceType === bestPair.res1);
        const hasRes2Transport = tasks.some(t => t.type === 'carry' && t.data.toId === inputLab2.id && t.data.resourceType === bestPair.res2);
        const hasProductTransport = tasks.some(t => t.type === 'carry' && t.data.fromId === outputLab.id);

        // 建立原料运输任务（不运能量，因为不需要 boost）
        if (!hasRes1Transport) {
            modules.taskboard.creeps.carry(roomName, storage.id, inputLab1.id, bestPair.res1);
        }
        if (!hasRes2Transport) {
            modules.taskboard.creeps.carry(roomName, storage.id, inputLab2.id, bestPair.res2);
        }

        // 检查产物数量，如果 >= 5000，建立运回存储的任务
        const productAmount = outputLab.store[bestPair.product] || 0;
        if (productAmount >= 5000 && !hasProductTransport) {
            modules.taskboard.creeps.carry(roomName, outputLab.id, storage.id, bestPair.product);
        }
    }
};

module.exports = APTaskhandler;