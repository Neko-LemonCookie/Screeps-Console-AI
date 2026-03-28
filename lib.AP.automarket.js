/**
 * lib.AP.automarket.js
 * 自动市场套利库。
 * 仅保留纯自动套利逻辑，简化 API。
 */

const libAPAutomarket = {
    /**
     * 获取所有有效的资源类型
     * @private
     */
    _getAllResourceTypes: function() {
        return [
            "energy", "H", "O", "Z", "U", "K", "L", "X",
            "utrium", "lemergium", "zynthium", "keanium", "ghodium",
            "oxidant", "reductant", "purifier", "battery",
            "composite", "crystal", "liquid"
        ];
    },

    /**
     * 运行自动套利循环
     * @param {string} roomName 执行交易的房间名（必须拥有 Terminal）
     */
    run: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room || !room.terminal || room.terminal.cooldown > 0) return;

        // 优先检查并处理已买入的套利库存
        if (this._handleExistingStock(room)) return;

        // 检查信用点是否充足
        if (Game.market.credits < Memory.AutoMarket.settings.minCredits) return;

        // CPU 优化：使用全局缓存，每 N tick 重新扫描一次
        if (!global.autoMarketCache || Game.time >= global.autoMarketCache.expiry) {
            this._refreshArbitrageCache(roomName);
        }

        const bestDeal = global.autoMarketCache.bestDeal;
        if (bestDeal) {
            this._executeTrade(roomName, bestDeal);
        }
    },

    /**
     * 处理现有的套利库存（卖出操作）
     * @private
     */
    _handleExistingStock: function(room) {
        const terminal = room.terminal;
        for (const resourceType in terminal.store) {
            if (resourceType === RESOURCE_ENERGY) continue;
            
            const amount = terminal.store[resourceType];
            if (amount <= 0) continue;

            const buyOrders = Game.market.getAllOrders({ resourceType: resourceType, type: ORDER_BUY });
            const validBuy = buyOrders.filter(o => o.remainingAmount > 0).sort((a, b) => b.price - a.price);

            if (validBuy.length > 0) {
                const bestBuy = validBuy[0];
                const sellAmount = Math.min(amount, bestBuy.remainingAmount);
                const result = Game.market.deal(bestBuy.id, sellAmount, room.name);
                if (result === OK) {
                    global.autoMarketCache = { bestDeal: null, expiry: 0 }; // 清除缓存强制刷新
                    return true;
                }
            }
        }
        return false;
    },

    /**
     * 刷新套利机会缓存
     * @private
     */
    _refreshArbitrageCache: function(roomName) {
        let bestDeal = null;
        let maxNetProfit = 0;
        const resources = this._getAllResourceTypes();
        const settings = Memory.AutoMarket.settings;

        for (let i = 0; i < resources.length; i++) {
            const resource = resources[i];
            const deal = this._analyzeResource(resource, roomName, settings);
            if (deal && deal.netProfit > maxNetProfit) {
                maxNetProfit = deal.netProfit;
                bestDeal = deal;
            }
        }

        global.autoMarketCache = {
            bestDeal: bestDeal,
            expiry: Game.time + settings.scanInterval
        };
    },

    /**
     * 分析单个资源的套利潜力
     * @private
     */
    _analyzeResource: function(resourceType, roomName, settings) {
        const buyOrders = Game.market.getAllOrders({ resourceType: resourceType, type: ORDER_BUY });
        const sellOrders = Game.market.getAllOrders({ resourceType: resourceType, type: ORDER_SELL });

        if (buyOrders.length === 0 || sellOrders.length === 0) return null;

        const bestBuy = buyOrders.filter(o => o.remainingAmount > 0).sort((a, b) => b.price - a.price)[0];
        const bestSell = sellOrders.filter(o => o.remainingAmount > 0).sort((a, b) => a.price - b.price)[0];

        if (!bestBuy || !bestSell) return null;
        if (bestBuy.price <= bestSell.price) return null;
        if (bestBuy.price / bestSell.price < settings.minProfitMargin) return null;

        const amount = Math.min(bestSell.remainingAmount, bestBuy.remainingAmount, settings.maxSingleTrade);
        const totalEnergyCost = Game.market.calcTransactionCost(amount, roomName, bestSell.roomName) + 
                                Game.market.calcTransactionCost(amount, roomName, bestBuy.roomName);

        if (Game.rooms[roomName].terminal.store[RESOURCE_ENERGY] < totalEnergyCost) return null;

        const netProfit = (bestBuy.price - bestSell.price) * amount - (totalEnergyCost * settings.energyValue);
        if (netProfit <= 0) return null;

        return { resourceType: resourceType, buyOrder: bestSell, sellOrder: bestBuy, amount: amount, netProfit: netProfit };
    },

    /**
     * 执行套利交易
     * @private
     */
    _executeTrade: function(roomName, deal) {
        const result = Game.market.deal(deal.buyOrder.id, deal.amount, roomName);
        if (result === OK) {
            Memory.AutoMarket.statistics.tradesCount++;
            Memory.AutoMarket.statistics.totalProfit += deal.netProfit;
            global.autoMarketCache.expiry = 0;
        }
    }
};

module.exports = libAPAutomarket;
