// 登录 API
// Path: /api/auth/login

import { generateJWT, verifyPassword, hashPassword } from '../../utils/auth';
import { corsHeaders } from '../../utils/middleware';

interface Env {
    DB: D1Database;
    JWT_SECRET: string;
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD?: string;
}

interface LoginRequest {
    username: string;
    password: string;
}

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, { headers: corsHeaders });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { DB, JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD } = context.env;
        const body = await context.request.json() as LoginRequest;
        const { username, password } = body;

        if (!username || !password) {
            return new Response(JSON.stringify({
                error: '请输入用户名和密码'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 查询用户
        let user = await DB.prepare(
            'SELECT id, username, password_hash FROM users WHERE username = ?'
        ).bind(username).first<{ id: number; username: string; password_hash: string }>();

        // 如果没有用户且配置了管理员账号，自动创建
        if (!user && ADMIN_USERNAME && ADMIN_PASSWORD) {
            if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
                const { hash } = await hashPassword(password);
                await DB.prepare(
                    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
                ).bind(username, hash).run();

                user = await DB.prepare(
                    'SELECT id, username, password_hash FROM users WHERE username = ?'
                ).bind(username).first();
            }
        }

        if (!user) {
            return new Response(JSON.stringify({
                error: '用户名或密码错误'
            }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 验证密码
        const isValid = await verifyPassword(password, user.password_hash);
        if (!isValid) {
            return new Response(JSON.stringify({
                error: '用户名或密码错误'
            }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 生成 JWT (有效期 7 天)
        const token = await generateJWT(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            7 * 24 * 60 * 60
        );

        return new Response(JSON.stringify({
            success: true,
            message: '登录成功',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username
                }
            }
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('登录失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
