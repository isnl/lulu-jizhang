// Cloudflare Functions API for records
// Path: /api/records

import { authenticate, corsHeaders, unauthorizedResponse } from '../utils/middleware';

interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}

interface RecordData {
    type: '支出' | '收入';
    category: string;
    amount: number;
    date: string;
    remark?: string;
    memberId?: number | null;  // 关联成员ID
}

const RECORD_TYPES = ['支出', '收入'];

// 支出类别
const EXPENSE_CATEGORIES = [
    '生活费', '交通', '饮食', '日用品', '娱乐', '学习',
    '电子产品', '人情', '宠物', '饰品', '美妆护肤', '医疗',
    '通讯', '服饰', '还贷'
];

// 收入类别
const INCOME_CATEGORIES = [
    '工资', '投资收入', '稿费收入', '其他'
];

// 所有类别
const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

const VALIDATION = {
    amount: {
        min: 0,
        max: 999999999
    },
    monthFormat: /^\d{4}-\d{2}$/
};

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, {
        headers: corsHeaders
    });
};

// POST /api/records - Create new record
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        // 认证检查
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const { DB } = context.env;
        const body = await context.request.json() as RecordData;
        const { type, category, amount, date, remark = '', memberId = null } = body;

        // Validation
        if (!type || !category || amount === undefined || !date) {
            return new Response(JSON.stringify({
                error: '缺少必填字段：类型、分类、金额、日期'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (!RECORD_TYPES.includes(type)) {
            return new Response(JSON.stringify({
                error: `无效的记录类型：${type}`
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (!CATEGORIES.includes(category)) {
            return new Response(JSON.stringify({
                error: `无效的分类：${category}`
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const numAmount = parseFloat(amount.toString());
        if (isNaN(numAmount) || numAmount < VALIDATION.amount.min || numAmount > VALIDATION.amount.max) {
            return new Response(JSON.stringify({
                error: `金额必须是${VALIDATION.amount.min}到${VALIDATION.amount.max}之间的数字`
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const recordDate = new Date(date);
        if (isNaN(recordDate.getTime())) {
            return new Response(JSON.stringify({
                error: '无效的日期格式'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Insert record
        const result = await DB.prepare(
            'INSERT INTO records (type, category, amount, date, remark, member_id) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(type, category, numAmount, date, remark, memberId).run();

        const record = {
            id: result.meta.last_row_id,
            type,
            category,
            amount: numAmount,
            date,
            remark,
            memberId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return new Response(JSON.stringify({
            success: true,
            message: '记录创建成功',
            data: record
        }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('创建记录失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};

// GET /api/records - Get records with date range
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        // 认证检查
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const { DB } = context.env;
        const url = new URL(context.request.url);
        const startMonth = url.searchParams.get('startMonth');
        const endMonth = url.searchParams.get('endMonth');
        const memberIdParam = url.searchParams.get('memberId');

        // 解析成员ID：'all'表示所有成员，'family'表示家庭共同，数字表示特定成员
        let memberId: number | null | 'all' | 'family' = 'all';
        if (memberIdParam === 'family') {
            memberId = 'family';
        } else if (memberIdParam && memberIdParam !== 'all') {
            memberId = parseInt(memberIdParam);
            if (isNaN(memberId)) {
                memberId = 'all';
            }
        }

        // Validation
        if (!startMonth || !endMonth) {
            return new Response(JSON.stringify({
                error: '请提供开始月份(startMonth)和结束月份(endMonth)参数'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (!VALIDATION.monthFormat.test(startMonth) || !VALIDATION.monthFormat.test(endMonth)) {
            return new Response(JSON.stringify({
                error: '日期格式错误，请使用YYYY-MM格式'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const startDate = new Date(startMonth + '-01');
        const endDate = new Date(endMonth + '-01');
        endDate.setMonth(endDate.getMonth() + 1);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return new Response(JSON.stringify({
                error: '无效的日期'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (startDate > endDate) {
            return new Response(JSON.stringify({
                error: '开始月份不能晚于结束月份'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Determine if single month or multiple months
        const [startYear, startMonthNum] = startMonth.split('-').map(Number);
        const [endYear, endMonthNum] = endMonth.split('-').map(Number);
        const isSingleMonth = (startYear === endYear && startMonthNum === endMonthNum);

        let result;
        if (isSingleMonth) {
            result = await getDailyRecords(DB, startMonth + '-01', endDate.toISOString().split('T')[0], memberId);
        } else {
            result = await getMonthlyRecords(DB, startMonth + '-01', endDate.toISOString().split('T')[0], memberId);
        }

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('获取记录统计失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};

// Get daily records for single month
async function getDailyRecords(DB: D1Database, startDate: string, endDate: string, memberId: number | null | 'all' | 'family' = 'all') {
    let query = 'SELECT date, category, SUM(amount) as totalAmount FROM records WHERE date >= ? AND date < ?';
    const params: any[] = [startDate, endDate];

    if (typeof memberId === 'number') {
        query += ' AND member_id = ?';
        params.push(memberId);
    }

    query += ' GROUP BY date, category ORDER BY date';

    const { results } = await DB.prepare(query).bind(...params).all();

    const allDates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current < end) {
        const dateKey = current.toISOString().split('T')[0];
        allDates.push(dateKey);
        current.setDate(current.getDate() + 1);
    }

    const dailyData: Record<string, any> = {};
    allDates.forEach(dateKey => {
        dailyData[dateKey] = {
            date: dateKey,
            type: 'daily'
        };
        CATEGORIES.forEach(category => {
            dailyData[dateKey][category] = 0;
        });
    });

    results.forEach((record: any) => {
        const dateKey = record.date;
        if (dailyData[dateKey]) {
            dailyData[dateKey][record.category] = record.totalAmount;
        }
    });

    const result = allDates.map(dateKey => {
        const dayData = dailyData[dateKey];
        const dailyTotal = CATEGORIES.reduce((sum, category) => sum + (dayData[category] || 0), 0);

        return {
            ...dayData,
            日总计: dailyTotal
        };
    });

    return result;
}

// Get monthly records for multiple months
async function getMonthlyRecords(DB: D1Database, startDate: string, endDate: string, memberId: number | null | 'all' | 'family' = 'all') {
    let query = `SELECT
      strftime('%Y-%m', date) as month,
      category,
      SUM(amount) as totalAmount
    FROM records
    WHERE date >= ? AND date < ?`;
    const params: any[] = [startDate, endDate];

    if (typeof memberId === 'number') {
        query += ' AND member_id = ?';
        params.push(memberId);
    }

    query += ' GROUP BY month, category ORDER BY month';

    const { results } = await DB.prepare(query).bind(...params).all();

    const allMonths: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current < end) {
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        allMonths.push(monthKey);
        current.setMonth(current.getMonth() + 1);
    }

    const monthlyData: Record<string, any> = {};
    allMonths.forEach(monthKey => {
        monthlyData[monthKey] = {
            date: monthKey,
            type: 'monthly'
        };
        CATEGORIES.forEach(category => {
            monthlyData[monthKey][category] = 0;
        });
    });

    results.forEach((record: any) => {
        const monthKey = record.month;
        if (monthlyData[monthKey]) {
            monthlyData[monthKey][record.category] = record.totalAmount;
        }
    });

    const result = allMonths.map(monthKey => {
        const monthData = monthlyData[monthKey];
        const monthlyTotal = CATEGORIES.reduce((sum, category) => sum + (monthData[category] || 0), 0);

        return {
            ...monthData,
            月总计: monthlyTotal
        };
    });

    return result;
}
