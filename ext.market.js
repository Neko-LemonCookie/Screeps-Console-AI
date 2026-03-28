// ext.market.js - Screeps 市场自动化模块
// 作者: TangYuanLonelyCat
// 方式: 直接在模块中挂载全局函数，无需init

/**
 * 确保内存结构存在
 */
function _ensureMemory() {
    if (!Memory.TangYuanLonelyCat) {
        Memory.TangYuanLonelyCat = {};
    }
    if (!Memory.TangYuanLonelyCat.Market) {
        Memory.TangYuanLonelyCat.Market = {};
    }
}

/**
 * 获取所有有效的资源类型
 */
function _getAllResourceTypes() {
    return [
        "energy", "metal", "biomass", "silicon", "mist",
        "H", "O", "Z", "U", "K", "L", "X",
        "utrium", "lemergium", "zynthium", "keanium", "ghodium",
        "oxidant", "reductant", "purifier", "battery",
        "composite", "crystal", "liquid"
    ];
}

/**
 * 尝试售卖资源（内部函数）- 简洁版本
 */
function _trySellResource(roomName) {
    _ensureMemory();
    
    const task = Memory.TangYuanLonelyCat.Market[roomName];
    if (!task || task.status !== 'active') return;
    
    // 检查是否过期
    if (Game.time >= task.endTick) {
        task.status = 'expired';
        console.log(`[Market] ⏰ ${roomName}: 售卖任务已过期，共售出${task.totalSold} ${task.resourceType}`);
        return;
    }
    
    const room = Game.rooms[roomName];
    if (!room || !room.terminal) {
        task.status = 'error';
        return;
    }
    
    // 检查终端冷却 - 静默跳过
    if (room.terminal.cooldown > 0) return;
    
    // 检查资源存量
    const resourceAmount = room.terminal.store[task.resourceType] || 0;
    if (resourceAmount <= 0) {
        task.status = 'completed';
        console.log(`[Market] ✅ ${roomName}: ${task.resourceType} 已售罄，共售出${task.totalSold}单位`);
        return;
    }
    
    // 查找最高价格的买单
    const buyOrders = Game.market.getAllOrders({
        resourceType: task.resourceType,
        type: ORDER_BUY
    });
    
    if (buyOrders.length === 0) return; // 没有买单，静默跳过
    
    // 按价格从高到低排序
    buyOrders.sort((a, b) => b.price - a.price);
    
    // 找到第一个有效的订单
    let targetOrder = null;
    for (const order of buyOrders) {
        if (order.remainingAmount <= 0) continue;
        
        const amountToSell = Math.min(1000, resourceAmount, order.remainingAmount);
        const energyCost = Game.market.calcTransactionCost(amountToSell, roomName, order.roomName);
        
        // 检查能量 - 静默跳过
        if (room.terminal.store[RESOURCE_ENERGY] < energyCost) continue;
        
        targetOrder = order;
        break;
    }
    
    if (!targetOrder) return; // 没有合适订单，静默跳过
    
    // 确定售卖数量
    const amountToSell = Math.min(1000, resourceAmount, targetOrder.remainingAmount);
    
    // 执行交易
    const result = Game.market.deal(targetOrder.id, amountToSell, roomName);
    
    if (result === OK) {
        task.totalSold += amountToSell;
        task.lastActionTick = Game.time;
        
        // 获取交易后的资源存量
        const newAmount = room.terminal.store[task.resourceType] || 0;
        
        // 只输出成功日志
        console.log(`[Market] ✅ ${roomName}: 售出${amountToSell} ${task.resourceType}@${targetOrder.price.toFixed(3)}，+${Math.round(amountToSell * targetOrder.price)}信用点`);
        
        if (newAmount <= 0) {
            task.status = 'completed';
            console.log(`[Market] 🎉 ${roomName}: ${task.resourceType} 已全部售出，总计${task.totalSold}单位`);
        }
    }
    // 交易失败静默处理
}

/**
 * 清理过期任务
 */
function _cleanupExpiredTasks() {
    _ensureMemory();
    
    for (const roomName in Memory.TangYuanLonelyCat.Market) {
        const task = Memory.TangYuanLonelyCat.Market[roomName];
        
        if (task.status === 'expired' || task.status === 'completed' || task.status === 'error') {
            if (Game.time - task.lastActionTick > 500) {
                delete Memory.TangYuanLonelyCat.Market[roomName];
            }
        }
    }
}

// ==================== 全局函数 ====================

/**
 * 全局函数：开始自动售卖资源，持续400tick
 * @param {string} roomName - 房间名
 * @param {string} resourceType - 资源类型
 */
global.marketSellNow = function(roomName, resourceType) {
    _ensureMemory();
    
    // 验证资源类型
    const validResources = _getAllResourceTypes();
    if (!validResources.includes(resourceType)) {
        console.log(`[Market] ❌ 未知资源类型 "${resourceType}"，使用 marketHelp() 查看列表`);
        return false;
    }
    
    // 验证房间和终端
    const room = Game.rooms[roomName];
    if (!room || !room.terminal) {
        console.log(`[Market] ❌ 房间 ${roomName} 没有终端`);
        return false;
    }
    
    // 检查资源存量
    const resourceAmount = room.terminal.store[resourceType] || 0;
    if (resourceAmount <= 0) {
        console.log(`[Market] ❌ 终端中没有 ${resourceType} 资源`);
        return false;
    }
    
    // 创建或更新售卖任务
    Memory.TangYuanLonelyCat.Market[roomName] = {
        resourceType: resourceType,
        startTick: Game.time,
        endTick: Game.time + 400,
        status: 'active',
        totalSold: 0,
        lastActionTick: Game.time
    };
    
    console.log(`[Market] ✅ ${roomName}: 开始自动售卖 ${resourceType}，持续400tick`);
    console.log(`[Market] 📊 ${roomName}: 存量: ${resourceAmount}，结束于tick ${Game.time + 400}`);
    
    // 立即尝试第一次售卖
    _trySellResource(roomName);
    
    return true;
};

/**
 * 全局函数：立即购买资源
 * @param {string} roomName - 房间名
 * @param {string} resourceType - 资源类型
 * @param {number} amount - 购买数量
 */
global.marketBuy = function(roomName, resourceType, amount) {
    _ensureMemory();
    
    // 验证资源类型
    const validResources = _getAllResourceTypes();
    if (!validResources.includes(resourceType)) {
        console.log(`[Market] ❌ 未知资源类型 "${resourceType}"`);
        return false;
    }
    
    // 验证房间和终端
    const room = Game.rooms[roomName];
    if (!room || !room.terminal) {
        console.log(`[Market] ❌ 房间 ${roomName} 没有终端`);
        return false;
    }
    
    // 查找最低价格的卖单
    const sellOrders = Game.market.getAllOrders({
        resourceType: resourceType,
        type: ORDER_SELL
    });
    
    if (sellOrders.length === 0) {
        console.log(`[Market] ❌ 没有找到 ${resourceType} 的卖单`);
        return false;
    }
    
    // 按价格从低到高排序
    sellOrders.sort((a, b) => a.price - b.price);
    const cheapestOrder = sellOrders[0];
    const maxAmount = Math.min(amount, cheapestOrder.remainingAmount);
    
    if (maxAmount <= 0) {
        console.log(`[Market] ❌ 订单剩余量为0`);
        return false;
    }
    
    const totalCost = maxAmount * cheapestOrder.price;
    
    // 检查信用点
    if (Game.market.credits < totalCost) {
        console.log(`[Market] ❌ 信用点不足: 需要${totalCost}，当前${Game.market.credits}`);
        return false;
    }
    
    // 计算能量成本
    const energyCost = Game.market.calcTransactionCost(maxAmount, roomName, cheapestOrder.roomName);
    
    // 检查终端能量
    if (room.terminal.store[RESOURCE_ENERGY] < energyCost) {
        console.log(`[Market] ❌ 能量不足: 需要${energyCost}，当前${room.terminal.store[RESOURCE_ENERGY]}`);
        return false;
    }
    
    // 检查终端冷却
    if (room.terminal.cooldown > 0) {
        console.log(`[Market] ❌ 终端冷却中: 剩余${room.terminal.cooldown}tick`);
        return false;
    }
    
    // 执行购买
    const result = Game.market.deal(cheapestOrder.id, maxAmount, roomName);
    
    if (result === OK) {
        console.log(`[Market] ✅ ${roomName}: 购买成功: ${maxAmount} ${resourceType}，花费${totalCost}信用点`);
        return true;
    } else {
        console.log(`[Market] ❌ ${roomName}: 购买失败: 错误码${result}`);
        return false;
    }
};

/**
 * 全局函数：显示帮助信息
 */
global.marketHelp = function() {
    console.log('[Market] 📋 可用函数:');
    console.log('  marketSellNow(roomName, resourceType) - 开始400tick自动售卖');
    console.log('  marketBuy(roomName, resourceType, amount) - 立即购买资源');
    console.log('  marketHelp() - 显示此帮助信息');
    console.log('  marketStop(roomName) - 停止指定房间的售卖任务');
    console.log('  marketStatus() - 显示所有任务状态');
    console.log('');
    console.log('[Market] ⛏️ 基础矿物: H, O, Z, U, K, L, X');
    console.log('[Market] 🔬 提纯矿物: utrium, lemergium, zynthium, keanium, ghodium');
    console.log('[Market] 📦 其他: energy, metal, biomass, silicon, mist');
    console.log('[Market] 💡 示例: marketSellNow("W57S11", "O") 或 marketBuy("W57S11", "utrium", 1000)');
};

/**
 * 全局函数：停止指定房间的售卖任务
 */
global.marketStop = function(roomName) {
    _ensureMemory();
    
    if (!roomName) {
        console.log('[Market] ❌ 请指定房间名');
        return false;
    }
    
    if (Memory.TangYuanLonelyCat.Market[roomName]) {
        Memory.TangYuanLonelyCat.Market[roomName].status = 'stopped';
        console.log(`[Market] 🛑 ${roomName}: 售卖任务已停止`);
        return true;
    } else {
        console.log(`[Market] ❌ ${roomName}: 没有找到售卖任务`);
        return false;
    }
};

/**
 * 全局函数：获取任务状态
 */
global.marketStatus = function() {
    _ensureMemory();
    
    if (Object.keys(Memory.TangYuanLonelyCat.Market).length === 0) {
        console.log('[Market] 📭 没有活跃的售卖任务');
        return {};
    }
    
    console.log('[Market] 📊 当前任务状态:');
    for (const roomName in Memory.TangYuanLonelyCat.Market) {
        const task = Memory.TangYuanLonelyCat.Market[roomName];
        const remainingTicks = Math.max(0, task.endTick - Game.time);
        
        console.log(`  ${roomName}: ${task.resourceType} (${task.status})`);
        console.log(`    已售: ${task.totalSold}，剩余tick: ${remainingTicks}`);
    }
    
    return Memory.TangYuanLonelyCat.Market;
};

// ==================== 模块主接口 ====================

module.exports = {
    
    /**
     * 每 tick 执行的任务处理 - 接收room对象
     * @param {Room} room - 房间对象
     */
    run: function(room) {
        // 检查房间是否有终端，没有终端就不执行市场逻辑
        if (!room || !room.terminal) return;
        
        _cleanupExpiredTasks();
        this._processSellTasks(room);
    },
    
    /**
     * 处理所有售卖任务 - 只处理传入房间的任务
     * @param {Room} room - 房间对象
     */
    _processSellTasks: function(room) {
        if (!room) return;
        
        const roomName = room.name;
        const task = Memory.TangYuanLonelyCat.Market[roomName];
        
        if (task && task.status === 'active') {
            _trySellResource(roomName);
        }
    }
};