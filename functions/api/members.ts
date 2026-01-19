// Cloudflare Functions API for family members
// Path: /api/members

interface Env {
    DB: D1Database;
}

interface MemberData {
    name: string;
    wechatNickname?: string;
    color?: string;
    isActive?: boolean;
}

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// 预设颜色列表
const PRESET_COLORS = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
];

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, {
        headers: corsHeaders
    });
};

// GET /api/members - Get all active members
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { DB } = context.env;
        const url = new URL(context.request.url);
        const includeInactive = url.searchParams.get('includeInactive') === 'true';

        let query = 'SELECT id, name, wechat_nickname, color, is_active, created_at, updated_at FROM members';
        if (!includeInactive) {
            query += ' WHERE is_active = 1';
        }
        query += ' ORDER BY created_at ASC';

        const { results } = await DB.prepare(query).all();

        const members = results.map((row: any) => ({
            id: row.id,
            name: row.name,
            wechatNickname: row.wechat_nickname,
            color: row.color,
            isActive: row.is_active === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

        return new Response(JSON.stringify({
            success: true,
            data: members
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('获取成员列表失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};

// POST /api/members - Create new member
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { DB } = context.env;
        const body = await context.request.json() as MemberData;
        const { name, wechatNickname = '', color } = body;

        // Validation
        if (!name || name.trim() === '') {
            return new Response(JSON.stringify({
                error: '成员姓名不能为空'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Check if name already exists
        const existing = await DB.prepare(
            'SELECT id FROM members WHERE name = ?'
        ).bind(name.trim()).first();

        if (existing) {
            return new Response(JSON.stringify({
                error: '该成员姓名已存在'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Auto-assign color if not provided
        let assignedColor = color;
        if (!assignedColor) {
            const { results: existingMembers } = await DB.prepare(
                'SELECT color FROM members'
            ).all();
            const usedColors = existingMembers.map((m: any) => m.color);
            assignedColor = PRESET_COLORS.find(c => !usedColors.includes(c)) || PRESET_COLORS[0];
        }

        // Insert member
        const result = await DB.prepare(
            'INSERT INTO members (name, wechat_nickname, color) VALUES (?, ?, ?)'
        ).bind(name.trim(), wechatNickname.trim(), assignedColor).run();

        const member = {
            id: result.meta.last_row_id,
            name: name.trim(),
            wechatNickname: wechatNickname.trim(),
            color: assignedColor,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return new Response(JSON.stringify({
            success: true,
            message: '成员创建成功',
            data: member
        }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('创建成员失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误' + (error instanceof Error ? ': ' + error.message : '')
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
