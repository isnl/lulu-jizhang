import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

interface Env {
    DEEPSEEK_API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { request, env } = context;
        const body = await request.json() as { text: string };

        const apiKey = 'sk-b4c8d41c1167486585824d2a8e741f8a';

        if (!body.text) {
            return new Response(JSON.stringify({ error: 'No text provided' }), { status: 400 });
        }

        const deepseek = createOpenAI({
            baseURL: 'https://api.deepseek.com/v1',
            apiKey: apiKey,
        });

        const schema = z.object({
            transactions: z.array(z.object({
                type: z.enum(['支出', '收入']).describe('交易类型，必须是"支出"或"收入"'),
                amount: z.number().describe('金额，必须是正数'),
                date: z.string().describe('日期，格式 YYYY-MM-DD'),
                remark: z.string().describe('交易说明/备注'),
                category: z.string().optional().describe('建议的分类（如：餐饮、交通、日用品、工资等），不确定则留空'),
            })),
        });

        const systemPrompt = `你是一个专业的财务账单助手。请帮我分析下面的账单文本，提取出每一笔交易记录。

要求：
1. 忽略"还款"类型的记录。
2. 遇到"退款"交易，将其视为"收入"。
3. 只提取有效的交易记录，忽略无关的文本行。
4. 如果无法确定分类，可以留空或填"其他"。`;

        const userMessage = {
            role: 'user' as const,
            content: `账单文本内容：\n${body.text.substring(0, 10000)}`
        };
        const languageModel = deepseek.chat('deepseek-chat');

        const { object } = await generateObject({
            model: languageModel,
            schema: schema,
            system: systemPrompt,
            messages: [userMessage]
        });

        return new Response(JSON.stringify({ success: true, data: object }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('API Error:', err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
