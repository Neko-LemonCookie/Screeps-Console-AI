// ext.autobuild.js - 自动建造道路和容器系统
module.exports = {
    run: function(room) {
        // 检查是否需要更新检测数据（每500tick检测一次）
        if (!room.memory.autobuild || !room.memory.lastCheck || Game.time - room.memory.lastCheck > 500) {
            this._scanStructures(room);
        }
        
        // 执行自动建造逻辑
        this._autoBuild(room);
    },
    
    // 扫描现有结构并更新内存
    _scanStructures: function(room) {
        // 初始化内存
        if (!room.memory.autobuild) {
            room.memory.autobuild = {
                roads: [],
                containers: []
            };
        }
        
        // 扫描道路
        const roads = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_ROAD
        });
        
        // 扫描容器
        const containers = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_CONTAINER
        });
        
        // 更新道路数据到内存
        room.memory.autobuild.roads = roads.map(road => ({
            id: road.id,
            x: road.pos.x,
            y: road.pos.y,
            hits: road.hits,
            hitsMax: road.hitsMax
        }));
        
        // 更新容器数据到内存
        room.memory.autobuild.containers = containers.map(container => ({
            id: container.id,
            x: container.pos.x,
            y: container.pos.y,
            hits: container.hits,
            hitsMax: container.hitsMax
        }));
        
        // 更新最后检测时间
        room.memory.lastCheck = Game.time;
        
        // 调试信息
        console.log(`[T${Game.time}] 房间${room.name} - 自动建造系统扫描完成: 道路${roads.length}个, 容器${containers.length}个`);
    },
    
    // 自动建造逻辑
    _autoBuild: function(room) {
        if (!room.memory.autobuild) return;
        
        // 获取现有工地
        const existingSites = room.find(FIND_CONSTRUCTION_SITES);
        
        // 检查道路是否需要重建
        for (const roadData of room.memory.autobuild.roads) {
            // 检查该位置是否已有道路或道路工地
            const hasRoad = room.lookForAt(LOOK_STRUCTURES, roadData.x, roadData.y)
                .some(s => s.structureType === STRUCTURE_ROAD);
            
            const hasRoadSite = existingSites.some(s => 
                s.structureType === STRUCTURE_ROAD && 
                s.pos.x === roadData.x && 
                s.pos.y === roadData.y);
            
            // 如果没有道路且没有道路工地，创建道路工地
            if (!hasRoad && !hasRoadSite) {
                room.createConstructionSite(roadData.x, roadData.y, STRUCTURE_ROAD);
            }
        }
        
        // 检查容器是否需要重建
        for (const containerData of room.memory.autobuild.containers) {
            // 检查该位置是否已有容器或容器工地
            const hasContainer = room.lookForAt(LOOK_STRUCTURES, containerData.x, containerData.y)
                .some(s => s.structureType === STRUCTURE_CONTAINER);
            
            const hasContainerSite = existingSites.some(s => 
                s.structureType === STRUCTURE_CONTAINER && 
                s.pos.x === containerData.x && 
                s.pos.y === containerData.y);
            
            // 如果没有容器且没有容器工地，创建容器工地
            if (!hasContainer && !hasContainerSite) {
                room.createConstructionSite(containerData.x, containerData.y, STRUCTURE_CONTAINER);
            }
        }
    }
};