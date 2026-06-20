/**
 * lib.AP.taskHelper.js
 * Creep 任务执行通用工具函数。
 * 提取各 task.creep.*.js 中重复的 _completeTask 逻辑，消除代码冗余。
 */

const taskboard = require('lib.AP.taskboard');

const libAPTaskHelper = {
    /**
     * 任务完成并自清理（统一实现）
     * 原本在 12 个 task.creep.*.js 文件中各自重复定义
     * @param {Creep} creep
     */
    completeTask: function(creep) {
        const taskRoom = creep.memory.taskRoom || creep.room.name;
        taskboard.removeTask(taskRoom, 'Creeps', creep.name);

        creep.memory.taskType = null;
        creep.memory.taskData = null;
        creep.memory.taskRoom = null;
        creep.memory.working = false;
    }
};

module.exports = libAPTaskHelper;
