// 单个 API Token 操作（删除、启用/禁用）
// Path: /api/auth/tokens/[id]

import { verifyAuth, corsHeaders, unauthorizedResponse } from '../../../utils/middleware';

interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, { headers: corsHeaders });
};

// DELETE /api/auth/tokens/:id - 删除 API Token
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const authContext = await verifyAuth(context.request, context.env);
        if (!authContext) {
            return unauthorizedResponse();
        }

        const id = context.params.id as string;

        const result = await context.env.DB.prepare(
            'DELETE FROM api_tokens WHERE id = ?'
        ).bind(id).run();

        if (result.meta.changes === 0) {
            return new Response(JSON.stringify({
                error: 'Token 不存在'
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'API Token 已删除'
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('删除 API Token 失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};

// PUT /api/auth/tokens/:id - 更新 API Token（启用/禁用）
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const authContext = await verifyAuth(context.request, context.env);
        if (!authContext) {
            return unauthorizedResponse();
        }

        const id = context.params.id as string;
        const body = await context.request.json() as { is_active?: boolean };

        if (body.is_active === undefined) {
            return new Response(JSON.stringify({
                error: '请提供要更新的字段'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const result = await context.env.DB.prepare(
            'UPDATE api_tokens SET is_active = ? WHERE id = ?'
        ).bind(body.is_active ? 1 : 0, id).run();

        if (result.meta.changes === 0) {
            return new Response(JSON.stringify({
                error: 'Token 不存在'
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            message: body.is_active ? 'Token 已启用' : 'Token 已禁用'
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('更新 API Token 失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
