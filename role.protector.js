// role.protector.js - 保护者（送能量+战斗+摆烂搬运）- 支持紧急模式
var roleProtector = {
    run: function(creep) {
        // === 每tick都运行 ===
        
        // === 检测紧急模式 ===
        const emergencyMode = Memory.harvesterEmergency;
        
        // === 紧急战斗：检测10格内敌人 ===
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS, {
            filter: function(hostile) {
                return creep.pos.getRangeTo(hostile) <= 10;
            }
        });

        if (hostiles.length > 0) {
            creep.say('⚔️');
            this._fastCombat(creep, hostiles);
            return;
        }

        // === 核心：给塔送能量 ===
        this._fastSupply(creep, emergencyMode);
    },

    // 极速战斗（保持不变）
    _fastCombat: function(creep, hostiles) {
        const target = creep.pos.findClosestByRange(hostiles);
        if (!target) return;

        const range = creep.pos.getRangeTo(target);
        
        if (creep.getActiveBodyparts(ATTACK) > 0 && range <= 1) {
            creep.attack(target);
        }
        
        if (range > 1) {
            creep.moveTo(target, {
                reusePath: 3,
                maxOps: 200,
                ignoreCreeps: false,
                visualizePathStyle: {stroke: '#ff0000'}
            });
        }
    },

    // 快速供能 + 摆烂搬运（增加紧急模式参数）
    _fastSupply: function(creep, emergencyMode) {
        // 1. 找缺能量的塔（只要有空间就去送）
        const towers = creep.room.find(FIND_MY_STRUCTURES, {
            filter: function(structure) {
                return structure.structureType === STRUCTURE_TOWER && 
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });

        // 塔需要能量：优先处理（任何模式下都优先）
        if (towers.length > 0) {
            if (creep.store[RESOURCE_ENERGY] === 0) {
                this._fastGetEnergy(creep);
            } else {
                creep.say('⚡');
                const closestTower = creep.pos.findClosestByRange(towers);
                if (closestTower) {
                    if (creep.transfer(closestTower, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        // 快速冲锋模式
                        creep.moveTo(closestTower, {
                            reusePath: 2,
                            maxOps: 300,
                            ignoreCreeps: false,
                            visualizePathStyle: {stroke: '#ffff00'}
                        });
                    }
                }
            }
        } 
        // 塔满了：根据模式决定行为
        else {
            if (emergencyMode) {
                // 紧急模式下：不再搬运能量，守住Spawn附近
                this._emergencyHold(creep);
            } else {
                // 正常模式下：进入摆烂搬运模式
                this._lazyTransport(creep);
            }
        }
    },
    
    // 紧急模式下：守住Spawn附近，准备快速供能
    _emergencyHold: function(creep) {
        creep.say('🚨守');
        
        // 如果身上有能量，先看看是否有其他目标需要能量
        if (creep.store[RESOURCE_ENERGY] > 0) {
            // 检查Extension或Spawn是否需要能量（紧急模式下Spawn可能也缺）
            const spawnExtTargets = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType === STRUCTURE_SPAWN ||
                            structure.structureType === STRUCTURE_EXTENSION) &&
                           structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            
            if (spawnExtTargets.length > 0) {
                const closestTarget = creep.pos.findClosestByRange(spawnExtTargets);
                if (closestTarget) {
                    if (creep.transfer(closestTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(closestTarget, {
                            reusePath: 2,
                            maxOps: 300,
                            visualizePathStyle: {stroke: '#ff8800'}
                        });
                    }
                    return;
                }
            }
            
            // 如果没有其他目标需要能量，看看Storage是否需要能量
            const storages = creep.room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_STORAGE &&
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            
            if (storages.length > 0) {
                const storage = storages[0];
                if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, {
                        reusePath: 5,
                        maxOps: 300,
                        visualizePathStyle: {stroke: '#888888'}
                    });
                }
                return;
            }
        }
        
        // 身上没能量或所有目标都满了，待在Spawn附近
        this._guardSpawn(creep);
    },
    
    // 守卫Spawn：在Spawn附近巡逻待命
    _guardSpawn: function(creep) {
        const spawns = creep.room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        
        const spawn = spawns[0];
        
        // 如果不在Spawn附近，移动到Spawn旁边
        if (creep.pos.getRangeTo(spawn) > 2) {
            creep.moveTo(spawn, {
                reusePath: 10,
                maxOps: 200,
                range: 2,
                visualizePathStyle: {stroke: '#ff5555', opacity: 0.7}
            });
        } else {
            // 已经在Spawn附近，进行小范围巡逻
            if (Game.time % 30 === 0) {
                // 每隔30tick稍微移动一下位置，防止堵住路口
                const patrolPositions = [
                    {x: spawn.pos.x + 2, y: spawn.pos.y},
                    {x: spawn.pos.x - 2, y: spawn.pos.y},
                    {x: spawn.pos.x, y: spawn.pos.y + 2},
                    {x: spawn.pos.x, y: spawn.pos.y - 2}
                ];
                
                // 找到最近的可通行位置
                let targetPos = null;
                for (const pos of patrolPositions) {
                    if (creep.room.getTerrain().get(pos.x, pos.y) !== TERRAIN_MASK_WALL) {
                        targetPos = new RoomPosition(pos.x, pos.y, creep.room.name);
                        break;
                    }
                }
                
                if (targetPos) {
                    creep.moveTo(targetPos, {
                        reusePath: 0,
                        maxOps: 100,
                        range: 0,
                        visualizePathStyle: {stroke: '#ff5555', opacity: 0.3}
                    });
                }
            }
        }
        
        // 偶尔检查一下塔是否需要能量
        if (Game.time % 10 === 0) {
            const towersNeedingEnergy = creep.room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER &&
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            
            if (towersNeedingEnergy.length > 0 && creep.store[RESOURCE_ENERGY] === 0) {
                // 塔需要能量但身上没有，去获取能量
                this._fastGetEnergy(creep);
            }
        }
    },

    // 【修复】摆烂搬运模式：慢悠悠地将容器能量移到存储
    _lazyTransport: function(creep) {
        // 状态管理：如果没设置模式，根据是否有能量决定
        if (!creep.memory.lazyMode) {
            creep.memory.lazyMode = creep.store[RESOURCE_ENERGY] > 0 ? 'deliver' : 'pickup';
        }
        
        // 如果有能量，去存到存储
        if (creep.store[RESOURCE_ENERGY] > 0) {
            creep.memory.lazyMode = 'deliver';
            this._lazyDeliverToStorage(creep);
        } 
        // 没能量，去容器取
        else if (creep.memory.lazyMode === 'pickup') {
            this._lazyPickupEnergy(creep); // 改为更通用的方法名
        } 
        // 状态异常，重置
        else {
            creep.memory.lazyMode = null;
            this._guardTowerOrSpawn(creep); // 改为驻守而不是快速待命
        }
    },

    // 【新增】摆烂模式下获取能量（容器优先，然后LINK）
    _lazyPickupEnergy: function(creep) {
        creep.say('😴取');
        
        // 1. 优先找有足够能量的容器
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && 
                        s.store[RESOURCE_ENERGY] >= 100
        });
        
        if (containers.length > 0) {
            const closestContainer = creep.pos.findClosestByPath(containers, {
                ignoreCreeps: false,
                maxOps: 500
            });
            
            if (closestContainer) {
                return this._withdrawFromStructure(creep, closestContainer, '容器');
            }
        }
        
        // 2. 然后找有能量的LINK
        const links = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK && 
                        s.store[RESOURCE_ENERGY] > 0
        });
        
        if (links.length > 0) {
            const closestLink = creep.pos.findClosestByPath(links, {
                ignoreCreeps: false,
                maxOps: 500
            });
            
            if (closestLink) {
                return this._withdrawFromStructure(creep, closestLink, 'LINK');
            }
        }
        
        // 3. 都没有的话，直接驻守在最近的塔旁边
        creep.say('💤守塔');
        creep.memory.lazyMode = null; // 清除搬运模式
        this._guardTowerOrSpawn(creep);
    },
    
    // 【新增】从结构提取能量的通用方法
    _withdrawFromStructure: function(creep, structure, typeName) {
        const result = creep.withdraw(structure, RESOURCE_ENERGY);
        
        if (result === OK) {
            creep.say(`✅${typeName}`);
            return true;
        } else if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(structure, {
                reusePath: 8,
                maxOps: 400,
                ignoreCreeps: false,
                range: 1,
                visualizePathStyle: {stroke: '#aaaaaa', opacity: 0.5, lineStyle: 'dashed'}
            });
            return true;
        } else if (result === ERR_FULL) {
            // 容器突然满了？切换到待命
            creep.memory.lazyMode = 'deliver';
            return true;
        }
        
        return false;
    },

    // 【修复】摆烂：将能量存到存储
    _lazyDeliverToStorage: function(creep) {
        creep.say('😴存');
        
        const storages = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE
        });
        
        if (storages.length === 0) {
            // 没有存储，放弃搬运模式
            creep.memory.lazyMode = null;
            creep.say('❌无存储');
            this._guardTowerOrSpawn(creep);
            return;
        }
        
        const storage = storages[0]; // 通常只有一个storage
        const transferResult = creep.transfer(storage, RESOURCE_ENERGY);
        
        if (transferResult === ERR_NOT_IN_RANGE) {
            // 摆烂模式：慢悠悠地走
            const moveResult = creep.moveTo(storage, {
                reusePath: 10,       // 适度重用
                maxOps: 400,
                ignoreCreeps: false, // 关键：考虑其他creep
                range: 1,            // 停在旁边就行
                visualizePathStyle: {stroke: '#888888', opacity: 0.5}
            });
            
            // 处理移动失败
            if (moveResult !== OK && moveResult !== ERR_TIRED) {
                if (Game.time % 25 === 0) creep.say('🚧挡路');
            }
        } 
        else if (transferResult === OK) {
            // 成功存储，切换回取能模式
            creep.memory.lazyMode = 'pickup';
            creep.say('✅存好');
        } 
        else if (transferResult === ERR_FULL) {
            // 存储满了，进入长期待命
            creep.memory.lazyMode = null;
            creep.say('💤存满');
            this._guardTowerOrSpawn(creep);
        }
    },

    // 完整版的极速获取能量函数
    _fastGetEnergy: function(creep) {
        creep.say('🔋');
        
        // 1. 优先检查附近的墓碑（Tombstone）
        const tombstones = creep.room.find(FIND_TOMBSTONES, {
            filter: (tomb) => tomb.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        });
        
        if(tombstones.length > 0) {
            const closestTomb = creep.pos.findClosestByRange(tombstones);
            if(creep.withdraw(closestTomb, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(closestTomb, {
                    reusePath: 3,
                    maxOps: 300,
                    visualizePathStyle: {stroke: '#ff9900'}
                });
            }
            return;
        }
        
        // 2. 就近原则，先看身边有没有能量
        const droppedEnergyNearby = creep.room.lookForAtArea(
            LOOK_RESOURCES, 
            creep.pos.y-1, creep.pos.x-1, 
            creep.pos.y+1, creep.pos.x+1, 
            true
        ).filter(r => r.resource.resourceType === RESOURCE_ENERGY && r.resource.amount > 0);
        
        if (droppedEnergyNearby.length > 0) {
            const energy = droppedEnergyNearby[0].resource;
            if (creep.pickup(energy) === ERR_NOT_IN_RANGE) {
                creep.moveTo(energy, {reusePath: 0, maxOps: 100});
            }
            return;
        }
        
        // 3. 找最近的能量源（包括容器、storage、掉落物、LINK）
        let energySources = [];
        
        // 容器（有能量就去，不管多少）
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        });
        energySources = energySources.concat(containers);
        
        // LINK（有能量就去）
        const links = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK && s.store[RESOURCE_ENERGY] > 0
        });
        energySources = energySources.concat(links);
        
        // storage（如果有）
        const storages = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0
        });
        energySources = energySources.concat(storages);
        
        // 掉落物（50以上就去捡）
        const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= 50
        });
        energySources = energySources.concat(droppedEnergy);
        
        // 找到最近的
        if (energySources.length > 0) {
            const closest = creep.pos.findClosestByRange(energySources);
            if (closest) {
                // 容器/storage/LINK：withdraw
                if (closest.structureType === STRUCTURE_CONTAINER || 
                    closest.structureType === STRUCTURE_STORAGE ||
                    closest.structureType === STRUCTURE_LINK) {
                    if (creep.withdraw(closest, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(closest, {
                            reusePath: 3,
                            maxOps: 300,
                            ignoreCreeps: false,
                            visualizePathStyle: {stroke: '#00ffff'}
                        });
                    }
                }
                // 掉落物：pickup
                else {
                    if (creep.pickup(closest) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(closest, {
                            reusePath: 3,
                            maxOps: 300,
                            ignoreCreeps: false,
                            visualizePathStyle: {stroke: '#00ff00'}
                        });
                    }
                }
                return;
            }
        }
        
        // 4. 实在没找到能量，驻守在最近的塔旁边
        creep.say('💤守塔');
        this._guardTowerOrSpawn(creep);
    },

    // 【新增】驻守在最近的塔或Spawn旁边
    _guardTowerOrSpawn: function(creep) {
        creep.say('🛡️');
        
        // 优先找塔
        const towers = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });
        
        let target = null;
        
        if (towers.length > 0) {
            // 找最近的塔
            target = creep.pos.findClosestByRange(towers);
        } else {
            // 没有塔就找Spawn
            const spawns = creep.room.find(FIND_MY_SPAWNS);
            if (spawns.length > 0) {
                target = spawns[0];
            }
        }
        
        if (target) {
            // 如果在目标旁边，稍微随机移动防止堵路
            if (creep.pos.getRangeTo(target) <= 3) {
                if (Game.time % 30 === 0) {
                    const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
                    const randomDir = directions[Math.floor(Math.random() * directions.length)];
                    creep.move(randomDir);
                }
            } else {
                // 移动到目标旁边
                creep.moveTo(target, {
                    reusePath: 15,
                    maxOps: 200,
                    range: 3,
                    visualizePathStyle: {stroke: '#888888', opacity: 0.5}
                });
            }
        } else {
            // 没有塔也没有Spawn，待在原地
            if (Game.time % 20 === 0) {
                const directions = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
                const randomDir = directions[Math.floor(Math.random() * directions.length)];
                creep.move(randomDir);
            }
        }
    }
};

module.exports = roleProtector;