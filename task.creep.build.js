/**
 * task.creep.build.js
 * 建造任务执行逻辑。
 * 参数：targetId (能量来源建筑 ID 或 Source ID)
 */

const modules = require('module.references');
const taskHelper = require('lib.AP.taskHelper');

const taskBuild = {
    /**
     * @param {Creep} creep 
     */
    run: function(creep) {
        const data = creep.memory.taskData;
        if (!data) return;

        // autoAssign: 动态分配能量来源
        if (data.autoAssign) {
            const source = this._findEnergySource(creep);
            if (source) {
                creep.memory.taskData = { targetId: source.id };
            } else {
                // 【新增】如果没有可用能量来源，尝试使用默认 source
                const sources = creep.room.find(FIND_SOURCES);
                if (sources.length > 0 && sources[0].energy > 0) {
                    console.log("[Build] ⚠️  autoAssign 失败，使用默认 source: " + sources[0].id);
                    creep.memory.taskData = { targetId: sources[0].id };
                } else {
                    // 【新增】如果没有 source，清理任务并返回
                    console.log("[Build] ❌ 房间没有可用能量来源，清理任务: " + creep.name);
                    taskHelper.completeTask(creep);
                    return;
                }
            }
            return this.run(creep);
        }

        if (!data.targetId) {
            console.log("[Build] ❌ 任务数据不完整: targetId=" + data.targetId + " (Creep: " + creep.name + ")");
            taskHelper.completeTask(creep);
            return;
        }

        // 状态切换
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄 取能');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🔨 建造');
        }

        if (creep.memory.working) {
            // 执行建造
            const target = this._getBestConstructionSite(creep);
            if (target) {
                if (creep.build(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else {
                // 如果没有工地了，说明建造任务完全完成
                taskHelper.completeTask(creep);
            }
        } else {
            // 从指定目标获取能量
            this._getEnergy(creep, data.targetId);
        }
    },

    /**
     * 获取能量逻辑
     * @private
     */
    _getEnergy: function(creep, targetId) {
        const target = Game.getObjectById(targetId);
        if (target) {
            let result;
            if (target.store) {
                result = creep.withdraw(target, RESOURCE_ENERGY);
            } else {
                result = creep.harvest(target);
            }

            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        } else {
            // 找不到目标，按照优先级寻找其他能量源
            this._findAlternativeEnergySource(creep);
        }
    },

    /**
     * 寻找替代能量源
     * @private
     * @param {Creep} creep - 执行任务的 creep
     */
    _findAlternativeEnergySource: function(creep) {
        const roomName = creep.room.name;
        
        // 1. 存储 (Storage)
        const storage = creep.room.storage;
        if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }
        
        // 2. LINK
        const links = modules.search.get.links(roomName);
        for (const linkId of links) {
            const link = Game.getObjectById(linkId);
            if (link && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.withdraw(link, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(link, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                return;
            }
        }
        
        // 3. 容器 (Container)
        const containers = modules.search.get.containers(roomName);
        for (const containerId of containers) {
            const container = Game.getObjectById(containerId);
            if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                return;
            }
        }
        
        // 4. 地板（散落能量）
        const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 0
        });
        if (droppedEnergy.length > 0) {
            const closestEnergy = creep.pos.findClosestByPath(droppedEnergy);
            if (closestEnergy) {
                if (creep.pickup(closestEnergy) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(closestEnergy, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                return;
            }
        }
        
        // 5. 终端 (Terminal)
        const terminal = creep.room.terminal;
        if (terminal && terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.withdraw(terminal, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(terminal, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }
        
        // 6. 自己挖 (Source)
        const sources = modules.search.get.sources(roomName);
        if (sources.length > 0) {
            const closestSource = creep.pos.findClosestByPath(sources.map(id => Game.getObjectById(id)));
            if (closestSource) {
                if (creep.harvest(closestSource) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(closestSource, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
        }
    },

    /**
     * 寻找优先级最高的建筑工地
     * @private
     * @param {Creep} creep - 执行任务的 creep
     * @returns {ConstructionSite} 优先级最高的建筑工地
     */
    _getBestConstructionSite: function(creep) {
        const roomName = creep.room.name;
        const siteIds = modules.search.get.constructionSites(roomName);
        if (!siteIds || siteIds.length === 0) return null;
        
        // 建筑类型优先级
        const typePriority = {
            [STRUCTURE_SPAWN]: 500,
            [STRUCTURE_EXTENSION]: 450,
            [STRUCTURE_CONTAINER]: 400,
            [STRUCTURE_STORAGE]: 380,
            [STRUCTURE_LINK]: 370,
            [STRUCTURE_TOWER]: 350,
            [STRUCTURE_RAMPART]: 300,
            [STRUCTURE_WALL]: 250,
            [STRUCTURE_LAB]: 280,
            [STRUCTURE_TERMINAL]: 270,
            [STRUCTURE_FACTORY]: 260,
            [STRUCTURE_OBSERVER]: 240,
            [STRUCTURE_POWER_SPAWN]: 230,
            [STRUCTURE_NUKER]: 220,
            [STRUCTURE_EXTRACTOR]: 240,
            [STRUCTURE_ROAD]: 200,
            'default': 100
        };
        
        let bestSite = null;
        let bestScore = -Infinity;
        
        for (const siteId of siteIds) {
            const site = Game.getObjectById(siteId);
            if (!site) continue;
            
            // 计算优先级得分
            const priority = typePriority[site.structureType] || typePriority['default'];
            
            // 计算距离得分
            const distance = creep.pos.getRangeTo(site);
            const distanceScore = 1 / (distance + 1);
            
            // 计算进度得分（接近完成的优先）
            const progressScore = site.progress / site.progressTotal;
            
            // 总得分
            const totalScore = priority + (distanceScore * 100) + (progressScore * 50);
            
            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestSite = site;
            }
        }
        
        return bestSite;
    },

    /**
     * autoAssign: 动态查找能量来源
     * @private
     */
    _findEnergySource: function(creep) {
        const room = creep.room;
        const sources = room.find(FIND_SOURCES);
        for (const src of sources) { if (src.energy > 0) return src; }
        if (room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) return room.storage;
        const containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0 });
        if (containers.length > 0) return containers[0];
        return null;
    },

};

module.exports = taskBuild;
