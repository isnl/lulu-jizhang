// Cloudflare Functions API for batch record creation
// Path: /api/records/batch

import { authenticate, corsHeaders, unauthorizedResponse } from '../../utils/middleware';

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
    memberId?: number | null;
}

interface BatchImportRequest {
    records: RecordData[];
    memberId?: number | null;
}

const RECORD_TYPES = ['支出', '收入'];

const EXPENSE_CATEGORIES = [
    '生活费', '交通', '饮食', '日用品', '娱乐', '学习',
    '电子产品', '人情', '宠物', '饰品', '美妆护肤', '医疗',
    '通讯', '服饰', '还贷'
];

const INCOME_CATEGORIES = [
    '工资', '投资收入', '稿费收入', '其他'
];

const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

const VALIDATION = {
    amount: {
        min: 0,
        max: 999999999
    }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, {
        headers: corsHeaders
    });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        // 认证检查
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const { DB } = context.env;
        const body = await context.request.json();

        let records: RecordData[];
        let batchMemberId: number | null = null;

        if (Array.isArray(body)) {
            records = body;
        } else if (body && Array.isArray(body.records)) {
            records = body.records;
            batchMemberId = body.memberId ?? null;
        } else {
            return new Response(JSON.stringify({
                error: '请提供有效的记录数组'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (records.length === 0) {
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

        const statements = records.map(record => {
            const memberId = record.memberId !== undefined ? record.memberId : batchMemberId;
            return DB.prepare(
                'INSERT INTO records (type, category, amount, date, remark, member_id) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(record.type, record.category, record.amount, record.date, record.remark || '', memberId);
        });

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
