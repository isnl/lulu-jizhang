
// Cloudflare Functions API for batch record creation
// Path: /api/records/batch

interface Env {
    DB: D1Database;
}

interface RecordData {
    type: '支出' | '收入';
    category: string;
    amount: number;
    date: string;
    remark?: string;
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
    }
};

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, {
        headers: corsHeaders
    });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { DB } = context.env;
        const records = await context.request.json() as RecordData[];

        if (!Array.isArray(records) || records.length === 0) {
            return new Response(JSON.stringify({
                error: '请提供有效的记录数组'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Validate all records first
        for (const record of records) {
            const { type, category, amount, date } = record;

            if (!type || !category || amount === undefined || !date) {
                return new Response(JSON.stringify({
                    error: '记录缺少必填字段'
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
        }

        // Prepare statements
        const statements = records.map(record => {
            return DB.prepare(
                'INSERT INTO records (type, category, amount, date, remark) VALUES (?, ?, ?, ?, ?)'
            ).bind(record.type, record.category, record.amount, record.date, record.remark || '');
        });

        // Execute batch
        const results = await DB.batch(statements);

        return new Response(JSON.stringify({
            success: true,
            message: `成功导入 ${results.length} 条记录`,
            count: results.length
        }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('批量创建记录失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误' + (error instanceof Error ? ': ' + error.message : '')
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
