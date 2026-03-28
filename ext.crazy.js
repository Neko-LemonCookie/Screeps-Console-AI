// ext.crazy

global.crazy = function(roomName) {
    // 开启紧急模式
    Memory.emergencyMode = {
        active: true,
        startTime: Game.time
    };
    console.log("紧急模式已激活，持续400tick");
    
    // 获取指定房间
    const room = Game.rooms[roomName];
    if (!room) {
        console.log(`错误：无法访问房间 ${roomName}`);
        return;
    }
    
    // 初始化临时存储
    if (!Memory.TempRole) Memory.TempRole = {};
    if (!Memory.TempRole[roomName]) Memory.TempRole[roomName] = {};
    
    // 转换所有带有WORK部件的creep为收获者
    const creeps = room.find(FIND_MY_CREEPS);
    let converted = 0;
    
    for (const creep of creeps) {
        // 检查是否带有WORK部件
        const hasWork = creep.body.some(part => part.type === WORK);
        
        if (hasWork) {
            // 记录原来的角色
            Memory.TempRole[roomName][creep.name] = creep.memory.role || '未知';
            
            // 设置为收获者
            creep.memory.role = 'harvester';
            converted++;
            
            console.log(`${creep.name} 从 ${Memory.TempRole[roomName][creep.name]} 转换为 harvester`);
        }
    }
    
    console.log(`转换完成: ${converted}/${creeps.length} 个creep被转换为收获者`);
};

global.uncrazy = function(roomName) {
    // 关闭紧急模式
    Memory.emergencyMode = {
        active: false,
        startTime: Game.time
    };
    console.log(`紧急模式已关闭，开始恢复房间 ${roomName} 的creep角色`);
    
    // 检查是否有临时角色记录
    if (!Memory.TempRole || !Memory.TempRole[roomName]) {
        console.log(`警告：没有找到房间 ${roomName} 的临时角色记录`);
        return;
    }
    
    const tempRoles = Memory.TempRole[roomName];
    let restored = 0;
    let missing = 0;
    
    // 恢复每个creep的角色
    for (const creepName in tempRoles) {
        const originalRole = tempRoles[creepName];
        
        // 查找creep是否还活着
        const creep = Game.creeps[creepName];
        
        if (creep) {
            // 恢复原来的角色
            creep.memory.role = originalRole;
            restored++;
            console.log(`${creepName} 从 harvester 恢复为 ${originalRole}`);
        } else {
            // creep已死亡，跳过
            missing++;
            console.log(`跳过：creep ${creepName} 已死亡或不存在`);
        }
    }
    
    // 删除该房间的临时记录
    delete Memory.TempRole[roomName];
    
    // 如果所有房间的记录都清空了，删除整个TempRole对象
    if (Object.keys(Memory.TempRole).length === 0) {
        delete Memory.TempRole;
    }
    
    console.log(`恢复完成: ${restored} 个creep已恢复，${missing} 个creep已死亡`);
};