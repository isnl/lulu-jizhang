// DOM元素
const recordForm = document.getElementById('recordForm');
const filterForm = document.getElementById('filterForm');
const recordsTable = document.getElementById('recordsTable').querySelector('tbody');
const startMonthInput = document.getElementById('startMonth');
const endMonthInput = document.getElementById('endMonth');

// 创建消息提示容器
function createMessageContainer() {
  if (!document.getElementById('messageContainer')) {
    const container = document.createElement('div');
    container.id = 'messageContainer';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      max-width: 400px;
    `;
    document.body.appendChild(container);
  }
}

// 显示消息
function showMessage(message, type = 'info') {
  createMessageContainer();
  const container = document.getElementById('messageContainer');

  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    padding: 12px 16px;
    margin-bottom: 10px;
    border-radius: 4px;
    color: white;
    font-weight: bold;
    opacity: 0;
    transition: opacity 0.3s ease;
    background-color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
  `;
  messageDiv.textContent = message;

  container.appendChild(messageDiv);

  // 淡入效果
  setTimeout(() => {
    messageDiv.style.opacity = '1';
  }, 10);

  // 自动移除
  setTimeout(() => {
    messageDiv.style.opacity = '0';
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 300);
  }, 3000);
}

// 显示加载状态
function showLoading(show = true) {
  const existingLoader = document.getElementById('loadingOverlay');

  if (show && !existingLoader) {
    const loader = document.createElement('div');
    loader.id = 'loadingOverlay';
    loader.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    `;
    loader.innerHTML = `
      <div style="
        background: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
      ">
        <div style="
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 2s linear infinite;
          margin: 0 auto 10px;
        "></div>
        <div>加载中...</div>
      </div>
    `;
    document.body.appendChild(loader);

    // 添加旋转动画
    if (!document.getElementById('spinAnimation')) {
      const style = document.createElement('style');
      style.id = 'spinAnimation';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  } else if (!show && existingLoader) {
    existingLoader.remove();
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  try {
    // 设置默认月份为当前月
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const currentDate = now.toISOString().split('T')[0];

    startMonthInput.value = currentMonth;
    endMonthInput.value = currentMonth;
    document.getElementById('date').value = currentDate;

    loadRecords();
  } catch (error) {
    console.error('初始化失败:', error);
    showMessage('初始化失败，请刷新页面重试', 'error');
  }
});

// 添加记录
recordForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(recordForm);
  const data = {
    type: formData.get('type'),
    category: formData.get('category'),
    amount: parseFloat(formData.get('amount')),
    date: formData.get('date'),
    remark: formData.get('remark')
  };

  // 前端验证
  if (!data.type || !data.category || isNaN(data.amount) || !data.date) {
    showMessage('请填写所有必填字段', 'error');
    return;
  }

  if (data.amount <= 0) {
    showMessage('金额必须大于0', 'error');
    return;
  }

  try {
    showLoading(true);

    const response = await fetch('/api/records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || '添加记录失败');
    }

    recordForm.reset();
    // 重新设置日期为今天
    document.getElementById('date').value = new Date().toISOString().split('T')[0];

    loadRecords();
    showMessage('记录添加成功', 'success');
  } catch (error) {
    console.error('添加记录失败:', error);
    showMessage(error.message || '添加记录时出错', 'error');
  } finally {
    showLoading(false);
  }
});

// 查询记录
filterForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loadRecords();
});

// 加载记录
async function loadRecords() {
  try {
    const startMonth = document.getElementById('startMonth').value;
    const endMonth = document.getElementById('endMonth').value;

    // 验证输入
    if (!startMonth || !endMonth) {
      showMessage('请选择开始和结束月份', 'error');
      return;
    }

    if (startMonth > endMonth) {
      showMessage('开始月份不能晚于结束月份', 'error');
      return;
    }

    showLoading(true);

    const response = await fetch(`/api/records?startMonth=${startMonth}&endMonth=${endMonth}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || '获取记录失败');
    }

    renderRecords(result);
  } catch (error) {
    console.error('获取记录失败:', error);
    showMessage(error.message || '获取记录时出错', 'error');
    // 显示空表格
    renderRecords([]);
  } finally {
    showLoading(false);
  }
}

// 渲染记录 - 智能显示模式
function renderRecords(records) {
  recordsTable.innerHTML = '';

  if (!records || records.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="11" style="text-align: center; color: #999;">暂无数据</td>';
    recordsTable.appendChild(emptyRow);
    return;
  }

  // 判断是每日显示还是每月显示
  const isDaily = records.length > 0 && records[0].type === 'daily';
  const isMonthly = records.length > 0 && records[0].type === 'monthly';

  if (isDaily) {
    renderDailyRecords(records);
  } else if (isMonthly) {
    renderMonthlyRecords(records);
  } else {
    // 兼容旧格式，默认按日显示
    renderDailyRecords(records);
  }
}

// 渲染每日记录
function renderDailyRecords(records) {
  // 更新表头
  updateTableHeader('daily');

  // 分类列表
  const categories = ['学习', '娱乐', '美妆', '日用', '服饰', '人情', '还贷', '主业', '副业'];

  // 计算总计
  const totals = { 日总计: 0 };
  categories.forEach(cat => {
    totals[cat] = 0;
  });

  records.forEach(dayData => {
    const row = document.createElement('tr');

    // 格式化日期显示
    const date = new Date(dayData.date);
    const formattedDate = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

    // 构建行HTML
    let rowHTML = `<td style="font-weight: bold; background-color: #f9f9f9;">${formattedDate}</td>`;

    // 添加各分类的金额
    categories.forEach(category => {
      const amount = dayData[category] || 0;
      totals[category] += amount;

      // 如果金额大于0，显示金额，否则显示空
      const displayAmount = amount > 0 ? amount.toFixed(2) : '';
      const cellStyle = amount > 0 ? 'text-align: right; font-weight: bold;' : 'text-align: center; color: #ccc;';

      rowHTML += `<td style="${cellStyle}">${displayAmount}</td>`;
    });

    // 添加日总计
    const dailyTotal = dayData.日总计 || 0;
    totals.日总计 += dailyTotal;
    const totalStyle = dailyTotal > 0 ? 'text-align: right; font-weight: bold; background-color: #e3f2fd;' : 'text-align: center; color: #ccc;';
    const displayTotal = dailyTotal > 0 ? dailyTotal.toFixed(2) : '';
    rowHTML += `<td style="${totalStyle}">${displayTotal}</td>`;

    row.innerHTML = rowHTML;

    // 如果当天有支出，设置行的背景色
    if (dailyTotal > 0) {
      row.style.backgroundColor = '#fafafa';
    }

    recordsTable.appendChild(row);
  });

  // 总计行
  const totalRow = document.createElement('tr');
  let totalRowHTML = '<td style="font-weight: bold; background-color: #e0e0e0; text-align: center;">总计</td>';

  categories.forEach(category => {
    const total = totals[category];
    const displayTotal = total > 0 ? total.toFixed(2) : '0.00';
    totalRowHTML += `<td style="text-align: right; font-weight: bold; background-color: #e0e0e0;">${displayTotal}</td>`;
  });

  // 总计的总计
  const grandTotal = totals.日总计;
  totalRowHTML += `<td style="text-align: right; font-weight: bold; background-color: #d0d0d0; font-size: 16px;">${grandTotal.toFixed(2)}</td>`;

  totalRow.innerHTML = totalRowHTML;
  totalRow.style.borderTop = '2px solid #999';
  recordsTable.appendChild(totalRow);
}

// 渲染每月记录
function renderMonthlyRecords(records) {
  // 更新表头
  updateTableHeader('monthly');

  // 分类列表
  const categories = ['学习', '娱乐', '美妆', '日用', '服饰', '人情', '还贷', '主业', '副业'];

  // 计算总计
  const totals = { 月总计: 0 };
  categories.forEach(cat => {
    totals[cat] = 0;
  });

  records.forEach(monthData => {
    const row = document.createElement('tr');

    // 格式化月份显示
    const [year, month] = monthData.date.split('-');
    const formattedDate = `${year}年${parseInt(month)}月`;

    // 构建行HTML
    let rowHTML = `<td style="font-weight: bold; background-color: #f0f8ff;">${formattedDate}</td>`;

    // 添加各分类的金额
    categories.forEach(category => {
      const amount = monthData[category] || 0;
      totals[category] += amount;

      // 如果金额大于0，显示金额，否则显示空
      const displayAmount = amount > 0 ? amount.toFixed(2) : '';
      const cellStyle = amount > 0 ? 'text-align: right; font-weight: bold;' : 'text-align: center; color: #ccc;';

      rowHTML += `<td style="${cellStyle}">${displayAmount}</td>`;
    });

    // 添加月总计
    const monthlyTotal = monthData.月总计 || 0;
    totals.月总计 += monthlyTotal;
    const totalStyle = monthlyTotal > 0 ? 'text-align: right; font-weight: bold; background-color: #e8f5e8;' : 'text-align: center; color: #ccc;';
    const displayTotal = monthlyTotal > 0 ? monthlyTotal.toFixed(2) : '';
    rowHTML += `<td style="${totalStyle}">${displayTotal}</td>`;

    row.innerHTML = rowHTML;

    // 如果当月有支出，设置行的背景色
    if (monthlyTotal > 0) {
      row.style.backgroundColor = '#fafafa';
    }

    recordsTable.appendChild(row);
  });

  // 总计行
  const totalRow = document.createElement('tr');
  let totalRowHTML = '<td style="font-weight: bold; background-color: #e0e0e0; text-align: center;">总计</td>';

  categories.forEach(category => {
    const total = totals[category];
    const displayTotal = total > 0 ? total.toFixed(2) : '0.00';
    totalRowHTML += `<td style="text-align: right; font-weight: bold; background-color: #e0e0e0;">${displayTotal}</td>`;
  });

  // 总计的总计
  const grandTotal = totals.月总计;
  totalRowHTML += `<td style="text-align: right; font-weight: bold; background-color: #d0d0d0; font-size: 16px;">${grandTotal.toFixed(2)}</td>`;

  totalRow.innerHTML = totalRowHTML;
  totalRow.style.borderTop = '2px solid #999';
  recordsTable.appendChild(totalRow);
}

// 更新表头
function updateTableHeader(type) {
  const tableHead = document.querySelector('#recordsTable thead tr');
  const lastColumnName = type === 'daily' ? '日总计' : '月总计';

  tableHead.innerHTML = `
    <th>${type === 'daily' ? '日期' : '月份'}</th>
    <th>学习</th>
    <th>娱乐</th>
    <th>美妆</th>
    <th>日用</th>
    <th>服饰</th>
    <th>人情</th>
    <th>还贷</th>
    <th>主业</th>
    <th>副业</th>
    <th>${lastColumnName}</th>
  `;
}
