// 认证中间件
import { verifyJWT } from './auth';

export interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}

export interface AuthContext {
    userId: number;
    username: string;
}

// CORS headers
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
};

// 验证 JWT Token（用于 Web 端）
export async function verifyAuth(request: Request, env: Env): Promise<AuthContext | null> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);

    if (!payload) {
        return null;
    }

    return {
        userId: payload.userId,
        username: payload.username
    };
}

// 验证 API Token（用于快捷指令等外部调用）
export async function verifyApiToken(request: Request, env: Env): Promise<boolean> {
    const apiToken = request.headers.get('X-API-Token');
    if (!apiToken) {
        return false;
    }

    try {
        const result = await env.DB.prepare(
            'SELECT id FROM api_tokens WHERE token = ? AND is_active = 1'
        ).bind(apiToken).first();

        if (result) {
            // 更新最后使用时间
            await env.DB.prepare(
                'UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token = ?'
            ).bind(apiToken).run();
            return true;
        }
    } catch (error) {
        console.error('验证 API Token 失败:', error);
    }

    return false;
}

// 统一认证：先尝试 JWT，再尝试 API Token
export async function authenticate(request: Request, env: Env): Promise<{ success: boolean; context?: AuthContext; isApiToken?: boolean }> {
    // 先尝试 JWT 认证
    const authContext = await verifyAuth(request, env);
    if (authContext) {
        return { success: true, context: authContext };
    }

    // 再尝试 API Token 认证
    const apiTokenValid = await verifyApiToken(request, env);
    if (apiTokenValid) {
        return { success: true, isApiToken: true };
    }

    return { success: false };
}

// 返回 401 未授权响应
export function unauthorizedResponse(message: string = '未授权访问'): Response {
    return new Response(JSON.stringify({ error: message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
