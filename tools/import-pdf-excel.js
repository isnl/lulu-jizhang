/**
 * PDF账单Excel导入示例
 * 演示如何将PDF转换后的Excel文件导入到记账系统
 */

import * as XLSX from 'xlsx';

/**
 * 读取PDF转换后的Excel文件
 * @param {File} file - Excel文件对象
 * @returns {Promise<Array>} 交易记录数组
 */
export async function importPDFConvertedExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // 读取"交易明细"工作表
                const sheetName = '交易明细';
                const worksheet = workbook.Sheets[sheetName];

                if (!worksheet) {
                    throw new Error('未找到"交易明细"工作表');
                }

                // 转换为JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                // 解析并转换为记账系统格式
                const records = parseTransactions(jsonData);

                console.log(`[导入] 成功读取 ${records.length} 条交易记录`);
                resolve(records);

            } catch (error) {
                console.error('[错误] Excel解析失败:', error);
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('文件读取失败'));
        };

        reader.readAsArrayBuffer(file);
    });
}

/**
 * 解析交易记录并转换为系统格式
 * @param {Array} transactions - Excel中的交易数据
 * @returns {Array} 转换后的记录
 */
function parseTransactions(transactions) {
    return transactions.map((row, index) => {
        // 跳过表头和汇总行
        if (!row['交易日期'] || row['交易日期'] === '合计:') {
            return null;
        }

        try {
            // 解析金额
            const amount = parseFloat(row['金额']) || 0;
            const isIncome = amount > 0;

            // 智能分类
            const category = categorizeTransaction(row['交易说明'], isIncome);

            return {
                date: formatDate(row['交易日期']),
                description: row['交易说明'] || '',
                amount: Math.abs(amount),
                type: isIncome ? 'income' : 'expense',
                category: category,
                currency: row['币种'] || 'CNY',
                source: 'PDF账单导入',
                originalData: row
            };

        } catch (error) {
            console.warn(`[警告] 第${index + 1}行解析失败:`, error);
            return null;
        }
    }).filter(record => record !== null);
}

/**
 * 格式化日期
 * @param {string|Date} dateStr - 日期字符串或对象
 * @returns {string} YYYY-MM-DD格式
 */
function formatDate(dateStr) {
    if (!dateStr) return new Date().toISOString().split('T')[0];

    // 如果是Excel日期序列号
    if (typeof dateStr === 'number') {
        const date = XLSX.SSF.parse_date_code(dateStr);
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }

    // 如果是字符串
    if (typeof dateStr === 'string') {
        // 已经是YYYY-MM-DD格式
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }

        // 尝试解析其他格式
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    }

    return new Date().toISOString().split('T')[0];
}

/**
 * 智能分类交易
 * @param {string} description - 交易说明
 * @param {boolean} isIncome - 是否为收入
 * @returns {string} 分类
 */
function categorizeTransaction(description, isIncome) {
    if (isIncome) {
        if (description.includes('还款') || description.includes('转账')) {
            return '还款';
        }
        return '其他收入';
    }

    // 支出分类
    const desc = description.toLowerCase();

    // 餐饮
    if (desc.includes('餐') || desc.includes('食') || desc.includes('饭') ||
        desc.includes('咖啡') || desc.includes('奶茶') || desc.includes('美团')) {
        return '餐饮';
    }

    // 交通
    if (desc.includes('地铁') || desc.includes('公交') || desc.includes('滴滴') ||
        desc.includes('打车') || desc.includes('轨道交通') || desc.includes('出行')) {
        return '交通';
    }

    // 购物
    if (desc.includes('淘宝') || desc.includes('京东') || desc.includes('拼多多') ||
        desc.includes('超市') || desc.includes('商场')) {
        return '购物';
    }

    // 娱乐
    if (desc.includes('电影') || desc.includes('游戏') || desc.includes('视频') ||
        desc.includes('音乐') || desc.includes('会员')) {
        return '娱乐';
    }

    // 医疗
    if (desc.includes('医院') || desc.includes('药店') || desc.includes('医疗')) {
        return '医疗';
    }

    // 通讯
    if (desc.includes('话费') || desc.includes('流量') || desc.includes('移动') ||
        desc.includes('联通') || desc.includes('电信')) {
        return '通讯';
    }

    // 生活
    if (desc.includes('水电') || desc.includes('物业') || desc.includes('房租')) {
        return '生活';
    }

    return '其他';
}

/**
 * 批量导入到数据库
 * @param {Array} records - 记录数组
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<Object>} 导入结果
 */
export async function batchImportRecords(records, onProgress) {
    const results = {
        total: records.length,
        success: 0,
        failed: 0,
        errors: []
    };

    for (let i = 0; i < records.length; i++) {
        try {
            // 调用API导入单条记录
            await importSingleRecord(records[i]);
            results.success++;

            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total: records.length,
                    percentage: Math.round((i + 1) / records.length * 100)
                });
            }

        } catch (error) {
            results.failed++;
            results.errors.push({
                index: i,
                record: records[i],
                error: error.message
            });
        }
    }

    return results;
}

/**
 * 导入单条记录
 * @param {Object} record - 记录对象
 * @returns {Promise}
 */
async function importSingleRecord(record) {
    // 这里调用您的API
    const response = await fetch('/api/records', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(record)
    });

    if (!response.ok) {
        throw new Error(`导入失败: ${response.statusText}`);
    }

    return response.json();
}

/**
 * 使用示例
 */
export async function exampleUsage() {
    // 1. 用户选择文件
    const fileInput = document.getElementById('excel-file-input');

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];

        if (!file) return;

        try {
            console.log('[开始] 读取Excel文件...');

            // 2. 读取Excel
            const records = await importPDFConvertedExcel(file);

            console.log('[预览] 交易记录:', records);

            // 3. 显示预览(可选)
            displayPreview(records);

            // 4. 用户确认后导入
            const confirmed = confirm(`确认导入 ${records.length} 条记录?`);

            if (confirmed) {
                console.log('[导入] 开始批量导入...');

                const results = await batchImportRecords(records, (progress) => {
                    console.log(`[进度] ${progress.percentage}% (${progress.current}/${progress.total})`);
                });

                console.log('[完成] 导入结果:', results);
                alert(`导入完成!\n成功: ${results.success}\n失败: ${results.failed}`);
            }

        } catch (error) {
            console.error('[错误]', error);
            alert(`导入失败: ${error.message}`);
        }
    });
}

/**
 * 显示预览
 * @param {Array} records - 记录数组
 */
function displayPreview(records) {
    // 这里可以在UI中显示预览表格
    console.table(records.slice(0, 10)); // 显示前10条
}
