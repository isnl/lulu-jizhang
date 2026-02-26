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

// PUT /api/records/[id] - Update a record's category
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

        const body = await context.request.json() as { category: string };
        const { category } = body;

        if (!category) {
            return new Response(JSON.stringify({
                error: '缺少分类字段'
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
        await DB.prepare('UPDATE records SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(category, id)
            .run();

        return new Response(JSON.stringify({
            success: true,
            message: '记录分类更新成功'
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('更新记录分类失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
