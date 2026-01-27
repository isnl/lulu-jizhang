// 验证当前登录状态
// Path: /api/auth/me

import { verifyAuth, corsHeaders } from '../../utils/middleware';

interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, { headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const authContext = await verifyAuth(context.request, context.env);

        if (!authContext) {
            return new Response(JSON.stringify({
                error: '未登录或登录已过期'
            }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            data: {
                userId: authContext.userId,
                username: authContext.username
            }
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('验证登录状态失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
