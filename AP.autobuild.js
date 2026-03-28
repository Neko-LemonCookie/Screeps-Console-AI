/**
 * AP.autobuild.js
 * 自动建筑控制模块。
 * 负责遍历所有拥有的房间，并调用 tempbuild 库进行基建、外围建设及提取器生成。
 */

const tempbuild = require('lib.AP.tempbuild');

const APAutobuild = {
    run: function() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            
            if (room.controller && room.controller.my) {
                this._runRoom(room);
            }
        }
    },

    _runRoom: function(room) {
        const rcl = room.controller.level;
        if (!room.memory.autobuild) {
            room.memory.autobuild = {
                outerTriggered: false,
                extractorTriggered: false,
                lastDefenseCheck: 0
            };
        }

        if (tempbuild.runCityCenter(room.name)) return;

        if (rcl >= 4 && !room.memory.autobuild.outerTriggered) {
            if (tempbuild.runOuterStructures(room.name)) {
            } else {
                room.memory.autobuild.outerTriggered = true;
            }
        }

        if (rcl >= 6 && !room.memory.autobuild.extractorTriggered) {
            if (this._buildExtractor(room)) {
                room.memory.autobuild.extractorTriggered = true;
            }
        }

        this._repairOuterStructures(room);
    },

    _buildExtractor: function(room) {
        const minerals = room.find(FIND_MINERALS);
        if (minerals.length === 0) return true;
        const mineral = minerals[0];
        
        const structures = mineral.pos.lookFor(LOOK_STRUCTURES);
        if (structures.some(s => s.structureType === STRUCTURE_EXTRACTOR)) return true;
        
        const sites = mineral.pos.lookFor(LOOK_CONSTRUCTION_SITES);
        if (sites.some(s => s.structureType === STRUCTURE_EXTRACTOR)) return true;

        return mineral.pos.createConstructionSite(STRUCTURE_EXTRACTOR) === OK;
    },

    _repairOuterStructures: function(room) {
        if (!room.memory.cityCenter) return;
        const center = room.memory.cityCenter;
        const isCore = room.memory.layoutType === '9x9';
        const radius = isCore ? 4 : 2;

        const structures = room.find(FIND_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_ROAD || 
                           s.structureType === STRUCTURE_CONTAINER ||
                           s.structureType === STRUCTURE_WALL ||
                           s.structureType === STRUCTURE_RAMPART)
        });

        if (!room.memory.autobuild.outerPositions) room.memory.autobuild.outerPositions = {};

        for (const s of structures) {
            const dx = Math.abs(s.pos.x - center.x);
            const dy = Math.abs(s.pos.y - center.y);
            if (dx <= radius && dy <= radius) continue;

            const posKey = s.pos.x + "," + s.pos.y;
            if (!room.memory.autobuild.outerPositions[posKey]) {
                room.memory.autobuild.outerPositions[posKey] = s.structureType;
            }
        }

        if (Game.time % 500 === 0) {
            let siteCount = 0;
            for (const posKey in room.memory.autobuild.outerPositions) {
                const type = room.memory.autobuild.outerPositions[posKey];
                const parts = posKey.split(',');
                const x = parseInt(parts[0]);
                const y = parseInt(parts[1]);
                const pos = new RoomPosition(x, y, room.name);
                
                if (pos.lookFor(LOOK_STRUCTURES).length === 0 && pos.lookFor(LOOK_CONSTRUCTION_SITES).length === 0) {
                    if (pos.createConstructionSite(type) === OK) {
                        siteCount++;
                        if (siteCount >= 10) break;
                    }
                }
            }
        }
    }
};

module.exports = APAutobuild;
