import { authenticate, corsHeaders, unauthorizedResponse } from '../../utils/middleware';

interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, { headers: corsHeaders });
};

// Get all category keywords
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const { DB } = context.env;
        const { results } = await DB.prepare('SELECT * FROM category_keywords ORDER BY type, category').all();

        // Check and parse keywords
        const normalizedResults = results.map((row: any) => {
            let parsedKeywords = [];
            try {
                parsedKeywords = JSON.parse(row.keywords);
            } catch (e) {
                // simple fallback
                parsedKeywords = Object.prototype.toString.call(row.keywords) === '[object String]' ? row.keywords.split(',') : [];
            }
            return {
                ...row,
                keywords: parsedKeywords
            };
        });

        return new Response(JSON.stringify({
            success: true,
            data: normalizedResults
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to get category keywords:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};

// Create a new category keyword mapping
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const { DB } = context.env;
        const body = await context.request.json() as any;

        const { category, type, keywords } = body;

        if (!category || !type || !Array.isArray(keywords)) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Invalid input parameters'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const keywordsStr = JSON.stringify(keywords);

        // check if exists
        const existing = await DB.prepare('SELECT id FROM category_keywords WHERE category = ? AND type = ?')
            .bind(category, type)
            .first();

        if (existing) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Category and type already exists'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const result = await DB.prepare('INSERT INTO category_keywords (category, type, keywords) VALUES (?, ?, ?)')
            .bind(category, type, keywordsStr)
            .run();

        return new Response(JSON.stringify({
            success: true,
            data: { id: result.meta.last_row_id, category, type, keywords }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to create category keyword:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
