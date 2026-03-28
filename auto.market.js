// auto.market.js - Screeps 市场自动套利系统
// 作者: TangYuanLonelyCat
// 功能: 自动寻找差价最大的资源进行套利交易，并扣除能量成本
// 注意: 使用ES5语法，避免?.和??操作符

/**
 * 确保内存结构存在
 */
function _ensureMemory() {
    if (!Memory.TangYuanLonelyCat) {
        Memory.TangYuanLonelyCat = {};
    }
    if (!Memory.TangYuanLonelyCat.AutoMarket) {
        Memory.TangYuanLonelyCat.AutoMarket = {
            tasks: {},
            statistics: {
                totalProfit: 0,
                tradesCount: 0,
                totalVolume: 0
            },
            settings: {
                minCredits: 50000,      // 最低信用点保障
                maxSingleTrade: 1000,   // 单次最大交易量
                minProfitMargin: 1.05,  // 最低利润率 5%（基于价差）
                maxHoldTime: 5000,      // 最大持有时间
                energyValue: 7,         // 能量的机会成本（信用点/单位）
                minNetProfit: 500       // 最低净利润（信用点），低于此值不执行交易，避免浪费冷却
            }
        };
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
 * 计算交易的能量成本（返回所需能量）
 */
function _calculateEnergyCost(amount, fromRoom, toRoom) {
    return Game.market.calcTransactionCost(amount, fromRoom, toRoom);
}

/**
 * 检查信用点是否充足
 */
function _checkCredits() {
    var minCredits = Memory.TangYuanLonelyCat && 
                     Memory.TangYuanLonelyCat.AutoMarket && 
                     Memory.TangYuanLonelyCat.AutoMarket.settings && 
                     Memory.TangYuanLonelyCat.AutoMarket.settings.minCredits;
    
    if (!minCredits) {
        minCredits = 50000; // 默认值
    }
    
    return Game.market.credits >= minCredits;
}

/**
 * 获取能量的机会成本（信用点/单位）
 * @param {string} roomName - 可选，用于未来动态计算
 */
function _getEnergyValue(roomName) {
    var settings = Memory.TangYuanLonelyCat && 
                   Memory.TangYuanLonelyCat.AutoMarket && 
                   Memory.TangYuanLonelyCat.AutoMarket.settings;
    return (settings && settings.energyValue) ? settings.energyValue : 7;
}

/**
 * 寻找最佳套利机会（带能量成本计算）
 * @param {string} myRoomName - 执行交易的本方房间名
 */
function _findBestArbitrage(myRoomName) {
    if (!myRoomName) return null;
    
    var bestArbitrage = null;
    var maxNetProfit = 0;
    
    var resources = _getAllResourceTypes();
    
    for (var i = 0; i < resources.length; i++) {
        var resource = resources[i];
        var arbitrage = _analyzeResourceArbitrage(resource, myRoomName);
        if (arbitrage && arbitrage.netProfit > maxNetProfit) {
            maxNetProfit = arbitrage.netProfit;
            bestArbitrage = arbitrage;
        }
    }
    
    return bestArbitrage;
}

/**
 * 分析单个资源的套利机会（带能量成本计算）
 * @param {string} resourceType - 资源类型
 * @param {string} myRoomName - 本方房间名
 */
function _analyzeResourceArbitrage(resourceType, myRoomName) {
    // 获取所有买单（从高到低排序）
    var buyOrders = Game.market.getAllOrders({
        resourceType: resourceType,
        type: ORDER_BUY
    });
    
    // 过滤剩余量为0的订单
    var validBuyOrders = [];
    for (var i = 0; i < buyOrders.length; i++) {
        if (buyOrders[i].remainingAmount > 0) {
            validBuyOrders.push(buyOrders[i]);
        }
    }
    
    if (validBuyOrders.length === 0) return null;
    
    // 获取所有卖单（从低到高排序）
    var sellOrders = Game.market.getAllOrders({
        resourceType: resourceType,
        type: ORDER_SELL
    });
    
    // 过滤剩余量为0的订单
    var validSellOrders = [];
    for (var i = 0; i < sellOrders.length; i++) {
        if (sellOrders[i].remainingAmount > 0) {
            validSellOrders.push(sellOrders[i]);
        }
    }
    
    if (validSellOrders.length === 0) return null;
    
    // 排序
    validBuyOrders.sort(function(a, b) { return b.price - a.price; });
    validSellOrders.sort(function(a, b) { return a.price - b.price; });
    
    var bestBuyOrder = validBuyOrders[0];      // 最高买单
    var bestSellOrder = validSellOrders[0];    // 最低卖单
    
    // 检查是否有套利空间（买单价格 > 卖单价格）
    if (bestBuyOrder.price <= bestSellOrder.price) {
        return null;
    }
    
    // 获取设置
    var settings = Memory.TangYuanLonelyCat && 
                   Memory.TangYuanLonelyCat.AutoMarket && 
                   Memory.TangYuanLonelyCat.AutoMarket.settings;
    
    var minMargin = settings ? settings.minProfitMargin : 1.05;
    var maxSingleTrade = settings ? settings.maxSingleTrade : 1000;
    var energyValue = settings ? settings.energyValue : 7;
    var minNetProfit = settings ? settings.minNetProfit : 500;
    
    // 计算利润率（价差）
    var profitMargin = bestBuyOrder.price / bestSellOrder.price;
    
    if (profitMargin < minMargin) {
        return null; // 利润率不足
    }
    
    // 计算最大可交易数量
    var maxByOrders = Math.min(
        bestSellOrder.remainingAmount,
        bestBuyOrder.remainingAmount,
        maxSingleTrade
    );
    
    if (maxByOrders <= 0) {
        return null;
    }
    
    // 计算能量成本（需要本方房间名）
    if (!myRoomName) {
        // 如果没有提供房间名，则只返回毛利（用于扫描）
        var profitPerUnit = bestBuyOrder.price - bestSellOrder.price;
        return {
            resourceType: resourceType,
            buyOrderId: bestSellOrder.id,
            sellOrderId: bestBuyOrder.id,
            buyPrice: bestSellOrder.price,
            sellPrice: bestBuyOrder.price,
            maxAmount: maxByOrders,
            profitPerUnit: profitPerUnit,
            expectedProfit: profitPerUnit * maxByOrders,
            profitMargin: profitMargin,
            buyRoom: bestSellOrder.roomName,
            sellRoom: bestBuyOrder.roomName,
            netProfit: profitPerUnit * maxByOrders // 毛利当作netProfit，但实际未扣能量
        };
    }
    
    // 计算买卖两端的能量成本
    var buyEnergyCost = _calculateEnergyCost(maxByOrders, myRoomName, bestSellOrder.roomName);
    var sellEnergyCost = _calculateEnergyCost(maxByOrders, myRoomName, bestBuyOrder.roomName);
    var totalEnergy = buyEnergyCost + sellEnergyCost;
    var energyCostCredits = totalEnergy * energyValue;
    
    // 计算净利润
    var profitPerUnit = bestBuyOrder.price - bestSellOrder.price;
    var grossProfit = profitPerUnit * maxByOrders;
    var netProfit = grossProfit - energyCostCredits;
    
    // 修改：净利润低于最低要求则放弃
    if (netProfit < minNetProfit) {
        return null;
    }
    
    return {
        resourceType: resourceType,
        buyOrderId: bestSellOrder.id,      // 我们要从最便宜卖单购买
        sellOrderId: bestBuyOrder.id,      // 我们要卖给最贵买单
        buyPrice: bestSellOrder.price,
        sellPrice: bestBuyOrder.price,
        maxAmount: maxByOrders,
        profitPerUnit: profitPerUnit,
        expectedProfit: netProfit,          // 改为净利润
        profitMargin: profitMargin,
        buyRoom: bestSellOrder.roomName,
        sellRoom: bestBuyOrder.roomName,
        grossProfit: grossProfit,
        netProfit: netProfit,
        energyCost: totalEnergy,
        energyCostCredits: energyCostCredits
    };
}

/**
 * 执行套利交易
 */
function _executeArbitrage(roomName, arbitrage) {
    var room = Game.rooms[roomName];
    if (!room || !room.terminal) {
        console.log('[AutoMarket] ❌ ' + roomName + ': 房间或终端不存在');
        return false;
    }
    
    if (room.terminal.cooldown > 0) {
        // 终端冷却中，等待下一tick
        return false;
    }
    
    // 重新检查订单状态（可能已变化）
    var buyOrder = Game.market.getOrderById(arbitrage.buyOrderId);
    var sellOrder = Game.market.getOrderById(arbitrage.sellOrderId);
    
    if (!buyOrder || !sellOrder || 
        buyOrder.remainingAmount <= 0 || 
        sellOrder.remainingAmount <= 0) {
        console.log('[AutoMarket] ❌ ' + roomName + ': 订单已失效');
        return false;
    }
    
    // 重新计算实际交易量
    var amount = Math.min(
        arbitrage.maxAmount,
        buyOrder.remainingAmount,
        sellOrder.remainingAmount
    );
    
    if (amount <= 0) {
        return false;
    }
    
    // 获取能量价值
    var settings = Memory.TangYuanLonelyCat.AutoMarket.settings;
    var energyValue = settings.energyValue || 7;
    var minNetProfit = settings.minNetProfit || 500;
    
    // 计算实际能量成本（根据最新订单）
    var buyEnergyCost = _calculateEnergyCost(amount, roomName, buyOrder.roomName);
    var sellEnergyCost = _calculateEnergyCost(amount, roomName, sellOrder.roomName);
    var totalEnergy = buyEnergyCost + sellEnergyCost;
    var energyCostCredits = totalEnergy * energyValue;
    
    // 计算实际净利润
    var grossProfit = (sellOrder.price - buyOrder.price) * amount;
    var netProfit = grossProfit - energyCostCredits;
    
    // 修改：净利润低于最低要求则放弃
    if (netProfit < minNetProfit) {
        return false;
    }
    
    // 检查能量是否充足
    if (room.terminal.store[RESOURCE_ENERGY] < buyEnergyCost) {
        console.log('[AutoMarket] ❌ ' + roomName + ': 能量不足，需要' + buyEnergyCost);
        return false;
    }
    
    // 执行购买
    console.log('[AutoMarket] 🛒 ' + roomName + ': 尝试购买' + amount + ' ' + arbitrage.resourceType + ' @' + buyOrder.price.toFixed(3));
    var buyResult = Game.market.deal(buyOrder.id, amount, roomName);
    
    if (buyResult !== OK) {
        console.log('[AutoMarket] ❌ ' + roomName + ': 购买失败，错误码' + buyResult);
        return false;
    }
    
    // 购买成功，立即尝试卖出
    _tryImmediateSell(roomName, arbitrage, amount, buyOrder.price, netProfit);
    
    return true;
}

/**
 * 尝试立即卖出（同tick内）
 * @param {string} roomName
 * @param {object} arbitrage - 原始套利信息
 * @param {number} amount - 已购买数量
 * @param {number} actualBuyPrice - 实际买入价
 * @param {number} expectedNetProfit - 预期净利润（用于日志）
 */
function _tryImmediateSell(roomName, arbitrage, amount, actualBuyPrice, expectedNetProfit) {
    var room = Game.rooms[roomName];
    if (!room || !room.terminal || room.terminal.cooldown > 0) {
        // 如果不能立即卖出，记录持有状态
        _recordHolding(roomName, arbitrage, amount, actualBuyPrice);
        return false;
    }
    
    // 重新获取卖单（可能已变化）
    var sellOrder = Game.market.getOrderById(arbitrage.sellOrderId);
    if (!sellOrder || sellOrder.remainingAmount <= 0) {
        _recordHolding(roomName, arbitrage, amount, actualBuyPrice);
        return false;
    }
    
    // 获取能量价值
    var settings = Memory.TangYuanLonelyCat.AutoMarket.settings;
    var energyValue = settings.energyValue || 7;
    var minNetProfit = settings.minNetProfit || 500;
    
    // 计算卖出所需能量
    var sellEnergyCost = _calculateEnergyCost(amount, roomName, sellOrder.roomName);
    
    if (room.terminal.store[RESOURCE_ENERGY] < sellEnergyCost) {
        _recordHolding(roomName, arbitrage, amount, actualBuyPrice);
        return false;
    }
    
    // 实际可卖出量
    var sellAmount = Math.min(amount, sellOrder.remainingAmount);
    
    // 重新计算完整净利润（包含买卖两端的能量成本）
    var totalEnergyCost = _calculateEnergyCost(amount, roomName, arbitrage.buyRoom) + sellEnergyCost;
    var totalEnergyCredits = totalEnergyCost * energyValue;
    var totalGross = (sellOrder.price - actualBuyPrice) * sellAmount;
    var totalNet = totalGross - totalEnergyCredits;
    
    // 修改：净利润低于最低要求则放弃
    if (totalNet < minNetProfit) {
        _recordHolding(roomName, arbitrage, amount, actualBuyPrice);
        return false;
    }
    
    // 执行卖出
    console.log('[AutoMarket] 🏷️ ' + roomName + ': 尝试卖出' + sellAmount + ' ' + arbitrage.resourceType + ' @' + sellOrder.price.toFixed(3));
    var sellResult = Game.market.deal(sellOrder.id, sellAmount, roomName);
    
    if (sellResult === OK) {
        // 记录净利润（实际扣除了所有能量成本）
        _recordProfit(roomName, totalNet, sellAmount);
        
        console.log('[AutoMarket] ✅ ' + roomName + ': 套利成功! 净利润: ' + totalNet.toFixed(2));
        
        // 如果还有剩余，继续持有
        if (sellAmount < amount) {
            var remaining = amount - sellAmount;
            _recordHolding(roomName, arbitrage, remaining, actualBuyPrice);
        }
        return true;
    } else {
        _recordHolding(roomName, arbitrage, amount, actualBuyPrice);
        return false;
    }
}

/**
 * 记录持有状态
 */
function _recordHolding(roomName, arbitrage, amount, buyPrice) {
    var autoMarket = Memory.TangYuanLonelyCat && Memory.TangYuanLonelyCat.AutoMarket;
    if (!autoMarket) return;
    
    var task = autoMarket.tasks && autoMarket.tasks[roomName];
    if (!task) return;
    
    task.holding = {
        resourceType: arbitrage.resourceType,
        amount: amount,
        buyPrice: buyPrice,
        startTick: Game.time,
        targetSellPrice: arbitrage.sellPrice,
        originalSellOrderId: arbitrage.sellOrderId
    };
    
    console.log('[AutoMarket] 📦 ' + roomName + ': 持有' + amount + ' ' + arbitrage.resourceType + '，等待出售机会');
}

/**
 * 记录利润（净利润）
 */
function _recordProfit(roomName, profit, volume) {
    var autoMarket = Memory.TangYuanLonelyCat && Memory.TangYuanLonelyCat.AutoMarket;
    if (!autoMarket) return;
    
    var stats = autoMarket.statistics;
    if (stats) {
        stats.totalProfit += profit;
        stats.tradesCount++;
        stats.totalVolume += volume;
    }
}

/**
 * 处理持有资源
 */
function _processHolding(roomName) {
    var autoMarket = Memory.TangYuanLonelyCat && Memory.TangYuanLonelyCat.AutoMarket;
    if (!autoMarket) return false;
    
    var task = autoMarket.tasks && autoMarket.tasks[roomName];
    if (!task || !task.holding) return false;
    
    var holding = task.holding;
    var room = Game.rooms[roomName];
    
    if (!room || !room.terminal || room.terminal.cooldown > 0) {
        return false;
    }
    
    // 检查是否超时
    var holdTime = Game.time - holding.startTick;
    var maxHoldTime = (autoMarket.settings && autoMarket.settings.maxHoldTime) || 5000;
    
    if (holdTime > maxHoldTime) {
        console.log('[AutoMarket] ⚠️ ' + roomName + ': 持有超时，强制寻找出售机会');
    }
    
    // 获取当前资源存量
    var resourceAmount = room.terminal.store[holding.resourceType] || 0;
    if (resourceAmount <= 0) {
        task.holding = null;
        return false;
    }
    
    // 寻找可接受的卖单（价格 >= 买入价）
    var sellOrders = Game.market.getAllOrders({
        resourceType: holding.resourceType,
        type: ORDER_BUY
    });
    
    // 过滤有效订单
    var validOrders = [];
    for (var i = 0; i < sellOrders.length; i++) {
        var order = sellOrders[i];
        if (order.remainingAmount > 0 && order.price >= holding.buyPrice) {
            validOrders.push(order);
        }
    }
    
    if (validOrders.length === 0) {
        // 没有合适的卖单，继续持有
        return false;
    }
    
    // 按价格从高到低排序
    validOrders.sort(function(a, b) { return b.price - a.price; });
    var bestOrder = validOrders[0];
    
    // 计算可卖出量
    var maxSingleTrade = (autoMarket.settings && autoMarket.settings.maxSingleTrade) || 1000;
    var amount = Math.min(
        resourceAmount,
        bestOrder.remainingAmount,
        maxSingleTrade
    );
    
    if (amount <= 0) return false;
    
    // 获取能量价值
    var energyValue = autoMarket.settings.energyValue || 7;
    var minNetProfit = autoMarket.settings.minNetProfit || 500;
    
    // 计算能量成本
    var energyCost = _calculateEnergyCost(amount, roomName, bestOrder.roomName);
    var energyCostCredits = energyCost * energyValue;
    
    // 计算净利润
    var grossProfit = (bestOrder.price - holding.buyPrice) * amount;
    var netProfit = grossProfit - energyCostCredits;
    
    // 修改：净利润低于最低要求则放弃
    if (netProfit < minNetProfit) {
        return false;
    }
    
    if (room.terminal.store[RESOURCE_ENERGY] < energyCost) {
        console.log('[AutoMarket] ❌ ' + roomName + ': 能量不足，无法出售持有资源');
        return false;
    }
    
    // 执行卖出
    console.log('[AutoMarket] 🏷️ ' + roomName + ': 出售持有资源' + amount + ' ' + holding.resourceType + ' @' + bestOrder.price.toFixed(3));
    var result = Game.market.deal(bestOrder.id, amount, roomName);
    
    if (result === OK) {
        _recordProfit(roomName, netProfit, amount);
        
        console.log('[AutoMarket] ✅ ' + roomName + ': 持有资源出售成功! 净利润: ' + netProfit.toFixed(2));
        
        // 更新持有数量
        holding.amount -= amount;
        
        if (holding.amount <= 0) {
            task.holding = null;
        }
        
        return true;
    }
    
    return false;
}

/**
 * 清理已完成任务
 */
function _cleanupTasks() {
    var autoMarket = Memory.TangYuanLonelyCat && Memory.TangYuanLonelyCat.AutoMarket;
    if (!autoMarket || !autoMarket.tasks) return;
    
    var tasks = autoMarket.tasks;
    
    for (var roomName in tasks) {
        if (tasks.hasOwnProperty(roomName)) {
            var task = tasks[roomName];
            
            if (!task.active) {
                // 检查是否还有持有资源
                if (task.holding) {
                    var room = Game.rooms[roomName];
                    var resourceAmount = 0;
                    if (room && room.terminal) {
                        resourceAmount = room.terminal.store[task.holding.resourceType] || 0;
                    }
                    
                    if (resourceAmount <= 0) {
                        delete tasks[roomName];
                    }
                } else {
                    delete tasks[roomName];
                }
            }
        }
    }
}

// ==================== 全局函数 ====================

/**
 * 全局函数：启动/停止自动套利
 * @param {string} roomName - 房间名
 * @param {string} resourceType - 资源类型（可选，不指定则自动寻找最佳）
 * @param {boolean} enable - 启用/禁用
 */
global.automarket = function(roomName, resourceType, enable) {
    _ensureMemory();
    
    var autoMarket = Memory.TangYuanLonelyCat.AutoMarket;
    
    var room = Game.rooms[roomName];
    if (!room || !room.terminal) {
        console.log('[AutoMarket] ❌ ' + roomName + ': 房间或终端不存在');
        return false;
    }
    
    var tasks = autoMarket.tasks;
    
    if (enable === false) {
        // 停止任务
        if (tasks && tasks[roomName]) {
            tasks[roomName].active = false;
            console.log('[AutoMarket] 🛑 ' + roomName + ': 自动套利已停止');
            return true;
        }
        return false;
    }
    
    // 启用任务
    tasks[roomName] = {
        active: true,
        resourceType: resourceType || 'auto', // 'auto'表示自动寻找最佳
        lastActionTick: Game.time,
        holding: null
    };
    
    console.log('[AutoMarket] ✅ ' + roomName + ': 自动套利已启动');
    console.log('[AutoMarket] 💰 信用点保障: ' + autoMarket.settings.minCredits);
    console.log('[AutoMarket] 📈 最低利润率: ' + ((autoMarket.settings.minProfitMargin - 1) * 100).toFixed(1) + '%');
    console.log('[AutoMarket] ⚡ 能量价值: ' + autoMarket.settings.energyValue + ' 信用点/单位');
    console.log('[AutoMarket] 💵 最低净利润: ' + autoMarket.settings.minNetProfit + ' 信用点');
    
    return true;
};

/**
 * 全局函数：显示套利统计
 */
global.automarketStats = function() {
    _ensureMemory();
    
    var autoMarket = Memory.TangYuanLonelyCat.AutoMarket;
    var stats = autoMarket.statistics;
    
    console.log('[AutoMarket] 📊 套利统计:');
    console.log('  总利润（净利润）: ' + stats.totalProfit.toFixed(2) + ' 信用点');
    console.log('  交易次数: ' + stats.tradesCount);
    console.log('  总交易量: ' + stats.totalVolume + ' 单位');
    console.log('  平均利润: ' + (stats.tradesCount > 0 ? (stats.totalProfit / stats.tradesCount).toFixed(2) : 0) + ' 信用点/次');
    
    return stats;
};

/**
 * 全局函数：显示当前套利机会（仅显示毛利，不扣除能量成本）
 * @param {string} resourceType - 可选资源类型
 */
global.automarketScan = function(resourceType) {
    _ensureMemory();
    
    console.log('[AutoMarket] 🔍 扫描最佳套利机会（仅显示毛利，未扣除能量成本）...');
    
    var bestArbitrage = null;
    var resources = resourceType ? [resourceType] : _getAllResourceTypes();
    
    for (var i = 0; i < resources.length; i++) {
        var resource = resources[i];
        // 不传入房间名，返回毛利版本
        var arbitrage = _analyzeResourceArbitrage(resource);
        if (arbitrage) {
            if (!bestArbitrage || arbitrage.expectedProfit > bestArbitrage.expectedProfit) {
                bestArbitrage = arbitrage;
            }
        }
    }
    
    if (bestArbitrage) {
        console.log('[AutoMarket] 🎯 最佳套利机会: ' + bestArbitrage.resourceType);
        console.log('  买入价格: ' + bestArbitrage.buyPrice.toFixed(3) + ' (' + bestArbitrage.buyRoom + ')');
        console.log('  卖出价格: ' + bestArbitrage.sellPrice.toFixed(3) + ' (' + bestArbitrage.sellRoom + ')');
        console.log('  利润率: ' + ((bestArbitrage.profitMargin - 1) * 100).toFixed(2) + '%');
        console.log('  预期毛利: ' + bestArbitrage.expectedProfit.toFixed(2) + ' 信用点');
        console.log('  最大数量: ' + bestArbitrage.maxAmount + ' 单位');
        console.log('  ⚠️ 实际净利润需扣除能量成本，请使用带房间名的扫描');
        return bestArbitrage;
    } else {
        console.log('[AutoMarket] ❌ 未找到合适的套利机会');
        return null;
    }
};

/**
 * 全局函数：显示帮助
 */
global.automarketHelp = function() {
    console.log('[AutoMarket] 📋 可用函数:');
    console.log('  automarket(roomName, resourceType, enable) - 启动/停止自动套利');
    console.log('  automarketStats() - 显示套利统计');
    console.log('  automarketScan([resourceType]) - 扫描套利机会（仅毛利）');
    console.log('  automarketHelp() - 显示此帮助');
    console.log('');
    console.log('[AutoMarket] ⚙️ 设置（可在代码中调整）:');
    var settings = Memory.TangYuanLonelyCat && 
                   Memory.TangYuanLonelyCat.AutoMarket && 
                   Memory.TangYuanLonelyCat.AutoMarket.settings;
    if (settings) {
        console.log('  最低信用点: ' + settings.minCredits);
        console.log('  最低利润率: ' + ((settings.minProfitMargin - 1) * 100).toFixed(1) + '%');
        console.log('  单次最大量: ' + settings.maxSingleTrade);
        console.log('  最大持有时间: ' + settings.maxHoldTime + 'tick');
        console.log('  能量价值: ' + settings.energyValue + ' 信用点/单位');
        console.log('  最低净利润: ' + settings.minNetProfit + ' 信用点');
    }
};

/**
 * 全局函数：强制出售持有资源
 */
global.automarketForceSell = function(roomName) {
    _ensureMemory();
    
    var autoMarket = Memory.TangYuanLonelyCat.AutoMarket;
    
    var task = autoMarket.tasks && autoMarket.tasks[roomName];
    if (!task || !task.holding) {
        console.log('[AutoMarket] ❌ ' + roomName + ': 没有持有资源');
        return false;
    }
    
    console.log('[AutoMarket] ⚠️ ' + roomName + ': 强制出售持有资源');
    
    // 以不低于成本价出售
    return _processHolding(roomName);
};

// ==================== 模块主接口 ====================

module.exports = {
    
    /**
     * 每 tick 执行的任务处理
     * @param {Room} room - 房间对象
     */
    run: function(room) {
        // 初始化内存
        _ensureMemory();
        
        // 检查房间是否有终端
        if (!room || !room.terminal) return;
        
        var roomName = room.name;
        var autoMarket = Memory.TangYuanLonelyCat.AutoMarket;
        var task = autoMarket.tasks && autoMarket.tasks[roomName];
        
        if (!task || !task.active) {
            return; // 该房间没有活跃任务
        }
        
        // 检查信用点保障
        if (!_checkCredits()) {
            console.log('[AutoMarket] ⚠️ ' + roomName + ': 信用点低于保障线，暂停套利');
            return;
        }
        
        // 清理任务
        _cleanupTasks();
        
        // 处理持有资源
        if (task.holding) {
            _processHolding(roomName);
            return;
        }
        
        // 寻找套利机会（传入房间名以计算能量成本）
        var arbitrage;
        
        if (task.resourceType === 'auto') {
            arbitrage = _findBestArbitrage(roomName);
        } else {
            arbitrage = _analyzeResourceArbitrage(task.resourceType, roomName);
        }
        
        if (!arbitrage) {
            // 没有套利机会
            return;
        }
        
        // 检查利润率（已有净利润检查，但可保留）
        var minMargin = autoMarket.settings.minProfitMargin;
        if (arbitrage.profitMargin < minMargin) {
            return;
        }
        
        // 执行套利
        _executeArbitrage(roomName, arbitrage);
    }
};