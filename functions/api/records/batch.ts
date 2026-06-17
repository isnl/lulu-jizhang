// Cloudflare Functions API for batch record creation
// Path: /api/records/batch

import { authenticate, corsHeaders, unauthorizedResponse } from '../../utils/middleware';

interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}

interface RecordData {
    type: '支出' | '收入';
    category: string;
    amount: number;
    date: string;
    remark?: string;
    source?: string;
    counterparty?: string;
    product?: string;
    payMethod?: string;
    sourceTransactionId?: string;
    dedupeKey?: string;
    forceImport?: boolean;
    memberId?: number | null;
}

interface ExistingRecord extends RecordData {
    id: number;
}

interface BatchImportRequest {
    records: RecordData[];
    memberId?: number | null;
}

const RECORD_TYPES = ['支出', '收入'];

const EXPENSE_CATEGORIES = [
    '生活费', '交通', '饮食', '日用品', '娱乐', '学习',
    '电子产品', '人情', '宠物', '饰品', '美妆护肤', '医疗', '保险',
    '保健', '通讯', '服饰', '还贷', '家电/家具', '工作待报销'
];

const INCOME_CATEGORIES = [
    '工资', '投资收入', '稿费收入', '其他'
];

const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

function isCategoryAllowedForType(type: string, category: string): boolean {
    if (type === '支出') return EXPENSE_CATEGORIES.includes(category);
    if (type === '收入') return INCOME_CATEGORIES.includes(category);
    return false;
}

const VALIDATION = {
    amount: {
        min: 0,
        max: 999999999
    }
};

const sourceAliases: Record<string, string> = {
    '银行卡': 'bank',
    '银行': 'bank',
    '信用卡': 'credit',
    '支付宝': 'alipay',
    '微信': 'wechat',
    '京东': 'jd',
    bank: 'bank',
    credit: 'credit',
    alipay: 'alipay',
    wechat: 'wechat',
    jd: 'jd'
};

function normalizeSource(source = ''): string {
    return sourceAliases[source.trim()] || source.trim().toLowerCase();
}

function splitMergedValues(value = ''): string[] {
    return value.split('/').map(item => item.trim()).filter(Boolean);
}

function normalizeSourceValues(source = ''): string[] {
    const values = splitMergedValues(source);
    return (values.length > 0 ? values : [source]).map(normalizeSource).filter(Boolean);
}

function hasMergedValue(value = '', target = ''): boolean {
    return splitMergedValues(value).includes(target.trim());
}

function sourcesOverlap(a = '', b = ''): boolean {
    const aSources = normalizeSourceValues(a);
    const bSources = normalizeSourceValues(b);
    return aSources.some(source => bSources.includes(source));
}

function sourceHas(source = '', target = ''): boolean {
    return normalizeSourceValues(source).includes(target);
}

function daysBetween(a: string, b: string): number {
    return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 3600 * 24);
}

function isSameMonth(a: string, b: string): boolean {
    return a.slice(0, 7) === b.slice(0, 7);
}

const SALARY_MARKERS = [
    '\u5de5\u8d44',
    '\u85aa',
    '\u85aa\u916c',
    '\u4ee3\u53d1'
].map(normalizeDedupeText);

function normalizeDedupeText(value = ''): string {
    return value.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();
}

function getDedupeDetailText(record: RecordData): string {
    return normalizeDedupeText([record.remark, record.counterparty, record.product, record.payMethod].filter(Boolean).join(' '));
}

function isSalaryIncomePair(record: RecordData, existing: RecordData): boolean {
    if (record.type !== '\u6536\u5165' || existing.type !== '\u6536\u5165') return false;
    if (!sameMember(record, existing)) return false;

    const recordText = getDedupeDetailText(record);
    const existingText = getDedupeDetailText(existing);
    const recordLooksSalary = record.category === '\u5de5\u8d44' || SALARY_MARKERS.some(marker => marker && recordText.includes(marker));
    const existingLooksSalary = existing.category === '\u5de5\u8d44' || SALARY_MARKERS.some(marker => marker && existingText.includes(marker));
    return recordLooksSalary && existingLooksSalary;
}

const TRANSFER_MARKERS = [
    '\u8f6c\u8d26',
    '\u6c47\u6b3e',
    '\u8de8\u884c',
    '\u7f51\u94f6\u4e92\u8054',
    '\u8f6c\u51fa',
    '\u8f6c\u5165',
    '\u5feb\u6377\u652f\u4ed8',
    '\u94f6\u8054\u5feb\u6377\u652f\u4ed8'
].map(normalizeDedupeText);

const TRANSFER_TOKEN_STOP_WORDS = [
    ...TRANSFER_MARKERS,
    '\u652f\u4ed8',
    '\u94f6\u8054',
    '\u7f51\u94f6',
    '\u4e92\u8054'
].map(normalizeDedupeText).sort((a, b) => b.length - a.length);

function getRecordTextParts(record: RecordData): string[] {
    return [record.remark, record.counterparty, record.product, record.payMethod].filter(Boolean) as string[];
}

function hasTransferMarker(record: RecordData): boolean {
    const text = normalizeDedupeText(getRecordTextParts(record).join(' '));
    return TRANSFER_MARKERS.some(marker => marker && text.includes(marker));
}

function getTransferCounterpartyTokens(record: RecordData): Set<string> {
    const tokens = new Set<string>();

    for (const value of getRecordTextParts(record)) {
        let text = normalizeDedupeText(value);
        for (const stopWord of TRANSFER_TOKEN_STOP_WORDS) {
            text = text.replaceAll(stopWord, '');
        }
        if (text.length >= 2 && text.length <= 8) {
            tokens.add(text);
        }
    }

    return tokens;
}

function isBankCreditTransferPair(record: RecordData, existing: RecordData): boolean {
    const recordIsBank = sourceHas(record.source, 'bank');
    const existingIsBank = sourceHas(existing.source, 'bank');
    const recordIsCredit = sourceHas(record.source, 'credit');
    const existingIsCredit = sourceHas(existing.source, 'credit');
    if (!((recordIsBank && existingIsCredit) || (recordIsCredit && existingIsBank))) return false;
    if (!hasTransferMarker(record) && !hasTransferMarker(existing)) return false;

    const recordTokens = getTransferCounterpartyTokens(record);
    const existingTokens = getTransferCounterpartyTokens(existing);
    return [...recordTokens].some(token => existingTokens.has(token));
}

function isCreditThirdPartyPair(record: RecordData, existing: RecordData): boolean {
    const recordIsCredit = sourceHas(record.source, 'credit');
    const existingIsCredit = sourceHas(existing.source, 'credit');
    if (recordIsCredit === existingIsCredit) return false;

    const creditRecord = recordIsCredit ? record : existing;
    const thirdParty = recordIsCredit ? existing : record;
    const creditText = [creditRecord.remark, creditRecord.counterparty, creditRecord.product].filter(Boolean).join(' ');

    if (sourceHas(thirdParty.source, 'alipay')) return creditText.includes('支付宝');
    if (sourceHas(thirdParty.source, 'wechat')) return creditText.includes('财付通') || creditText.includes('微信');
    return false;
}

function hasCompatibleDedupeText(record: RecordData, existing: RecordData): boolean {
    const recordText = getDedupeDetailText(record);
    const existingText = getDedupeDetailText(existing);
    if (!recordText || !existingText) return false;
    if (recordText === existingText) return true;
    if (recordText.length >= 4 && existingText.includes(recordText)) return true;
    if (existingText.length >= 4 && recordText.includes(existingText)) return true;
    return false;
}

function stripPaymentPrefix(value: string): string {
    return value.replace(/^(支付宝|财付通|微信支付|拼多多支付|京东支付)/, '');
}

function hasSharedDedupeFragment(record: RecordData, existing: RecordData): boolean {
    const recordParts = [record.product, record.counterparty, record.remark]
        .map(value => stripPaymentPrefix(normalizeDedupeText(value || '')))
        .filter(value => value.length >= 4);
    const existingParts = [existing.product, existing.counterparty, existing.remark]
        .map(value => stripPaymentPrefix(normalizeDedupeText(value || '')))
        .filter(value => value.length >= 4);

    return recordParts.some(recordPart => existingParts.some(existingPart => (
        recordPart.includes(existingPart) || existingPart.includes(recordPart)
    )));
}

function sameMember(a: RecordData, b: RecordData): boolean {
    const aMember = a.memberId === undefined ? null : a.memberId;
    const bMember = b.memberId === undefined ? null : b.memberId;
    return aMember === bMember;
}

function bankMatchesThirdParty(bank: RecordData, other: RecordData): boolean {
    const bankText = [bank.remark, bank.counterparty, bank.product].filter(Boolean).join(' ');

    if (sourceHas(other.source, 'alipay')) return bankText.includes('支付宝');
    if (sourceHas(other.source, 'wechat')) return bankText.includes('财付通') || bankText.includes('微信');
    if (sourceHas(other.source, 'jd')) return bankText.includes('网银在线') || bankText.includes('京东');
    return false;
}

function isBankThirdPartyPair(record: RecordData, existing: RecordData): boolean {
    return (
        (sourceHas(record.source, 'bank') && bankMatchesThirdParty(record, existing)) ||
        (sourceHas(existing.source, 'bank') && bankMatchesThirdParty(existing, record))
    );
}

function hasSameDedupeKey(record: RecordData, existing: RecordData): boolean {
    return Boolean(
        record.dedupeKey &&
        existing.dedupeKey &&
        (record.dedupeKey === existing.dedupeKey || hasMergedValue(existing.dedupeKey, record.dedupeKey))
    );
}

function hasSameSourceTransaction(record: RecordData, existing: RecordData): boolean {
    return Boolean(
        sourcesOverlap(record.source, existing.source) &&
        record.sourceTransactionId &&
        existing.sourceTransactionId &&
        (record.sourceTransactionId === existing.sourceTransactionId ||
            hasMergedValue(existing.sourceTransactionId, record.sourceTransactionId))
    );
}

function isExactDuplicateRecord(record: RecordData, existing: RecordData): boolean {
    if (!sameMember(record, existing)) return false;

    const sameAmountType = record.type === existing.type && Math.abs(Number(record.amount) - Number(existing.amount)) < 0.01;
    if (!sameAmountType) return false;

    if (daysBetween(record.date, existing.date) <= 1 && isSalaryIncomePair(record, existing)) return true;

    return hasSameDedupeKey(record, existing) ||
        hasSameSourceTransaction(record, existing) ||
        (
            sourcesOverlap(record.source, existing.source) &&
            record.date === existing.date &&
            hasCompatibleDedupeText(record, existing)
        );
}

function isCrossSourceBankMatch(record: RecordData, existing: RecordData): boolean {
    const isCrossMemberBankThirdParty = !sameMember(record, existing) && isBankThirdPartyPair(record, existing);
    const isCreditThirdParty = isCreditThirdPartyPair(record, existing);
    const isBankCreditTransfer = isBankCreditTransferPair(record, existing);
    if (!sameMember(record, existing) && !isCrossMemberBankThirdParty && !isCreditThirdParty && !isBankCreditTransfer) return false;

    const sameAmountType = record.type === existing.type && Math.abs(Number(existing.amount) - Number(record.amount)) < 0.01;
    if (!sameAmountType) return false;

    if (daysBetween(record.date, existing.date) > 1 && !(isBankCreditTransfer && isSameMonth(record.date, existing.date))) return false;

    if (isBankThirdPartyPair(record, existing)) return true;

    if (isCreditThirdParty) return true;

    if (isBankCreditTransfer) return true;

    return false;
}

function selectCrossSourceMatch(record: RecordData, matches: ExistingRecord[]): ExistingRecord | undefined {
    if (matches.length === 0) return undefined;
    if (matches.length === 1) return matches[0];

    const sameDateMatches = matches.filter(existing => existing.date === record.date);
    if (sameDateMatches.length === 1) return sameDateMatches[0];

    const sameMemberMatches = matches.filter(existing => sameMember(record, existing));
    if (sameMemberMatches.length === 1) return sameMemberMatches[0];

    const sameDateAndMemberMatches = sameDateMatches.filter(existing => sameMember(record, existing));
    if (sameDateAndMemberMatches.length === 1) return sameDateAndMemberMatches[0];

    return undefined;
}

function mergeText(current = '', incoming = ''): string {
    const currentText = current.trim();
    const incomingText = incoming.trim();
    if (!incomingText) return currentText;
    if (!currentText) return incomingText;
    if (currentText.includes(incomingText)) return currentText;
    if (incomingText.includes(currentText)) return incomingText;
    return `${currentText} / ${incomingText}`.slice(0, 200);
}

function preferIncomingText(current = '', incoming = ''): string {
    const currentText = current.trim();
    const incomingText = incoming.trim();
    if (!incomingText) return currentText;
    if (!currentText) return incomingText;
    return incomingText.length > currentText.length ? incomingText : currentText;
}

function buildMergedRecord(existing: ExistingRecord, incoming: RecordData): ExistingRecord {
    return {
        ...existing,
        category: existing.category === '其他' && incoming.category ? incoming.category : existing.category,
        remark: preferIncomingText(existing.remark || '', incoming.remark || ''),
        source: mergeText(existing.source || '', incoming.source || ''),
        counterparty: preferIncomingText(existing.counterparty || '', incoming.counterparty || ''),
        product: preferIncomingText(existing.product || '', incoming.product || ''),
        payMethod: preferIncomingText(existing.payMethod || '', incoming.payMethod || ''),
        sourceTransactionId: mergeText(existing.sourceTransactionId || '', incoming.sourceTransactionId || ''),
        dedupeKey: mergeText(existing.dedupeKey || '', incoming.dedupeKey || '')
    };
}

function hasSupplement(existing: ExistingRecord, merged: ExistingRecord): boolean {
    return (
        existing.category !== merged.category ||
        (existing.remark || '') !== (merged.remark || '') ||
        (existing.source || '') !== (merged.source || '') ||
        (existing.counterparty || '') !== (merged.counterparty || '') ||
        (existing.product || '') !== (merged.product || '') ||
        (existing.payMethod || '') !== (merged.payMethod || '') ||
        (existing.sourceTransactionId || '') !== (merged.sourceTransactionId || '') ||
        (existing.dedupeKey || '') !== (merged.dedupeKey || '')
    );
}

function toExistingRecord(row: any): ExistingRecord {
    return {
        id: row.id,
        type: row.type,
        category: row.category,
        amount: row.amount,
        date: row.date,
        remark: row.remark || '',
        source: row.source || '',
        counterparty: row.counterparty || '',
        product: row.product || '',
        payMethod: row.pay_method || '',
        sourceTransactionId: row.source_transaction_id || '',
        dedupeKey: row.dedupe_key || '',
        memberId: row.member_id
    };
}

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, {
        headers: corsHeaders
    });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        // 认证检查
        const auth = await authenticate(context.request, context.env);
        if (!auth.success) {
            return unauthorizedResponse();
        }

        const { DB } = context.env;
        const body = await context.request.json() as any;

        let records: RecordData[];
        let batchMemberId: number | null = null;

        if (Array.isArray(body)) {
            records = body;
        } else if (body && Array.isArray(body.records)) {
            records = body.records;
            batchMemberId = body.memberId ?? null;
        } else {
            return new Response(JSON.stringify({
                error: '请提供有效的记录数组'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (records.length === 0) {
            return new Response(JSON.stringify({
                error: '请提供有效的记录数组'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Validate all records first
        for (const record of records) {
            const { type, category, amount, date } = record;

            if (!type || !category || amount === undefined || !date) {
                return new Response(JSON.stringify({
                    error: '记录缺少必填字段'
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (!RECORD_TYPES.includes(type)) {
                return new Response(JSON.stringify({
                    error: `无效的记录类型：${type}`
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (!CATEGORIES.includes(category)) {
                return new Response(JSON.stringify({
                    error: `无效的分类：${category}`
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (!isCategoryAllowedForType(type, category)) {
                return new Response(JSON.stringify({
                    error: `分类"${category}"不能用于"${type}"记录`
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const numAmount = parseFloat(amount.toString());
            if (isNaN(numAmount) || numAmount < VALIDATION.amount.min || numAmount > VALIDATION.amount.max) {
                return new Response(JSON.stringify({
                    error: `金额必须是${VALIDATION.amount.min}到${VALIDATION.amount.max}之间的数字`
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const recordDate = new Date(date);
            if (isNaN(recordDate.getTime())) {
                return new Response(JSON.stringify({
                    error: '无效的日期格式'
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        const normalizedRecords = records.map(record => ({
            ...record,
            amount: parseFloat(record.amount.toString()),
            memberId: record.memberId !== undefined ? record.memberId : batchMemberId
        }));

        let minDate = normalizedRecords[0].date;
        let maxDate = normalizedRecords[0].date;
        for (const record of normalizedRecords) {
            if (record.date < minDate) minDate = record.date;
            if (record.date > maxDate) maxDate = record.date;
        }

        const rangeStart = new Date(minDate);
        rangeStart.setDate(rangeStart.getDate() - 2);
        const rangeEnd = new Date(maxDate);
        rangeEnd.setDate(rangeEnd.getDate() + 2);

        const { results: existingRows } = await DB.prepare(
            'SELECT * FROM records WHERE date >= ? AND date <= ?'
        ).bind(rangeStart.toISOString().split('T')[0], rangeEnd.toISOString().split('T')[0]).all();

        const acceptedRecords: RecordData[] = [];
        const duplicateRecords: RecordData[] = [];
        const recordsToUpdate = new Map<number, ExistingRecord>();
        const historicalRecords = (existingRows || []).map(toExistingRecord);
        const acceptedComparisonRecords: ExistingRecord[] = [];

        for (const record of normalizedRecords) {
            const historicalExactMatch = record.forceImport
                ? undefined
                : historicalRecords.find(existing => isExactDuplicateRecord(record, existing));
            const crossSourceMatches = historicalExactMatch || record.forceImport
                ? []
                : historicalRecords.filter(existing => isCrossSourceBankMatch(record, existing));
            const batchExactMatch = acceptedComparisonRecords.find(existing => isExactDuplicateRecord(record, existing));
            const existing = historicalExactMatch || selectCrossSourceMatch(record, crossSourceMatches) || batchExactMatch;

            if (existing) {
                if (existing.id > 0) {
                    const merged = buildMergedRecord(recordsToUpdate.get(existing.id) || existing, record);
                    if (hasSupplement(existing, merged)) {
                        recordsToUpdate.set(existing.id, merged);
                        const historicalIndex = historicalRecords.findIndex(item => item.id === existing.id);
                        if (historicalIndex !== -1) {
                            historicalRecords[historicalIndex] = merged;
                        }
                    }
                }
                duplicateRecords.push(record);
                continue;
            }

            acceptedRecords.push(record);
            acceptedComparisonRecords.push({
                ...record,
                id: -acceptedRecords.length
            });
        }

        const updateStatements = [...recordsToUpdate.values()].map(record => DB.prepare(
            `UPDATE records
             SET category = ?,
                 remark = ?,
                 source = ?,
                 counterparty = ?,
                 product = ?,
                 pay_method = ?,
                 source_transaction_id = ?,
                 dedupe_key = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        ).bind(
            record.category,
            record.remark || '',
            record.source || '',
            record.counterparty || '',
            record.product || '',
            record.payMethod || '',
            record.sourceTransactionId || '',
            record.dedupeKey || '',
            record.id
        ));

        if (acceptedRecords.length === 0 && updateStatements.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: '没有新记录需要导入',
                count: 0,
                updatedDuplicates: 0,
                skippedDuplicates: duplicateRecords.length
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const statements = acceptedRecords.map(record => {
            const memberId = record.memberId !== undefined ? record.memberId : batchMemberId;
            return DB.prepare(
                `INSERT INTO records (
                    type, category, amount, date, remark, source,
                    counterparty, product, pay_method, source_transaction_id, dedupe_key,
                    member_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                record.type,
                record.category,
                record.amount,
                record.date,
                record.remark || '',
                record.source || '',
                record.counterparty || '',
                record.product || '',
                record.payMethod || '',
                record.sourceTransactionId || '',
                record.dedupeKey || '',
                memberId
            );
        });

        const results = statements.length > 0 ? await DB.batch(statements) : [];
        if (updateStatements.length > 0) {
            await DB.batch(updateStatements);
        }

        return new Response(JSON.stringify({
            success: true,
            message: `成功导入 ${results.length} 条记录`,
            count: results.length,
            updatedDuplicates: updateStatements.length,
            skippedDuplicates: duplicateRecords.length - updateStatements.length
        }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('批量创建记录失败:', error);
        return new Response(JSON.stringify({
            error: '服务器内部错误' + (error instanceof Error ? ': ' + error.message : '')
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
