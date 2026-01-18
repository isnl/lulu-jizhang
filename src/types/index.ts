export interface RecordData {
    id?: number
    type: '支出' | '收入'
    category: string
    amount: number
    date: string
    remark?: string
    createdAt?: string
    updatedAt?: string
    日总计?: number
    月总计?: number
}

export interface DailyRecord extends Omit<RecordData, 'type'> {
    type: 'daily'
    生活费?: number
    交通?: number
    饮食?: number
    日用品?: number
    娱乐?: number
    学习?: number
    电子产品?: number
    人情?: number
    宠物?: number
    饰品?: number
    美妆护肤?: number
    医疗?: number
    通讯?: number
    服饰?: number
    还贷?: number
    工资?: number
    投资收入?: number
    稿费收入?: number
    其他?: number
    日总计: number
}

export interface MonthlyRecord extends Omit<RecordData, 'type'> {
    type: 'monthly'

    生活费?: number
    交通?: number
    饮食?: number
    日用品?: number
    娱乐?: number
    学习?: number
    电子产品?: number
    人情?: number
    宠物?: number
    饰品?: number
    美妆护肤?: number
    医疗?: number
    通讯?: number
    服饰?: number
    还贷?: number
    工资?: number
    投资收入?: number
    稿费收入?: number
    其他?: number
    月总计: number
}

export const RECORD_TYPES = ['支出', '收入'] as const

// 支出类别
export const EXPENSE_CATEGORIES = [
    '生活费', '交通', '饮食', '日用品', '娱乐', '学习',
    '电子产品', '人情', '宠物', '饰品', '美妆护肤', '医疗',
    '通讯', '服饰', '还贷'
] as const

// 收入类别
export const INCOME_CATEGORIES = [
    '工资', '投资收入', '稿费收入', '其他'
] as const

// 所有类别（用于向后兼容）
export const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] as const
