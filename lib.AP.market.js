/**
 * lib.AP.market.js
 * 负责提供基础市场操作 API：买入、卖出（含挂单）、跨房间运输。
 */

const libAPMarket = {
    /**
     * 立即从市场买入资源
     * @param {string} roomName 执行交易的房间
     * @param {string} resourceType 资源类型
     * @param {number} amount 数量
     */
    marketBuy: function(roomName, resourceType, amount) {
        const room = Game.rooms[roomName];
        if (!room || !room.terminal || room.terminal.cooldown > 0) return ERR_BUSY;

        const sellOrders = Game.market.getAllOrders({ resourceType: resourceType, type: ORDER_SELL });
        if (sellOrders.length === 0) return ERR_NOT_FOUND;

        // 寻找价格最低的卖单
        sellOrders.sort((a, b) => a.price - b.price);
        const bestOrder = sellOrders[0];
        
        const buyAmount = Math.min(amount, bestOrder.remainingAmount);
        const energyCost = Game.market.calcTransactionCost(buyAmount, roomName, bestOrder.roomName);

        if (room.terminal.store[RESOURCE_ENERGY] < energyCost) return ERR_NOT_ENOUGH_ENERGY;
        if (Game.market.credits < buyAmount * bestOrder.price) return ERR_NOT_ENOUGH_RESOURCES;

        const result = Game.market.deal(bestOrder.id, buyAmount, roomName);
        if (result === OK) {
            console.log("[Market] 🛒 " + roomName + " 买入 " + buyAmount + " " + resourceType + " @ " + bestOrder.price);
        }
        return result;
    },

    /**
     * 售卖资源
     * @param {string} roomName 执行交易的房间
     * @param {string} resourceType 资源类型
     * @param {number} amount 数量
     * @param {boolean} useOrder 是否使用挂单模式
     */
    marketSell: function(roomName, resourceType, amount, useOrder) {
        const room = Game.rooms[roomName];
        if (!room || !room.terminal) return ERR_INVALID_TARGET;
        
        const stock = room.terminal.store[resourceType] || 0;
        const sellAmount = Math.min(amount, stock);
        if (sellAmount <= 0) return ERR_NOT_ENOUGH_RESOURCES;

        if (useOrder) {
            // 挂单模式：取市场中间价
            return this._createSellOrder(roomName, resourceType, sellAmount);
        } else {
            // 立即成交模式：找最高买单
            if (room.terminal.cooldown > 0) return ERR_BUSY;
            const buyOrders = Game.market.getAllOrders({ resourceType: resourceType, type: ORDER_BUY });
            if (buyOrders.length === 0) return ERR_NOT_FOUND;

            buyOrders.sort((a, b) => b.price - a.price);
            const bestOrder = buyOrders[0];
            const dealAmount = Math.min(sellAmount, bestOrder.remainingAmount);
            const energyCost = Game.market.calcTransactionCost(dealAmount, roomName, bestOrder.roomName);

            if (room.terminal.store[RESOURCE_ENERGY] < energyCost) return ERR_NOT_ENOUGH_ENERGY;

            const result = Game.market.deal(bestOrder.id, dealAmount, roomName);
            if (result === OK) {
                console.log("[Market] 💰 " + roomName + " 立即售出 " + dealAmount + " " + resourceType + " @ " + bestOrder.price);
            }
            return result;
        }
    },

    /**
     * 跨房间运输能量/资源
     * @param {string} fromRoom 起始房间
     * @param {string} toRoom 终点房间
     * @param {string} resourceType 资源类型
     * @param {number} amount 数量
     */
    transport: function(fromRoom, toRoom, resourceType, amount) {
        const room = Game.rooms[fromRoom];
        if (!room || !room.terminal || room.terminal.cooldown > 0) return ERR_BUSY;

        const stock = room.terminal.store[resourceType] || 0;
        const sendAmount = Math.min(amount, stock);
        if (sendAmount <= 0) return ERR_NOT_ENOUGH_RESOURCES;

        const energyCost = Game.market.calcTransactionCost(sendAmount, fromRoom, toRoom);
        // 如果运送的是能量，成本要额外扣除
        const requiredEnergy = (resourceType === RESOURCE_ENERGY) ? sendAmount + energyCost : energyCost;

        if (room.terminal.store[RESOURCE_ENERGY] < requiredEnergy) return ERR_NOT_ENOUGH_ENERGY;

        const result = room.terminal.send(resourceType, sendAmount, toRoom);
        if (result === OK) {
            console.log("[Market] 🚚 " + fromRoom + " -> " + toRoom + " 运输 " + sendAmount + " " + resourceType);
        }
        return result;
    },

    /**
     * 创建挂单 (取市场中间价)
     * @private
     */
    _createSellOrder: function(roomName, resourceType, amount) {
        // 检查是否已有相同资源的挂单
        const existingOrders = _.filter(Game.market.orders, o => o.roomName === roomName && o.resourceType === resourceType && o.type === ORDER_SELL);
        if (existingOrders.length > 0) return ERR_NAME_EXISTS;

        // 获取全服订单计算中间价
        const allOrders = Game.market.getAllOrders({ resourceType: resourceType, type: ORDER_SELL });
        let price = 0.1; // 默认极低价
        if (allOrders.length > 0) {
            allOrders.sort((a, b) => a.price - b.price);
            // 取中位数价格
            price = allOrders[Math.floor(allOrders.length / 2)].price;
        }

        const result = Game.market.createOrder({
            type: ORDER_SELL,
            resourceType: resourceType,
            price: price,
            totalAmount: amount,
            roomName: roomName
        });

        if (result === OK) {
            console.log("[Market] 📝 " + roomName + " 创建挂单: " + amount + " " + resourceType + " @ " + price);
        }
        return result;
    }
};

module.exports = libAPMarket;
