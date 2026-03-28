// role.player.js - Player角色模块（基于ES5语法，兼容Screeps服务端）

// 引入harvester模块
var roleHarvester = require('role.harvester');

var rolePlayer = {
    // 主运行函数
    run: function(creep) {
        // 检查是否有控制指令
        if (creep.memory.controlled === true) {
            this.runControlledMode(creep);
        } else {
            // 默认执行harvester逻辑
            roleHarvester.run(creep);
        }
    },
    
    // 控制模式逻辑
    runControlledMode: function(creep) {
        // 1. 执行拆除指令（最高优先级）
        if (creep.memory.destroyTarget) {
            this.executeDestroy(creep);
            return; // 拆除时先不执行其他操作
        }
        
        // 2. 自我治疗（如果有HEAL部件且受伤）
        this.selfHeal(creep);
        
        // 3. 治疗其他creep（远程治疗，5格范围内）
        this.healOtherCreeps(creep);
        
        // 4. 检查并执行移动指令
        if (creep.memory.gotoTarget || creep.memory.pathNodes) {
            this.executeGoto(creep);
            return; // 移动时先不执行其他操作
        }
        
        // 5. 检查并执行签名指令
        if (creep.memory.signTarget) {
            this.executeSign(creep);
            return; // 签名时先不执行其他操作
        }
        
        // 6. 检查并执行存储指令
        if (creep.memory.storageTarget) {
            this.executeStorage(creep);
            return; // 存储时先不执行其他操作
        }
        
        // 7. 空闲时自动挖掘周围资源（5格范围内）
        this.autoMineNearby(creep);
    },
    
    // 执行拆除指令
    executeDestroy: function(creep) {
        var destroyTarget = creep.memory.destroyTarget;
        
        // 检查是否具有拆除能力
        var hasWork = creep.getActiveBodyparts(WORK) > 0;
        var hasAttack = creep.getActiveBodyparts(ATTACK) > 0;
        
        if (!hasWork && !hasAttack) {
            creep.say('❌无拆除');
            console.log('Player ' + creep.name + ': 没有WORK或ATTACK部件，无法拆除建筑');
            delete creep.memory.destroyTarget;
            return;
        }
        
        // 查找目标建筑
        var target = Game.getObjectById(destroyTarget.targetId);
        
        // 如果找不到目标
        if (!target) {
            creep.say('❌目标消失');
            console.log('Player ' + creep.name + ': 找不到ID为 ' + destroyTarget.targetId + ' 的建筑');
            delete creep.memory.destroyTarget;
            return;
        }
        
        // 检查目标是否已被拆除或损坏
        if (target.hits === undefined || target.hits <= 0) {
            creep.say('✅已拆除');
            console.log('Player ' + creep.name + ': 目标建筑已被拆除');
            delete creep.memory.destroyTarget;
            return;
        }
        
        // 检查是否在同一房间
        if (creep.room.name !== target.room.name) {
            creep.say('🚶去房间');
            
            // 移动到目标房间
            var exit = creep.room.findExitTo(target.room.name);
            if (exit) {
                var exitPos = creep.pos.findClosestByRange(exit);
                if (exitPos) {
                    creep.moveTo(exitPos, {
                        visualizePathStyle: {stroke: '#ff0000'},
                        reusePath: 5
                    });
                }
            } else {
                creep.say('❌无出口');
                console.log('Player ' + creep.name + ': 无法到达目标建筑所在的房间');
                delete creep.memory.destroyTarget;
            }
            return;
        }
        
        // 检查是否在攻击范围内
        if (creep.pos.getRangeTo(target) > 1) {
            // 移动到建筑旁边
            var moveResult = creep.moveTo(target, {
                visualizePathStyle: {stroke: '#ff0000'},
                reusePath: 5,
                maxRooms: 1
            });
            
            if (moveResult === ERR_NO_PATH) {
                creep.say('❌无路径');
                console.log('Player ' + creep.name + ': 无法找到路径到目标建筑');
                delete creep.memory.destroyTarget;
            } else {
                creep.say('⚔️去拆除');
            }
            return;
        }
        
        // 在攻击范围内，开始拆除
        var destroyResult;
        
        // 优先使用WORK部件（伤害更高）
        if (hasWork) {
            destroyResult = creep.dismantle(target);
            if (destroyResult === OK) {
                creep.say('🔨拆除中');
                
                // 显示拆除进度
                var progress = Math.floor((1 - target.hits / target.hitsMax) * 100);
                creep.say(progress + '%');
                
                // 如果建筑已被完全拆除
                if (target.hits <= 0) {
                    creep.say('✅拆除完成');
                    console.log('Player ' + creep.name + ': 建筑拆除完成');
                    delete creep.memory.destroyTarget;
                }
            } else if (destroyResult === ERR_NOT_IN_RANGE) {
                creep.say('❌太远');
            } else {
                creep.say('❌错误' + destroyResult);
                console.log('Player ' + creep.name + ': 拆除错误 ' + destroyResult);
                delete creep.memory.destroyTarget;
            }
        } 
        // 如果没有WORK但有ATTACK
        else if (hasAttack) {
            destroyResult = creep.attack(target);
            if (destroyResult === OK) {
                creep.say('⚔️攻击中');
                
                // 显示攻击进度
                var progress = Math.floor((1 - target.hits / target.hitsMax) * 100);
                creep.say(progress + '%');
                
                // 如果建筑已被完全摧毁
                if (target.hits <= 0) {
                    creep.say('✅摧毁完成');
                    console.log('Player ' + creep.name + ': 建筑摧毁完成');
                    delete creep.memory.destroyTarget;
                }
            } else if (destroyResult === ERR_NOT_IN_RANGE) {
                creep.say('❌太远');
            } else {
                creep.say('❌错误' + destroyResult);
                console.log('Player ' + creep.name + ': 攻击错误 ' + destroyResult);
                delete creep.memory.destroyTarget;
            }
        }
    },
    
    // 自我治疗（近战治疗）
    selfHeal: function(creep) {
        if (creep.getActiveBodyparts(HEAL) > 0) {
            if (creep.hits < creep.hitsMax) {
                creep.heal(creep);
                creep.say('💊');
                return true;
            }
        }
        return false;
    },
    
    // 治疗其他creep（远程治疗，5格范围内）
    healOtherCreeps: function(creep) {
        if (creep.getActiveBodyparts(HEAL) > 0) {
            // 查找5格范围内受伤的友方creep
            var injuredCreeps = creep.room.find(FIND_MY_CREEPS, {
                filter: function(otherCreep) {
                    return otherCreep.hits < otherCreep.hitsMax &&
                           creep.pos.getRangeTo(otherCreep) <= 5 &&
                           otherCreep.id !== creep.id;
                }
            });
            
            if (injuredCreeps.length > 0) {
                var target = injuredCreeps[0];
                
                // 远程治疗
                if (creep.pos.getRangeTo(target) > 1) {
                    var healResult = creep.rangedHeal(target);
                    if (healResult === OK) {
                        creep.say('🚑远');
                        
                        // 如果目标未满血，跟随
                        if (target.hits < target.hitsMax) {
                            creep.moveTo(target, {
                                visualizePathStyle: {stroke: '#00ff00'},
                                reusePath: 5,
                                maxRooms: 1
                            });
                        }
                    }
                } else {
                    // 近战治疗
                    creep.heal(target);
                    creep.say('💊近');
                }
                return true;
            }
        }
        return false;
    },
    
    // 执行移动指令（支持路径节点）
    executeGoto: function(creep) {
        // 优先处理路径节点
        if (creep.memory.pathNodes && creep.memory.pathNodes.length > 0) {
            this.executePathNodes(creep);
            return;
        }
        
        // 处理单个目标
        var target = creep.memory.gotoTarget;
        if (!target || !target.roomName || target.x === undefined || target.y === undefined) {
            return;
        }
        
        // 检查是否已在目标房间
        if (creep.room.name !== target.roomName) {
            // 移动到目标房间
            var exit = creep.room.findExitTo(target.roomName);
            if (exit) {
                var exitPos = creep.pos.findClosestByRange(exit);
                if (exitPos) {
                    creep.moveTo(exitPos, {
                        visualizePathStyle: {stroke: '#ff00ff'},
                        reusePath: 5
                    });
                }
            } else {
                console.log('Player ' + creep.name + ': 找不到到房间 ' + target.roomName + ' 的出口');
                delete creep.memory.gotoTarget;
            }
            return;
        }
        
        // 创建目标位置对象
        var targetPos = new RoomPosition(target.x, target.y, target.roomName);
        
        // 检查是否已到达
        if (creep.pos.isNearTo(targetPos)) {
            creep.say('✅到达');
            delete creep.memory.gotoTarget;
            return;
        }
        
        // 移动到目标位置
        var moveResult = creep.moveTo(targetPos, {
            visualizePathStyle: {stroke: '#ff00ff'},
            reusePath: 5,
            maxRooms: 1
        });
        
        // 检查移动结果
        if (moveResult === ERR_NO_PATH) {
            console.log('Player ' + creep.name + ': 无法找到路径到目标位置');
            delete creep.memory.gotoTarget;
        } else if (moveResult === ERR_INVALID_TARGET) {
            console.log('Player ' + creep.name + ': 无效的目标位置');
            delete creep.memory.gotoTarget;
        } else {
            creep.say('🚶移动');
        }
    },
    
    // 执行路径节点移动
    executePathNodes: function(creep) {
        var pathNodes = creep.memory.pathNodes;
        var currentNodeIndex = creep.memory.currentNodeIndex || 0;
        
        // 检查是否完成所有节点
        if (currentNodeIndex >= pathNodes.length) {
            creep.say('✅完成');
            delete creep.memory.pathNodes;
            delete creep.memory.currentNodeIndex;
            return;
        }
        
        var currentNode = pathNodes[currentNodeIndex];
        
        // 检查是否到达当前节点
        if (creep.room.name === currentNode.roomName) {
            // 到达节点房间，进入下一个节点
            creep.memory.currentNodeIndex = currentNodeIndex + 1;
            
            // 显示节点完成
            creep.say('✓' + (currentNodeIndex + 1));
            
            // 如果是最后一个节点，移动到最终坐标
            if (currentNodeIndex + 1 >= pathNodes.length) {
                // 如果有最终坐标，设置为目标
                if (currentNode.x !== undefined && currentNode.y !== undefined) {
                    creep.memory.gotoTarget = {
                        roomName: currentNode.roomName,
                        x: currentNode.x,
                        y: currentNode.y
                    };
                    // 清除路径节点
                    delete creep.memory.pathNodes;
                    delete creep.memory.currentNodeIndex;
                } else {
                    // 没有最终坐标，直接清除节点
                    delete creep.memory.pathNodes;
                    delete creep.memory.currentNodeIndex;
                }
            }
            return;
        }
        
        // 移动到当前节点房间
        var exit = creep.room.findExitTo(currentNode.roomName);
        if (exit) {
            var exitPos = creep.pos.findClosestByRange(exit);
            if (exitPos) {
                creep.moveTo(exitPos, {
                    visualizePathStyle: {stroke: '#ff5500'},
                    reusePath: 5
                });
                creep.say('→' + (currentNodeIndex + 1));
            } else {
                console.log('Player ' + creep.name + ': 无法找到到房间 ' + currentNode.roomName + ' 的出口位置');
                delete creep.memory.pathNodes;
                delete creep.memory.currentNodeIndex;
            }
        } else {
            console.log('Player ' + creep.name + ': 找不到到房间 ' + currentNode.roomName + ' 的出口');
            delete creep.memory.pathNodes;
            delete creep.memory.currentNodeIndex;
        }
    },
    
    // 自动挖掘周围5格内的资源
    autoMineNearby: function(creep) {
        // 检查是否有WORK部件
        if (creep.getActiveBodyparts(WORK) === 0) {
            creep.say('无WORK');
            return;
        }
        
        // 检查CARRY是否已满
        if (creep.store.getFreeCapacity() === 0) {
            creep.say('🈵满');
            return;
        }
        
        // 查找周围5格内的能量源
        var energySources = creep.pos.findInRange(FIND_SOURCES, 5);
        if (energySources.length > 0) {
            var source = energySources[0];
            var harvestResult = creep.harvest(source);
            
            if (harvestResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {
                    visualizePathStyle: {stroke: '#ffff00'},
                    reusePath: 5
                });
                creep.say('⚡能量');
            } else if (harvestResult === OK) {
                creep.say('⛏️采能');
            }
            return;
        }
        
        // 查找周围5格内的deposit
        if (typeof FIND_DEPOSITS !== 'undefined') {
            var deposits = creep.pos.findInRange(FIND_DEPOSITS, 5);
            if (deposits.length > 0) {
                var deposit = deposits[0];
                var harvestResult = creep.harvest(deposit);
                
                if (harvestResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(deposit, {
                        visualizePathStyle: {stroke: '#ff8800'},
                        reusePath: 5
                    });
                    creep.say('💎矿物');
                } else if (harvestResult === OK) {
                    creep.say('⛏️采矿');
                }
                return;
            }
        }
        
        // 没有找到可挖掘的资源
        creep.say('💤待机');
    },
    
    // 执行签名指令
    executeSign: function(creep) {
        var signTarget = creep.memory.signTarget;
        
        if (signTarget && signTarget.roomName && signTarget.text) {
            // 检查是否在目标房间
            if (creep.room.name !== signTarget.roomName) {
                // 移动到目标房间
                var exit = creep.room.findExitTo(signTarget.roomName);
                if (exit) {
                    var exitPos = creep.pos.findClosestByRange(exit);
                    if (exitPos) {
                        creep.moveTo(exitPos, {
                            visualizePathStyle: {stroke: '#00ffff'},
                            reusePath: 5
                        });
                        creep.say('🚶去房间');
                    }
                } else {
                    console.log('Player ' + creep.name + ': 找不到到房间 ' + signTarget.roomName + ' 的出口');
                    delete creep.memory.signTarget;
                }
                return;
            }
            
            // 查找房间控制器
            var controller = creep.room.controller;
            if (controller) {
                // 检查是否在控制器旁边
                if (creep.pos.getRangeTo(controller) > 1) {
                    creep.moveTo(controller, {
                        visualizePathStyle: {stroke: '#00ffff'},
                        reusePath: 5,
                        maxRooms: 1
                    });
                    creep.say('🎯控制器');
                } else {
                    // 签名控制器
                    var signResult = creep.signController(controller, signTarget.text);
                    if (signResult === OK) {
                        creep.say('🖊️已签');
                        console.log('Player ' + creep.name + ': 控制器签名成功 - "' + signTarget.text + '"');
                        delete creep.memory.signTarget;
                    } else if (signResult === ERR_NOT_IN_RANGE) {
                        creep.say('❌太远');
                    } else if (signResult === ERR_INVALID_TARGET) {
                        creep.say('❌无效');
                        delete creep.memory.signTarget;
                    }
                }
            } else {
                console.log('Player ' + creep.name + ': 房间 ' + signTarget.roomName + ' 没有控制器');
                delete creep.memory.signTarget;
            }
        }
    },
    
    // 执行存储指令
    executeStorage: function(creep) {
        var storageTarget = creep.memory.storageTarget;
        
        // 检查是否携带资源
        var totalResources = 0;
        for (var resourceType in creep.store) {
            totalResources += creep.store[resourceType];
        }
        
        if (totalResources === 0) {
            creep.say('📦空');
            delete creep.memory.storageTarget;
            return;
        }
        
        var target;
        
        // 如果没有指定具体目标ID，自动寻找最近的容器
        if (!storageTarget.targetId) {
            // 查找最近的存储结构（容器、存储、终端）
            var storageStructures = creep.room.find(FIND_STRUCTURES, {
                filter: function(structure) {
                    return (structure.structureType === STRUCTURE_CONTAINER ||
                            structure.structureType === STRUCTURE_STORAGE ||
                            structure.structureType === STRUCTURE_TERMINAL) &&
                           structure.store.getFreeCapacity() > 0;
                }
            });
            
            if (storageStructures.length > 0) {
                target = creep.pos.findClosestByRange(storageStructures);
                if (target) {
                    // 临时存储目标ID，避免每次都重新计算
                    creep.memory.storageTarget.targetId = target.id;
                }
            }
        } else {
            // 通过ID查找目标
            target = Game.getObjectById(storageTarget.targetId);
        }
        
        if (!target) {
            creep.say('❌无存储');
            console.log('Player ' + creep.name + ': 找不到存储目标');
            delete creep.memory.storageTarget;
            return;
        }
        
        // 检查目标是否已满
        if (target.store.getFreeCapacity() === 0) {
            creep.say('🈵目标满');
            delete creep.memory.storageTarget;
            return;
        }
        
        // 转移资源
        for (var resourceType in creep.store) {
            if (creep.store[resourceType] > 0) {
                var transferResult = creep.transfer(target, resourceType);
                
                if (transferResult === OK) {
                    creep.say('📤存' + resourceType.substr(0, 3));
                    // 如果所有资源都转移完毕，清除存储目标
                    var remainingResources = 0;
                    for (var rt in creep.store) {
                        remainingResources += creep.store[rt];
                    }
                    if (remainingResources === 0) {
                        delete creep.memory.storageTarget;
                    }
                    return;
                } else if (transferResult === ERR_NOT_IN_RANGE) {
                    // 移动到存储目标
                    var moveResult = creep.moveTo(target, {
                        visualizePathStyle: {stroke: '#00aaff'},
                        reusePath: 5
                    });
                    
                    if (moveResult === OK) {
                        creep.say('🚶去存储');
                    } else if (moveResult === ERR_NO_PATH) {
                        creep.say('❌无路径');
                        delete creep.memory.storageTarget;
                    }
                    return;
                } else if (transferResult === ERR_FULL) {
                    creep.say('🈵目标满');
                    delete creep.memory.storageTarget;
                    return;
                } else if (transferResult === ERR_INVALID_TARGET) {
                    creep.say('❌无效目标');
                    delete creep.memory.storageTarget;
                    return;
                }
            }
        }
    },
    
    // 切换到控制模式
    setControlledMode: function(creepName) {
        var creep = Game.creeps[creepName];
        if (creep) {
            creep.memory.controlled = true;
            creep.memory.harvesting = false;
            console.log('Player ' + creepName + ': 切换到控制模式');
            return true;
        }
        return false;
    },
    
    // 切换到默认模式（harvester）
    setDefaultMode: function(creepName) {
        var creep = Game.creeps[creepName];
        if (creep) {
            creep.memory.controlled = false;
            delete creep.memory.gotoTarget;
            delete creep.memory.pathNodes;
            delete creep.memory.currentNodeIndex;
            delete creep.memory.signTarget;
            delete creep.memory.storageTarget;
            delete creep.memory.destroyTarget;
            console.log('Player ' + creepName + ': 切换到默认模式（harvester）');
            return true;
        }
        return false;
    },
    
    // 设置移动目标（单个目标）
    setGotoTarget: function(creepName, roomName, coordinates) {
        var creep = Game.creeps[creepName];
        if (creep) {
            // 解析坐标字符串（格式："x,y"）
            var coordArray = coordinates.split(',');
            if (coordArray.length === 2) {
                var x = parseInt(coordArray[0], 10);
                var y = parseInt(coordArray[1], 10);
                
                // 验证坐标是否有效
                if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
                    // 切换到控制模式
                    creep.memory.controlled = true;
                    
                    // 清除之前的路径节点
                    delete creep.memory.pathNodes;
                    delete creep.memory.currentNodeIndex;
                    
                    // 设置移动目标
                    creep.memory.gotoTarget = {
                        roomName: roomName,
                        x: x,
                        y: y
                    };
                    
                    console.log('Player ' + creepName + ': 设置移动目标到 ' + roomName + ' (' + x + ',' + y + ')');
                    return true;
                } else {
                    console.log('错误：坐标超出范围（0-49）');
                }
            } else {
                console.log('错误：坐标格式不正确，请使用 "x,y" 格式');
            }
        } else {
            console.log('错误：找不到creep ' + creepName);
        }
        return false;
    },
    
    // 设置路径节点移动
    setPathNodes: function(creepName, nodes) {
        var creep = Game.creeps[creepName];
        if (creep) {
            // 验证参数
            if (!nodes || nodes.length === 0) {
                console.log('错误：节点列表不能为空');
                return false;
            }
            
            // 切换到控制模式
            creep.memory.controlled = true;
            
            // 清除之前的单个目标
            delete creep.memory.gotoTarget;
            
            // 设置路径节点
            creep.memory.pathNodes = nodes;
            creep.memory.currentNodeIndex = 0;
            
            // 显示路径信息
            var pathInfo = '设置路径节点：';
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].x !== undefined && nodes[i].y !== undefined) {
                    pathInfo += nodes[i].roomName + ' (' + nodes[i].x + ',' + nodes[i].y + ')';
                } else {
                    pathInfo += nodes[i].roomName;
                }
                if (i < nodes.length - 1) {
                    pathInfo += ' → ';
                }
            }
            console.log('Player ' + creepName + ': ' + pathInfo);
            
            return true;
        }
        console.log('错误：找不到creep ' + creepName);
        return false;
    },
    
    // 设置签名目标
    setSignTarget: function(creepName, roomName, text) {
        var creep = Game.creeps[creepName];
        if (creep) {
            // 切换到控制模式
            creep.memory.controlled = true;
            
            // 设置签名目标
            creep.memory.signTarget = {
                roomName: roomName,
                text: text
            };
            
            console.log('Player ' + creepName + ': 设置签名任务到房间 ' + roomName + '，内容: "' + text + '"');
            return true;
        }
        console.log('错误：找不到creep ' + creepName);
        return false;
    },
    
    // 设置存储目标
    setStorageTarget: function(creepName, targetId) {
        var creep = Game.creeps[creepName];
        if (creep) {
            // 切换到控制模式
            creep.memory.controlled = true;
            
            if (targetId) {
                // 验证目标是否存在
                var target = Game.getObjectById(targetId);
                if (target) {
                    // 检查目标是否为有效的存储结构
                    if (target.structureType === STRUCTURE_CONTAINER ||
                        target.structureType === STRUCTURE_STORAGE ||
                        target.structureType === STRUCTURE_TERMINAL) {
                        
                        creep.memory.storageTarget = {
                            targetId: targetId
                        };
                        
                        console.log('Player ' + creepName + ': 设置存储目标到 ' + targetId);
                        return true;
                    } else {
                        console.log('错误：目标不是有效的存储结构');
                    }
                } else {
                    console.log('错误：找不到ID为 ' + targetId + ' 的对象');
                }
            } else {
                // 不指定ID，自动寻找最近的容器
                creep.memory.storageTarget = {
                    autoFind: true
                };
                
                console.log('Player ' + creepName + ': 设置自动寻找最近的容器作为存储目标');
                return true;
            }
        } else {
            console.log('错误：找不到creep ' + creepName);
        }
        return false;
    },
    
    // 设置拆除目标
    setDestroyTarget: function(creepName, targetId) {
        var creep = Game.creeps[creepName];
        if (creep) {
            // 验证目标是否存在
            var target = Game.getObjectById(targetId);
            if (!target) {
                console.log('错误：找不到ID为 ' + targetId + ' 的建筑');
                return false;
            }
            
            // 检查目标是否为建筑
            if (!target.structureType) {
                console.log('错误：ID ' + targetId + ' 不是一个建筑');
                return false;
            }
            
            // 切换到控制模式
            creep.memory.controlled = true;
            
            // 清除其他指令（因为拆除具有最高优先级）
            delete creep.memory.gotoTarget;
            delete creep.memory.pathNodes;
            delete creep.memory.currentNodeIndex;
            delete creep.memory.signTarget;
            delete creep.memory.storageTarget;
            
            // 设置拆除目标
            creep.memory.destroyTarget = {
                targetId: targetId,
                roomName: target.room.name
            };
            
            console.log('Player ' + creepName + ': 设置拆除目标到 ' + targetId + 
                       ' (' + target.structureType + ') 在房间 ' + target.room.name);
            return true;
        }
        console.log('错误：找不到creep ' + creepName);
        return false;
    },
    
    // 清除所有指令
    clearCommands: function(creepName) {
        var creep = Game.creeps[creepName];
        if (creep) {
            delete creep.memory.gotoTarget;
            delete creep.memory.pathNodes;
            delete creep.memory.currentNodeIndex;
            delete creep.memory.signTarget;
            delete creep.memory.storageTarget;
            delete creep.memory.destroyTarget;
            creep.say('🗑️清除');
            console.log('Player ' + creepName + ': 已清除所有指令');
            return true;
        }
        return false;
    }
};

// ========== 全局控制台函数 ==========

// 注意：这些函数需要在main.js中注册到全局对象，或者在全局环境中执行

/**
 * 控制Player模式切换
 * 用法：control('Player1') - 切换控制模式
 *        control('Player1', false) - 切换回默认模式
 */
if (typeof global !== 'undefined') {
    global.control = function(creepName, enable) {
        if (enable === undefined) {
            // 如果没有指定enable参数，切换模式
            var creep = Game.creeps[creepName];
            if (creep) {
                if (creep.memory.controlled === true) {
                    rolePlayer.setDefaultMode(creepName);
                } else {
                    rolePlayer.setControlledMode(creepName);
                }
            } else {
                console.log('找不到creep: ' + creepName);
            }
        } else if (enable === true) {
            rolePlayer.setControlledMode(creepName);
        } else if (enable === false) {
            rolePlayer.setDefaultMode(creepName);
        }
    };
    
    /**
     * 设置Player移动目标
     * 用法：playergoto('Player1', 'W1N1', '25,25') - 直接移动到目标
     * 或：playergoto('Player1', '中间节点1', '中间节点2', ..., '终点房间', 'x,y')
     * 注意：最后一个参数必须是坐标格式 "x,y"
     */
    global.playergoto = function() {
        // 获取所有参数
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        
        if (args.length < 3) {
            console.log('错误：参数不足，至少需要creepName, roomName, coordinates');
            console.log('用法：playergoto(creepName, roomName, "x,y")');
            console.log('或：playergoto(creepName, node1, node2, ..., finalRoom, "x,y")');
            return false;
        }
        
        var creepName = args[0];
        
        // 检查最后一个参数是否为坐标格式
        var lastArg = args[args.length - 1];
        var coordArray;
        var x, y;
        
        if (typeof lastArg === 'string' && lastArg.indexOf(',') !== -1) {
            coordArray = lastArg.split(',');
            if (coordArray.length === 2) {
                x = parseInt(coordArray[0], 10);
                y = parseInt(coordArray[1], 10);
            }
        }
        
        // 验证坐标格式
        if (!coordArray || coordArray.length !== 2 || isNaN(x) || isNaN(y) || 
            x < 0 || x > 49 || y < 0 || y > 49) {
            console.log('错误：最后一个参数必须是有效的坐标格式 "x,y"，其中x,y为0-49的数字');
            return false;
        }
        
        // 如果只有3个参数，使用单个目标模式
        if (args.length === 3) {
            var roomName = args[1];
            var coordinates = args[2];
            return rolePlayer.setGotoTarget(creepName, roomName, coordinates);
        }
        
        // 多个参数，使用路径节点模式
        // 最后两个参数是终点房间和坐标
        var finalRoomName = args[args.length - 2];
        var finalCoordinates = args[args.length - 1];
        
        // 构建节点列表
        var nodes = [];
        
        // 添加中间节点（除了creepName、最后两个参数之外的所有参数）
        for (var i = 1; i < args.length - 2; i++) {
            nodes.push({
                roomName: args[i]
                // 中间节点没有坐标
            });
        }
        
        // 添加终点节点（有坐标）
        nodes.push({
            roomName: finalRoomName,
            x: x,
            y: y
        });
        
        return rolePlayer.setPathNodes(creepName, nodes);
    };
    
    /**
     * 设置Player签名任务
     * 用法：playersign('Player1', 'W1N1', 'Hello World!')
     */
    global.playersign = function(creepName, roomName, text) {
        return rolePlayer.setSignTarget(creepName, roomName, text);
    };
    
    /**
     * 设置Player存储任务
     * 用法：playerstorage('Player1', '存储ID') - 存储到指定ID的容器/存储
     *       playerstorage('Player1') - 自动寻找最近的容器
     */
    global.playerstorage = function(creepName, targetId) {
        return rolePlayer.setStorageTarget(creepName, targetId);
    };
    
    /**
     * 设置Player拆除任务
     * 用法：playerdestroy('Player1', '建筑ID') - 拆除指定ID的建筑
     */
    global.playerdestroy = function(creepName, targetId) {
        return rolePlayer.setDestroyTarget(creepName, targetId);
    };
    
    /**
     * 清除Player所有指令
     * 用法：playerclear('Player1')
     */
    global.playerclear = function(creepName) {
        return rolePlayer.clearCommands(creepName);
    };
    
    /**
     * 设置Player直接路径节点（高级用法）
     * 用法：playersetpath('Player1', [{roomName:'W1N1'}, {roomName:'W1N2', x:25, y:25}])
     */
    global.playersetpath = function(creepName, nodes) {
        return rolePlayer.setPathNodes(creepName, nodes);
    };
    
    /**
     * 调试函数：查看Player的当前状态
     * 用法：playerstatus('Player1')
     */
    global.playerstatus = function(creepName) {
        var creep = Game.creeps[creepName];
        if (creep) {
            console.log('Player ' + creepName + ' 状态:');
            console.log('  房间: ' + creep.room.name);
            console.log('  位置: (' + creep.pos.x + ',' + creep.pos.y + ')');
            console.log('  血量: ' + creep.hits + '/' + creep.hitsMax);
            console.log('  控制模式: ' + (creep.memory.controlled ? '是' : '否'));
            console.log('  移动目标: ' + JSON.stringify(creep.memory.gotoTarget));
            console.log('  路径节点: ' + JSON.stringify(creep.memory.pathNodes));
            console.log('  当前节点索引: ' + creep.memory.currentNodeIndex);
            console.log('  签名目标: ' + JSON.stringify(creep.memory.signTarget));
            console.log('  存储目标: ' + JSON.stringify(creep.memory.storageTarget));
            console.log('  拆除目标: ' + JSON.stringify(creep.memory.destroyTarget));
            
            // 检查身体部件
            var bodyParts = {};
            for (var i = 0; i < creep.body.length; i++) {
                var part = creep.body[i].type;
                bodyParts[part] = (bodyParts[part] || 0) + 1;
            }
            console.log('  身体部件: ' + JSON.stringify(bodyParts));
            
            return true;
        }
        console.log('错误：找不到creep ' + creepName);
        return false;
    };
}

// 导出模块
module.exports = rolePlayer;