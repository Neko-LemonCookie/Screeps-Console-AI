/*
 * 角色：工厂管理
 * 根据优先级列表自动生产商品（Utrium bar最高，Purifier最低）
 * 无需配置，只要资源足够就开始生产
 * 注意：电池配方已移除（如需生产电池请手动操作）
 */

// 配方优先级列表（从高到低）
const RECIPES = [
    {
        name: 'Utrium bar',
        product: RESOURCE_UTRIUM_BAR,
        components: [
            { resource: RESOURCE_UTRIUM, amount: 500 },
            { resource: RESOURCE_ENERGY, amount: 200 }
        ],
        amount: 100
    },
    {
        name: 'Lemergium bar',
        product: RESOURCE_LEMERGIUM_BAR,
        components: [
            { resource: RESOURCE_LEMERGIUM, amount: 500 },
            { resource: RESOURCE_ENERGY, amount: 200 }
        ],
        amount: 100
    },
    {
        name: 'Zynthium bar',
        product: RESOURCE_ZYNTHIUM_BAR,
        components: [
            { resource: RESOURCE_ZYNTHIUM, amount: 500 },
            { resource: RESOURCE_ENERGY, amount: 200 }
        ],
        amount: 100
    },
    {
        name: 'Keanium bar',
        product: RESOURCE_KEANIUM_BAR,
        components: [
            { resource: RESOURCE_KEANIUM, amount: 500 },
            { resource: RESOURCE_ENERGY, amount: 200 }
        ],
        amount: 100
    },
    {
        name: 'Ghodium melt',
        product: RESOURCE_GHODIUM_MELT,
        components: [
            { resource: RESOURCE_GHODIUM, amount: 500 },
            { resource: RESOURCE_ENERGY, amount: 200 }
        ],
        amount: 100
    },
    {
        name: 'Oxidant',
        product: RESOURCE_OXIDANT,
        components: [
            { resource: RESOURCE_OXYGEN, amount: 500 },
            { resource: RESOURCE_ENERGY, amount: 200 }
        ],
        amount: 100
    },
    {
        name: 'Reductant',
        product: RESOURCE_REDUCTANT,
        components: [
            { resource: RESOURCE_HYDROGEN, amount: 500 },
            { resource: RESOURCE_ENERGY, amount: 200 }
        ],
        amount: 100
    },
    {
        name: 'Purifier',
        product: RESOURCE_PURIFIER,
        components: [
            { resource: RESOURCE_CATALYST, amount: 500 },
            { resource: RESOURCE_ENERGY, amount: 200 }
        ],
        amount: 100
    }
];

/**
 * 检查工厂是否有足够的资源启动某个配方
 * @param {StructureFactory} factory 工厂对象
 * @param {Array} components 资源需求列表
 * @returns {boolean}
 */
function hasEnoughResources(factory, components) {
    for (var i = 0; i < components.length; i++) {
        var comp = components[i];
        if (factory.store.getUsedCapacity(comp.resource) < comp.amount) {
            return false;
        }
    }
    return true;
}

/**
 * 工厂主管理函数
 * @param {Room} room 房间对象
 */
function run(room) {
    // 获取房间内所有属于你的工厂
    var factories = room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_FACTORY }
    });

    for (var i = 0; i < factories.length; i++) {
        var factory = factories[i];

        // 如果工厂正在生产或处于冷却中，跳过
        if (factory.production || factory.cooldown > 0) {
            continue;
        }

        // 按优先级顺序尝试每个配方
        for (var j = 0; j < RECIPES.length; j++) {
            var recipe = RECIPES[j];

            if (hasEnoughResources(factory, recipe.components)) {
                var result = factory.produce(recipe.product);

                if (result === OK) {
                    console.log('[' + room.name + '] 工厂开始生产 ' + recipe.name + ' x' + recipe.amount);
                    break; // 成功启动一个生产，跳出内层循环
                } else {
                    console.log('[' + room.name + '] 工厂生产 ' + recipe.name + ' 失败，错误码：' + result);
                    break;
                }
            }
        }
    }
}

module.exports = {
    run: run
};