// Cloudflare Functions API for single member operations
// Path: /api/members/[id]

import { authenticate, corsHeaders, unauthorizedResponse } from '../../utils/middleware';

interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}

interface MemberData {
    name?: string;
    wechatNickname?: string;
    color?: string;
    isActive?: boolean;
}

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, { headers: corsHeaders });
};

// GET /api/members/[id] - Get single member
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const { DB } = context.env;
        const id = context.params.id as string;

        const member = await DB.prepare(
            'SELECT id, name, wechat_nickname, color, is_active, created_at, updated_at FROM members WHERE id = ?'
        ).bind(id).first();

        if (!member) {
            return new Response(JSON.stringify({
                error: '成员不存在'
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            data: {
                id: member.id,
                name: member.name,
                wechatNickname: member.wechat_nickname,
                color: member.color,
                isActive: member.is_active === 1,
                createdAt: member.created_at,
                updatedAt: member.updated_at
            }
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('获取成员失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};

// PUT /api/members/[id] - Update member
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const { DB } = context.env;
        const id = context.params.id as string;
        const body = await context.request.json() as MemberData;
        const { name, wechatNickname, color, isActive } = body;

        const existing = await DB.prepare(
            'SELECT id FROM members WHERE id = ?'
        ).bind(id).first();

        if (!existing) {
            return new Response(JSON.stringify({
                error: '成员不存在'
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const updates: string[] = [];
        const values: any[] = [];

        if (name !== undefined) {
            if (name.trim() === '') {
                return new Response(JSON.stringify({
                    error: '成员姓名不能为空'
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            const nameConflict = await DB.prepare(
                'SELECT id FROM members WHERE name = ? AND id != ?'
            ).bind(name.trim(), id).first();

            if (nameConflict) {
                return new Response(JSON.stringify({
                    error: '该成员姓名已存在'
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            updates.push('name = ?');
            values.push(name.trim());
        }

        if (wechatNickname !== undefined) {
            updates.push('wechat_nickname = ?');
            values.push(wechatNickname.trim());
        }

        if (color !== undefined) {
            updates.push('color = ?');
            values.push(color);
        }

        if (isActive !== undefined) {
            updates.push('is_active = ?');
            values.push(isActive ? 1 : 0);
        }

        if (updates.length === 0) {
            return new Response(JSON.stringify({
                error: '没有需要更新的字段'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        await DB.prepare(
            `UPDATE members SET ${updates.join(', ')} WHERE id = ?`
        ).bind(...values).run();

        const updated = await DB.prepare(
            'SELECT id, name, wechat_nickname, color, is_active, created_at, updated_at FROM members WHERE id = ?'
        ).bind(id).first();

        return new Response(JSON.stringify({
            success: true,
            message: '成员更新成功',
            data: {
                id: updated!.id,
                name: updated!.name,
                wechatNickname: updated!.wechat_nickname,
                color: updated!.color,
                isActive: updated!.is_active === 1,
                createdAt: updated!.created_at,
                updatedAt: updated!.updated_at
            }
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('更新成员失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};

// DELETE /api/members/[id] - Soft delete member
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const { DB } = context.env;
        const id = context.params.id as string;

        const existing = await DB.prepare(
            'SELECT id FROM members WHERE id = ?'
        ).bind(id).first();

        if (!existing) {
            return new Response(JSON.stringify({
                error: '成员不存在'
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        await DB.prepare(
            'UPDATE members SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(id).run();

        return new Response(JSON.stringify({
            success: true,
            message: '成员已禁用'
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('删除成员失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
