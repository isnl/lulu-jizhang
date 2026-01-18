const Record = require('./Record Model');
const config = require('./config');

// 创建新记录
exports.createRecord = async (req, res) => {
  try {
    const { type, category, amount, date, remark } = req.body;

    // 输入验证
    if (!type || !category || amount === undefined || !date) {
      return res.status(400).json({
        error: '缺少必填字段：类型、分类、金额、日期'
      });
    }

    // 验证类型
    if (!config.recordTypes.includes(type)) {
      return res.status(400).json({
        error: `无效的记录类型：${type}`
      });
    }

    // 验证分类
    if (!config.categories.includes(category)) {
      return res.status(400).json({
        error: `无效的分类：${category}`
      });
    }

    // 验证金额
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < config.validation.amount.min || numAmount > config.validation.amount.max) {
      return res.status(400).json({
        error: `金额必须是${config.validation.amount.min}到${config.validation.amount.max}之间的数字`
      });
    }

    // 验证日期
    const recordDate = new Date(date);
    if (isNaN(recordDate.getTime())) {
      return res.status(400).json({
        error: '无效的日期格式'
      });
    }

    // 创建记录
    const record = new Record({
      type,
      category,
      amount: numAmount,
      date: recordDate,
      remark: remark || ''
    });

    await record.save();
    res.status(201).json({
      success: true,
      message: '记录创建成功',
      data: record
    });
  } catch (error) {
    console.error('创建记录失败:', error);

    // 处理Mongoose验证错误
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: '数据验证失败：' + messages.join(', ')
      });
    }

    // 处理重复键错误
    if (error.code === 11000) {
      return res.status(400).json({
        error: '记录已存在'
      });
    }

    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 批量创建记录
exports.createBatchRecords = async (req, res) => {
  try {
    const records = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: '请求体必须是数组' });
    }

    if (records.length === 0) {
      return res.status(200).json({ count: 0, message: '没有记录需要导入' });
    }

    // 验证并过滤有效记录
    const validRecords = [];
    const errors = [];

    for (const item of records) {
      // 简单验证
      if (!item.type || !item.category || item.amount === undefined || !item.date) {
        errors.push(`记录缺失必填字段: ${JSON.stringify(item)}`);
        continue;
      }

      // 验证日期对象
      const recordDate = new Date(item.date);
      if (isNaN(recordDate.getTime())) {
        errors.push(`无效日期: ${item.date}`);
        continue;
      }

      validRecords.push({
        type: item.type,
        category: item.category,
        amount: parseFloat(item.amount),
        date: recordDate,
        remark: item.remark || ''
      });
    }

    if (validRecords.length === 0) {
      return res.status(400).json({ error: '所有记录都无效', details: errors });
    }

    // 批量插入
    await Record.insertMany(validRecords);

    res.status(201).json({
      success: true,
      count: validRecords.length,
      message: `成功导入 ${validRecords.length} 条记录`,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('批量导入失败:', error);
    res.status(500).json({ error: '批量导入失败: ' + error.message });
  }
};

// 代理转发：接收前端上传的PDF，转发给本地Python服务解析
exports.parseBillProxy = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    // 1. 构建转发给 Python 服务的表单数据
    // 注意: 这里需要 Node.js v18+ 支持原生 FormData 和 Blob
    // 如果是旧版本 Node，可能需要 'form-data' 和 'node-fetch' 库
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    const formData = new FormData();
    formData.append('file', blob, req.file.originalname);

    // 2. 调用本地 Python 服务 (走内网 localhost:5000)
    // 这样 Python 服务不需要暴露在公网
    const pythonServiceUrl = 'http://localhost:5000/api/upload';

    console.log(`[代理] 正在转发文件 ${req.file.originalname} 到 ${pythonServiceUrl}`);

    const response = await fetch(pythonServiceUrl, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Python服务响应错误: ${response.status} ${response.statusText}`);
    }

    // 3. 将 Python 返回的结果直接透传给前端
    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('代理解析失败:', error);
    // 友好的错误提示
    let msg = '解析服务暂时不可用';
    if (error.cause && error.cause.code === 'ECONNREFUSED') {
      msg = '后台解析服务(Python)未启动，请联系管理员';
    }
    res.status(503).json({ error: msg, details: error.message });
  }
};

// 按月获取记录统计 - 每天的账目情况
exports.getRecords = async (req, res) => {
  try {
    const { startMonth, endMonth } = req.query;

    // 输入验证
    if (!startMonth || !endMonth) {
      return res.status(400).json({
        error: '请提供开始月份(startMonth)和结束月份(endMonth)参数'
      });
    }

    // 验证日期格式 (YYYY-MM)
    if (!config.validation.monthFormat.test(startMonth) || !config.validation.monthFormat.test(endMonth)) {
      return res.status(400).json({
        error: '日期格式错误，请使用YYYY-MM格式'
      });
    }

    const startDate = new Date(startMonth + '-01');
    const endDate = new Date(endMonth + '-01');
    endDate.setMonth(endDate.getMonth() + 1);

    // 验证日期有效性
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        error: '无效的日期'
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        error: '开始月份不能晚于结束月份'
      });
    }

    // 判断是单月查询还是多月查询
    const startYear = parseInt(startMonth.split('-')[0]);
    const startMonthNum = parseInt(startMonth.split('-')[1]);
    const endYear = parseInt(endMonth.split('-')[0]);
    const endMonthNum = parseInt(endMonth.split('-')[1]);

    const isSingleMonth = (startYear === endYear && startMonthNum === endMonthNum);

    if (isSingleMonth) {
      // 单月查询：返回每日明细
      return await getDailyRecords(startDate, endDate, res);
    } else {
      // 多月查询：返回每月汇总
      return await getMonthlyRecords(startDate, endDate, res);
    }


  } catch (error) {
    console.error('获取记录统计失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取每日记录明细（单月查询）
async function getDailyRecords(startDate, endDate, res) {
  try {
    // 聚合查询：按日期和分类分组统计
    const records = await Record.aggregate([
      {
        $match: {
          date: {
            $gte: startDate,
            $lt: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            day: { $dayOfMonth: '$date' },
            category: '$category'
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          year: '$_id.year',
          month: '$_id.month',
          day: '$_id.day',
          category: '$_id.category',
          totalAmount: 1,
          count: 1,
          _id: 0
        }
      },
      {
        $sort: { year: 1, month: 1, day: 1 }
      }
    ]);

    // 生成完整的日期列表
    const allDates = [];
    const current = new Date(startDate);
    while (current < endDate) {
      const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      allDates.push(dateKey);
      current.setDate(current.getDate() + 1);
    }

    // 按日期组织数据
    const dailyData = {};

    // 初始化所有日期
    allDates.forEach(dateKey => {
      dailyData[dateKey] = {
        date: dateKey,
        type: 'daily'
      };
      // 初始化所有分类为0
      config.categories.forEach(category => {
        dailyData[dateKey][category] = 0;
      });
    });

    // 填入实际数据
    records.forEach(record => {
      const dateKey = `${record.year}-${String(record.month).padStart(2, '0')}-${String(record.day).padStart(2, '0')}`;
      if (dailyData[dateKey]) {
        dailyData[dateKey][record.category] = record.totalAmount;
      }
    });

    // 转换为数组并计算每日总计
    const result = allDates.map(dateKey => {
      const dayData = dailyData[dateKey];
      const dailyTotal = config.categories.reduce((sum, category) => sum + (dayData[category] || 0), 0);

      return {
        ...dayData,
        日总计: dailyTotal
      };
    });

    res.json(result);
  } catch (error) {
    console.error('获取每日记录失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
}

// 获取每月汇总记录（多月查询）
async function getMonthlyRecords(startDate, endDate, res) {
  try {
    // 聚合查询：按月份和分类分组统计
    const records = await Record.aggregate([
      {
        $match: {
          date: {
            $gte: startDate,
            $lt: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            category: '$category'
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          year: '$_id.year',
          month: '$_id.month',
          category: '$_id.category',
          totalAmount: 1,
          count: 1,
          _id: 0
        }
      },
      {
        $sort: { year: 1, month: 1 }
      }
    ]);

    // 生成完整的月份列表
    const allMonths = [];
    const current = new Date(startDate);
    while (current < endDate) {
      const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      allMonths.push(monthKey);
      current.setMonth(current.getMonth() + 1);
    }

    // 按月份组织数据
    const monthlyData = {};

    // 初始化所有月份
    allMonths.forEach(monthKey => {
      monthlyData[monthKey] = {
        date: monthKey,
        type: 'monthly'
      };
      // 初始化所有分类为0
      config.categories.forEach(category => {
        monthlyData[monthKey][category] = 0;
      });
    });

    // 填入实际数据
    records.forEach(record => {
      const monthKey = `${record.year}-${String(record.month).padStart(2, '0')}`;
      if (monthlyData[monthKey]) {
        monthlyData[monthKey][record.category] = record.totalAmount;
      }
    });

    // 转换为数组并计算每月总计
    const result = allMonths.map(monthKey => {
      const monthData = monthlyData[monthKey];
      const monthlyTotal = config.categories.reduce((sum, category) => sum + (monthData[category] || 0), 0);

      return {
        ...monthData,
        月总计: monthlyTotal
      };
    });

    res.json(result);
  } catch (error) {
    console.error('获取每月记录失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
}

// 获取记录统计
exports.getRecordsSummary = async (_req, res) => {
  try {
    const summary = await Record.aggregate([
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
