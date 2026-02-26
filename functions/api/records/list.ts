import { authenticate, corsHeaders, unauthorizedResponse } from '../../utils/middleware';

interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}

// GET /api/records/list
// Get raw records list within date range
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const { DB } = context.env;
        const url = new URL(context.request.url);
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const memberIdParam = url.searchParams.get('memberId');

        if (!startDate || !endDate) {
            return new Response(JSON.stringify({
                error: '缺少必填参数: startDate, endDate'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        let memberId: number | null | 'all' | 'family' = 'all';
        if (memberIdParam === 'family') {
            memberId = 'family';
        } else if (memberIdParam && memberIdParam !== 'all') {
            memberId = parseInt(memberIdParam);
            if (isNaN(memberId)) {
                memberId = 'all';
            }
        }

        let query = 'SELECT * FROM records WHERE date >= ? AND date <= ?';
        const params: any[] = [startDate, endDate];

        if (typeof memberId === 'number') {
            query += ' AND member_id = ?';
            params.push(memberId);
        } else if (memberId === 'family') {
            query += ' AND member_id IS NULL';
        }

        query += ' ORDER BY date DESC, id DESC';

        const { results } = await DB.prepare(query).bind(...params).all();

        return new Response(JSON.stringify({
            success: true,
            data: results
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('获取记录列表失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, {
        headers: corsHeaders
    });
};
