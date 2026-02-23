-- Create category_keywords table
CREATE TABLE IF NOT EXISTS category_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    type TEXT CHECK(type IN ('支出', '收入')) DEFAULT '支出',
    keywords TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category, type)
);

-- Insert initial mappings based on previous hardcoded logic
INSERT INTO category_keywords (category, type, keywords) VALUES 
('生活费', '支出', '["生活费"]'),
('宠物', '支出', '["驱虫", "猫粮", "狗粮", "宠物医院", "宠物"]'),
('美妆护肤', '支出', '["素心微暖", "美妆", "护肤", "化妆品"]'),
('服饰', '支出', '["唯品会", "快乐的鞋子", "衣服", "服饰", "鞋"]'),
('学习', '支出', '["得到", "知识", "课程", "培训", "书店", "账号", "SPACESHIP", "Cursor", "Claude", "code", "额度"]'),
('娱乐', '支出', '["电影", "游戏", "KTV", "酒吧"]'),
('饰品', '支出', '["喜乐", "崔小七", "饰品", "首饰", "珠宝"]'),
('人情', '支出', '["转账", "红包", "发红包", "微信红包", "赞赏码", "收款码"]'),
('交通', '支出', '["停车", "打车", "滴滴", "公交", "地铁", "加油", "出行", "中国铁路", "12306"]'),
('保险', '支出', '["保险", "平安", "太平洋保险", "人寿", "车险", "意外险", "重疾险", "医疗险", "寿险"]'),
('医疗', '支出', '["医院", "药店", "诊所", "体检", "挂号"]'),
('饮食', '支出', '["美团", "饿了么", "外卖", "餐饮", "饭店", "食堂", "盒马", "麻辣", "拼多多平台商户", "常记食府", "驴肉火烧", "唐久", "逗零嘴", "双汇", "羊杂", "烧饼", "面"]'),
('日用品', '支出', '["京东", "快团团", "超市", "便利店", "淘宝", "拼多多"]'),
('通讯', '支出', '["话费", "流量", "宽带", "移动", "联通", "电信"]');

INSERT INTO category_keywords (category, type, keywords) VALUES 
('工资', '收入', '["工资", "薪资", "薪酬", "公司"]'),
('投资收入', '收入', '["投资", "理财", "股票", "基金", "分红"]'),
('稿费收入', '收入', '["稿费", "写作", "文章", "版税"]'),
('其他', '收入', '["红包", "现金奖励"]');
