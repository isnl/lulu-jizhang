import { authenticate, corsHeaders, unauthorizedResponse } from '../../utils/middleware';

interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, {
        headers: corsHeaders
    });
};

// DELETE /api/records/[id] - Delete a record
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        // 认证检查
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const { DB } = context.env;
        const id = context.params.id;

        if (!id) {
            return new Response(JSON.stringify({
                error: '缺少记录ID'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Check if record exists
        const record = await DB.prepare('SELECT id FROM records WHERE id = ?').bind(id).first();
        if (!record) {
            return new Response(JSON.stringify({
                error: '记录不存在'
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Delete record
        await DB.prepare('DELETE FROM records WHERE id = ?').bind(id).run();

        return new Response(JSON.stringify({
            success: true,
            message: '记录删除成功'
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('删除记录失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};

const EXPENSE_CATEGORIES = [
    '生活费', '交通', '饮食', '日用品', '娱乐', '学习',
    '电子产品', '人情', '宠物', '饰品', '美妆护肤', '医疗', '保险',
    '保健', '通讯', '服饰', '还贷', '家电/家具', '工作待报销'
];

const INCOME_CATEGORIES = [
    '工资', '投资收入', '稿费收入', '其他'
];

const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

function isCategoryAllowedForType(type: string, category: string): boolean {
    if (type === '支出') return EXPENSE_CATEGORIES.includes(category);
    if (type === '收入') return INCOME_CATEGORIES.includes(category);
    return false;
}

// PUT /api/records/[id] - Update a record's editable fields
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const { DB } = context.env;
        const id = context.params.id;

        if (!id) {
            return new Response(JSON.stringify({
                error: '缺少记录ID'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const existingRecord = await DB.prepare('SELECT type FROM records WHERE id = ?').bind(id).first() as { type?: string } | null;
        if (!existingRecord) {
            return new Response(JSON.stringify({ error: '记录不存在' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const body = await context.request.json() as { category?: string; remark?: string; source?: string };
        const updates: string[] = [];
        const values: any[] = [];

        if (body.category !== undefined) {
            if (!body.category || !CATEGORIES.includes(body.category)) {
                return new Response(JSON.stringify({
                    error: '无效的分类'
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            if (!isCategoryAllowedForType(existingRecord.type || '', body.category)) {
                return new Response(JSON.stringify({
                    error: `分类"${body.category}"不能用于"${existingRecord.type}"记录`
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            updates.push('category = ?');
            values.push(body.category);
        }

        if (body.remark !== undefined) {
            updates.push('remark = ?');
            values.push(body.remark || '');
        }

        if (body.source !== undefined) {
            updates.push('source = ?');
            values.push(body.source || '');
        }

        if (updates.length === 0) {
            return new Response(JSON.stringify({
                error: '缺少可更新字段'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Check if record exists
        const record = await DB.prepare('SELECT id FROM records WHERE id = ?').bind(id).first();
        if (!record) {
            return new Response(JSON.stringify({
                error: '记录不存在'
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Update record
        values.push(id);
        await DB.prepare(`UPDATE records SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .bind(...values)
            .run();

        return new Response(JSON.stringify({
            success: true,
            message: '记录更新成功'
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('更新记录失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
