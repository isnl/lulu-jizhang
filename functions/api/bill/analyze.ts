import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { authenticate, corsHeaders, unauthorizedResponse } from '../../utils/middleware';

interface Env {
    DB: D1Database;
    DEEPSEEK_API_KEY: string;
    JWT_SECRET: string;
}

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, { headers: corsHeaders });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        // 认证检查
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

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

        // 分类映射：将AI返回的分类映射到系统标准分类
        const categoryMapping: Record<string, string> = {
            // 饮食相关
            '餐饮': '饮食',
            '食品': '饮食',
            '外卖': '饮食',
            '饭店': '饮食',
            '餐厅': '饮食',
            '美食': '饮食',
            '吃饭': '饮食',

            // 交通相关
            '出行': '交通',
            '打车': '交通',
            '公交': '交通',
            '地铁': '交通',
            '停车': '交通',
            '加油': '交通',
            '车费': '交通',

            // 日用品相关
            '购物': '日用品',
            '超市': '日用品',
            '生活用品': '日用品',

            // 娱乐相关
            '休闲娱乐': '娱乐',
            '游戏': '娱乐',
            '电影': '娱乐',

            // 学习相关
            '教育': '学习',
            '培训': '学习',
            '课程': '学习',
            '书籍': '学习',

            // 医疗相关
            '医药': '医疗',
            '看病': '医疗',
            '药品': '医疗',
            '健康': '医疗',

            // 通讯相关
            '话费': '通讯',
            '流量': '通讯',
            '宽带': '通讯',

            // 服饰相关
            '衣服': '服饰',
            '鞋子': '服饰',
            '服装': '服饰',

            // 美妆护肤相关
            '化妆品': '美妆护肤',
            '护肤品': '美妆护肤',
            '美容': '美妆护肤',

            // 宠物相关
            '宠物用品': '宠物',

            // 饰品相关
            '首饰': '饰品',
            '珠宝': '饰品',

            // 电子产品相关
            '数码': '电子产品',
            '电器': '电子产品',

            // 人情相关
            '礼物': '人情',
            '红包': '人情',

            // 还贷相关
            '贷款': '还贷',
            '房贷': '还贷',
            '车贷': '还贷',

            // 收入相关
            '薪资': '工资',
            '薪水': '工资',
            '工资收入': '工资',
            '理财': '投资收入',
            '股票': '投资收入',
            '基金': '投资收入',
            '稿费': '稿费收入',
        };

        // 标准分类列表
        const validExpenseCategories = [
            '生活费', '交通', '饮食', '日用品', '娱乐', '学习',
            '电子产品', '人情', '宠物', '饰品', '美妆护肤', '医疗',
            '通讯', '服饰', '还贷'
        ];
        const validIncomeCategories = ['工资', '投资收入', '稿费收入', '其他'];

        // 映射分类
        const mappedTransactions = object.transactions.map(transaction => {
            let category = transaction.category || '';

            // 尝试映射
            if (category && categoryMapping[category]) {
                category = categoryMapping[category];
            }

            // 验证分类是否有效
            const validCategories = transaction.type === '支出'
                ? validExpenseCategories
                : validIncomeCategories;

            if (!validCategories.includes(category)) {
                // 如果分类无效，使用默认值
                category = transaction.type === '支出' ? '日用品' : '其他';
            }

            return {
                ...transaction,
                category
            };
        });

        return new Response(JSON.stringify({
            success: true,
            data: { transactions: mappedTransactions }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('API Error:', err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
