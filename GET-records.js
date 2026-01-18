const express = require('express');
const router = express.Router();
const recordController = require('./RecordController');

const multer = require('multer');
// 配置内存存储，不写入磁盘，直接转发
const upload = multer({ storage: multer.memoryStorage() });

// 创建新记录
router.post('/records', recordController.createRecord);

// 批量导入记录
router.post('/records/batch', recordController.createBatchRecords);

// 代理PDF解析 (接收文件 -> 转发Python -> 返回JSON)
router.post('/bill/parse-pdf', upload.single('file'), recordController.parseBillProxy);

// 获取记录列表
router.get('/records', recordController.getRecords);

// 获取统计信息
router.get('/records/summary', recordController.getRecordsSummary);

module.exports = router;
