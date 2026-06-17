import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { authenticate, corsHeaders, unauthorizedResponse } from '../../utils/middleware';

interface Env {
    DB: D1Database;
    DEEPSEEK_API_KEY: string;
    JWT_SECRET: string;
}

interface ParsedTransaction {
    type: '支出' | '收入';
    amount: number;
    date: string;
    remark: string;
    category?: string;
    counterparty?: string;
    product?: string;
}

const validExpenseCategories = [
    '生活费', '交通', '饮食', '日用品', '娱乐', '学习',
    '电子产品', '人情', '宠物', '饰品', '美妆护肤', '医疗',
    '保险', '保健', '通讯', '服饰', '还贷', '家电/家具', '工作待报销'
];
const validIncomeCategories = ['工资', '投资收入', '稿费收入', '其他'];

const categoryMapping: Record<string, string> = {
    '餐饮': '饮食',
    '食品': '饮食',
    '外卖': '饮食',
    '饭店': '饮食',
    '餐厅': '饮食',
    '美食': '饮食',
    '吃饭': '饮食',
    '出行': '交通',
    '打车': '交通',
    '公交': '交通',
    '地铁': '交通',
    '停车': '交通',
    '加油': '交通',
    '车费': '交通',
    '购物': '日用品',
    '超市': '日用品',
    '生活用品': '日用品',
    '休闲娱乐': '娱乐',
    '游戏': '娱乐',
    '电影': '娱乐',
    '教育': '学习',
    '培训': '学习',
    '课程': '学习',
    '书籍': '学习',
    '医药': '医疗',
    '看病': '医疗',
    '药品': '医疗',
    '健康': '保健',
    '话费': '通讯',
    '流量': '通讯',
    '宽带': '通讯',
    '衣服': '服饰',
    '鞋子': '服饰',
    '服装': '服饰',
    '家具': '家电/家具',
    '家电': '家电/家具',
    '大家电': '家电/家具',
    '家居': '家电/家具',
    '化妆品': '美妆护肤',
    '护肤品': '美妆护肤',
    '美容': '美妆护肤',
    '宠物用品': '宠物',
    '首饰': '饰品',
    '珠宝': '饰品',
    '数码': '电子产品',
    '电器': '电子产品',
    '礼物': '人情',
    '红包': '人情',
    '贷款': '还贷',
    '房贷': '还贷',
    '车贷': '还贷',
    '薪资': '工资',
    '薪水': '工资',
    '工资收入': '工资',
    '理财': '投资收入',
    '股票': '投资收入',
    '基金': '投资收入',
    '稿费': '稿费收入',
};

function inferCreditStatementYearMonth(text: string): { year: number; month: number } | null {
    const statementDateMatch = text.match(/账单日\s*(\d{4})年(\d{1,2})月\d{1,2}日/);
    if (statementDateMatch) {
        return {
            year: Number(statementDateMatch[1]),
            month: Number(statementDateMatch[2])
        };
    }

    const statementMonthMatch = text.match(/CMB Credit Card Statement \((\d{4})\.(\d{1,2})\)/);
    if (statementMonthMatch) {
        return {
            year: Number(statementMonthMatch[1]),
            month: Number(statementMonthMatch[2])
        };
    }

    return null;
}

function formatCreditTransactionDate(monthDay: string, statement: { year: number; month: number } | null): string | null {
    const match = monthDay.match(/^(\d{2})\/(\d{2})$/);
    if (!match || !statement) return null;

    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = month > statement.month ? statement.year - 1 : statement.year;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeParsedCategory(type: '支出' | '收入', category = ''): string {
    const mapped = categoryMapping[category] || category;
    const validCategories = type === '支出' ? validExpenseCategories : validIncomeCategories;
    if (validCategories.includes(mapped)) return mapped;
    return type === '支出' ? '日用品' : '其他';
}

function mapCreditCategory(type: '支出' | '收入', remark: string): string {
    if (type === '收入') return '其他';

    if (/轨道交通|公交|地铁|高德|停车|高速|加油/.test(remark)) return '交通';
    if (/移动|联通|电信|话费|流量|宽带/.test(remark)) return '通讯';
    if (/餐厅|烤肉|早餐|咖啡|Lovelycup|拉扎斯|外卖|粥|饼|牛肉面|麻辣|食品/.test(remark)) return '饮食';
    if (/药房|医药|医疗|大药房|保健/.test(remark)) return '保健';
    if (/优衣库|服饰|服装|鞋|衣/.test(remark)) return '服饰';
    if (/数码|电器|手机|电脑|纸品|拼多多|京东商城|平台商户|超市|便利/.test(remark)) return '日用品';
    if (/酒店|旅游|景区/.test(remark)) return '娱乐';
    if (/小红书|化妆|美妆|护肤/.test(remark)) return '美妆护肤';

    return '日用品';
}

function splitCreditRemark(description: string): { counterparty: string; product: string } {
    const match = description.match(/^(.+?)[-－](.+)$/);
    if (!match) {
        return { counterparty: description, product: description };
    }
    return {
        counterparty: match[1].trim(),
        product: match[2].trim()
    };
}

function parseCreditCardTransactions(text: string): ParsedTransaction[] {
    const statement = inferCreditStatementYearMonth(text);
    const transactions: ParsedTransaction[] = [];
    let section: '还款' | '退款' | '消费' | '' = '';

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line === '还款' || line === '退款' || line === '消费') {
            section = line;
            continue;
        }

        const match = line.match(/^(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s+\d{4}\s+-?[\d,]+\.\d{2}(?:\([A-Z]+\))?$/);
        if (!match) continue;

        const [, transDate, , description, amountText] = match;
        if (section === '还款' || description.includes('自动还款') || description.includes('还款')) continue;

        const date = formatCreditTransactionDate(transDate, statement);
        const amount = Math.abs(Number(amountText.replace(/,/g, '')));
        if (!date || !Number.isFinite(amount) || amount <= 0) continue;

        const type: '支出' | '收入' = section === '退款' || amountText.trim().startsWith('-') ? '收入' : '支出';
        const remark = description.trim();
        const { counterparty, product } = splitCreditRemark(remark);

        transactions.push({
            type,
            amount,
            date,
            remark,
            counterparty,
            product,
            category: mapCreditCategory(type, remark)
        });
    }

    return transactions;
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

        const apiKey = env.DEEPSEEK_API_KEY;

        if (!body.text) {
            return new Response(JSON.stringify({ error: 'No text provided' }), { status: 400 });
        }

        const parsedTransactions = parseCreditCardTransactions(body.text);
        if (parsedTransactions.length > 0) {
            return new Response(JSON.stringify({
                success: true,
                data: { transactions: parsedTransactions }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (!apiKey) {
            return new Response(JSON.stringify({
                success: false,
                error: '缺少 DEEPSEEK_API_KEY 配置，无法解析信用卡账单'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
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

        // 动态获取分类关键字配置
        const { DB } = env;
        const { results: keywordConfigs } = await DB.prepare('SELECT category, type, keywords FROM category_keywords').all();

        let dynamicRules = '';
        if (keywordConfigs && keywordConfigs.length > 0) {
            let ruleIndex = 5;
            for (const config of keywordConfigs as any[]) {
                try {
                    const keywords = JSON.parse(config.keywords);
                    if (Array.isArray(keywords) && keywords.length > 0) {
                        const keywordsStr = keywords.map((k: string) => `"${k}"`).join('、');
                        dynamicRules += `\n${ruleIndex}. 若账单详情包含${keywordsStr}等内容，请强制分类为"${config.category}"。`;
                        ruleIndex++;
                    }
                } catch (e) {
                    // skip invalid json
                }
            }
        }

        const systemPrompt = `你是一个专业的财务账单助手。请帮我分析下面的账单文本，提取出每一笔交易记录。

要求：
1. 忽略"还款"类型的记录。
2. 遇到"退款"交易，将其视为"收入"。
3. 只提取有效的交易记录，忽略无关的文本行。
4. 信用卡交易明细表中第一列是"交易日"，第二列是"记账日"。每笔交易的 date 必须使用该交易行第一列"交易日"，不能使用账单日、到期还款日、记账日、打印日或页面标题日期。
5. 若交易日是 MM/DD 格式，请结合账单日年份和账单月份推断年份；例如 2026年01月账单中的 12/09 应为 2025-12-09，01/03 应为 2026-01-03。
6. 如果无法确定分类，可以留空或填"其他"。${dynamicRules}`;

        const userMessage = {
            role: 'user' as const,
            content: `账单文本内容：\n${body.text.substring(0, 10000)}`
        };
        const languageModel = deepseek.chat('deepseek-chat');

        const { object } = await generateObject({
            model: languageModel,
            schema: schema,
            system: systemPrompt,
            messages: [userMessage],
            maxTokens: 8192
        });

        // 映射分类
        const mappedTransactions = object.transactions.map(transaction => {
            return {
                ...transaction,
                category: normalizeParsedCategory(transaction.type, transaction.category)
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
