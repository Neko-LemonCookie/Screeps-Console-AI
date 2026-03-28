// common.utils.js - 通用工具模块
var commonUtils = {
    /**
     * 获取默认移动选项
     * @param {Object} customOpts - 自定义选项
     * @returns {Object} 完整的移动选项
     */
    getMoveOpts: function(customOpts) {
        // ========== 默认移动选项初始化 ==========
        var defaultOpts = {
            visualizePathStyle: { stroke: '#ffaa00' },
            reusePath: 8, // 优化：调整reusePath值，平衡CPU和反应速度
            maxOps: 400,
            range: 1,
            serializeMemory: true
        };
        
        // ========== 合并自定义选项 ==========
        if (customOpts) {
            for (var key in customOpts) {
                defaultOpts[key] = customOpts[key];
            }
        }
        
        return defaultOpts;
    },
    
    /**
     * 获取紧急模式移动选项
     * @returns {Object} 紧急模式移动选项
     */
    getEmergencyMoveOpts: function() {
        // ========== 紧急模式移动选项配置 ==========
        return {
            visualizePathStyle: { stroke: '#ff0000', lineStyle: 'dashed' },
            reusePath: 0,
            maxOps: 2000,
            range: 1,
            ignoreCreeps: false,
            serializeMemory: false,
            ignoreDestructibleStructures: true,
            maxRooms: 1,
            plainCost: 2,
            swampCost: 10
        };
    },
    
    /**
     * 检查紧急模式状态
     */
    checkEmergencyMode: function() {
        // ========== 紧急模式检查 ==========
        if (Memory.emergencyMode && Memory.emergencyMode.active) {
            // 检查是否超时
            if (Game.time >= Memory.emergencyMode.startTime + 400) {
                Memory.emergencyMode.active = false;
                console.log('[Utils] 紧急模式已自动关闭，持续了400tick');
            }
        }
    },
    
    /**
     * 检查creep是否有WORK部件
     * @param {Creep} creep - creep对象
     * @returns {boolean} 是否有WORK部件
     */
    hasWorkPart: function(creep) {
        // ========== WORK部件检查 ==========
        for (var i = 0; i < creep.body.length; i++) {
            if (creep.body[i].type === WORK) {
                return true;
            }
        }
        return false;
    },
    
    /**
     * 检查creep是否有ATTACK部件
     * @param {Creep} creep - creep对象
     * @returns {boolean} 是否有ATTACK部件
     */
    hasAttackPart: function(creep) {
        // ========== ATTACK部件检查 ==========
        for (var i = 0; i < creep.body.length; i++) {
            if (creep.body[i].type === ATTACK) {
                return true;
            }
        }
        return false;
    },
    
    /**
     * 检查creep是否有CARRY部件
     * @param {Creep} creep - creep对象
     * @returns {boolean} 是否有CARRY部件
     */
    hasCarryPart: function(creep) {
        // ========== CARRY部件检查 ==========
        for (var i = 0; i < creep.body.length; i++) {
            if (creep.body[i].type === CARRY) {
                return true;
            }
        }
        return false;
    },
    
    /**
     * 计算Spawn和Extension中现有的能量总和
     * @param {Room} room - 房间对象
     * @returns {number} 总能量
     */
    calculateBaseEnergy: function(room) {
        // ========== 查找Spawn和Extension ==========
        var structures = room.find(FIND_STRUCTURES, {
            filter: function(s) {
                return s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION;
            }
        });
        
        // ========== 计算总能量 ==========
        var totalEnergy = 0;
        for (var i = 0; i < structures.length; i++) {
            var struct = structures[i];
            totalEnergy += struct.store[RESOURCE_ENERGY] || 0;
        }
        return totalEnergy;
    },
    
    /**
     * 更新房间容器状态
     * @param {Room} room - 房间对象
     */
    updateRoomContainerStatus: function(room) {
        // ========== 查找房间内容器 ==========
        var containers = room.find(FIND_STRUCTURES, {
            filter: function(s) {
                return s.structureType === STRUCTURE_CONTAINER;
            }
        });
        
        // ========== 处理无容器情况 ==========
        if (containers.length === 0) {
            room.memory.containersSatisfied = true;
            room.memory.lastContainerCheck = Game.time;
            return;
        }
        
        // ========== 检查容器能量状态 ==========
        var hasEnoughEnergy = false;
        for (var i = 0; i < containers.length; i++) {
            var container = containers[i];
            var capacity = container.store.getCapacity(RESOURCE_ENERGY);
            var energy = container.store[RESOURCE_ENERGY] || 0;
            var percentage = capacity > 0 ? energy / capacity : 0;
            
            if (percentage >= 0.2) {
                hasEnoughEnergy = true;
                break;
            }
        }
        
        // ========== 更新房间内存 ==========
        room.memory.containersSatisfied = hasEnoughEnergy;
        room.memory.lastContainerCheck = Game.time;
    }
};

module.exports = commonUtils;