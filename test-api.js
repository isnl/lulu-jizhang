// 测试API功能的脚本
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();
const PORT = 3001; // 使用不同端口避免冲突

// 模拟数据存储
let records = [
  {
    _id: '1',
    type: '支出',
    category: '学习',
    amount: 100,
    date: new Date('2024-01-15'),
    remark: '测试记录1',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: '2',
    type: '支出',
    category: '娱乐',
    amount: 200,
    date: new Date('2024-01-20'),
    remark: '测试记录2',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: '3',
    type: '收入',
    category: '主业',
    amount: 5000,
    date: new Date('2024-02-01'),
    remark: '测试收入',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

let nextId = 4;

// 中间件
app.use(cors());
app.use(express.json());

// 创建新记录
app.post('/api/records', (req, res) => {
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
    const record = {
      _id: String(nextId++),
      type,
      category,
      amount: numAmount,
      date: recordDate,
      remark: remark || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    records.push(record);
    
    res.status(201).json({
      success: true,
      message: '记录创建成功',
      data: record
    });
  } catch (error) {
    console.error('创建记录失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 按月获取记录统计
app.get('/api/records', (req, res) => {
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
      return getDailyRecordsTest(startDate, endDate, res);
    } else {
      // 多月查询：返回每月汇总
      return getMonthlyRecordsTest(startDate, endDate, res);
    }

    // 过滤记录
    const filteredRecords = records.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= startDate && recordDate < endDate;
    });


  } catch (error) {
    console.error('获取记录统计失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 前端路由处理
app.get(['/', '/records', '/add-record'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 获取每日记录明细（单月查询）
function getDailyRecordsTest(startDate, endDate, res) {
  // 过滤记录
  const filteredRecords = records.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate >= startDate && recordDate < endDate;
  });

  // 生成完整的日期列表
  const allDates = [];
  const current = new Date(startDate);
  while (current < endDate) {
    const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    allDates.push(dateKey);
    current.setDate(current.getDate() + 1);
  }

  // 按日期和分类分组统计
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
  filteredRecords.forEach(record => {
    const recordDate = new Date(record.date);
    const dateKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;

    if (dailyData[dateKey]) {
      dailyData[dateKey][record.category] += record.amount;
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
}

// 获取每月汇总记录（多月查询）
function getMonthlyRecordsTest(startDate, endDate, res) {
  // 过滤记录
  const filteredRecords = records.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate >= startDate && recordDate < endDate;
  });

  // 生成完整的月份列表
  const allMonths = [];
  const current = new Date(startDate);
  while (current < endDate) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    allMonths.push(monthKey);
    current.setMonth(current.getMonth() + 1);
  }

  // 按月份和分类分组统计
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
  filteredRecords.forEach(record => {
    const recordDate = new Date(record.date);
    const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;

    if (monthlyData[monthKey]) {
      monthlyData[monthKey][record.category] += record.amount;
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
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`测试服务器运行在 http://localhost:${PORT}`);
  console.log('使用内存数据，无需MongoDB连接');
});
