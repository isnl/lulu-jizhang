import { authenticate, corsHeaders, unauthorizedResponse } from '../../utils/middleware';

interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, { headers: corsHeaders });
};

// Update an existing category keyword mapping
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const id = context.params.id as string;
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

        // Update the database
        await DB.prepare('UPDATE category_keywords SET category = ?, type = ?, keywords = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(category, type, keywordsStr, id)
            .run();

        return new Response(JSON.stringify({
            success: true,
            data: { id, category, type, keywords }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to update category keyword:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};

// Delete a category keyword mapping
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const id = context.params.id as string;
        const { DB } = context.env;

        await DB.prepare('DELETE FROM category_keywords WHERE id = ?')
            .bind(id)
            .run();

        return new Response(JSON.stringify({
            success: true,
            message: 'Deleted successfully'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to delete category keyword:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
