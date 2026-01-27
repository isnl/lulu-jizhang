// API Token 管理
// Path: /api/auth/tokens

import { generateApiToken } from '../../utils/auth';
import { verifyAuth, corsHeaders, unauthorizedResponse } from '../../utils/middleware';

interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}

interface CreateTokenRequest {
    name: string;
}

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, { headers: corsHeaders });
};

// GET /api/auth/tokens - 获取所有 API Token
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const authContext = await verifyAuth(context.request, context.env);
        if (!authContext) {
            return unauthorizedResponse();
        }

        const { results } = await context.env.DB.prepare(
            `SELECT id, name, token, last_used_at, is_active, created_at
             FROM api_tokens
             ORDER BY created_at DESC`
        ).all();

        // 隐藏 token 中间部分，只显示前后几位
        const tokensWithMasked = results.map((t: any) => ({
            ...t,
            tokenMasked: t.token.substring(0, 8) + '...' + t.token.substring(t.token.length - 8),
            token: undefined // 列表中不返回完整 token
        }));

        return new Response(JSON.stringify({
            success: true,
            data: tokensWithMasked
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('获取 API Token 列表失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};

// POST /api/auth/tokens - 创建新的 API Token
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const authContext = await verifyAuth(context.request, context.env);
        if (!authContext) {
            return unauthorizedResponse();
        }

        const body = await context.request.json() as CreateTokenRequest;
        const { name } = body;

        if (!name || name.trim().length === 0) {
            return new Response(JSON.stringify({
                error: '请输入 Token 名称'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const token = generateApiToken();

        const result = await context.env.DB.prepare(
            'INSERT INTO api_tokens (name, token) VALUES (?, ?)'
        ).bind(name.trim(), token).run();

        return new Response(JSON.stringify({
            success: true,
            message: 'API Token 创建成功',
            data: {
                id: result.meta.last_row_id,
                name: name.trim(),
                token: token, // 创建时返回完整 token，之后就看不到了
                is_active: 1,
                created_at: new Date().toISOString()
            }
        }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('创建 API Token 失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
