#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
核心账单解析模块
包含 PDFBillConverter 类,用于解析信用卡账单PDF
"""

import pdfplumber
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from pathlib import Path
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
import sys
import io

# 移除全局 stdout 重置,由调用者负责
# if sys.platform == 'win32':
#     sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

class PDFBillConverter:
    def __init__(self, pdf_path: str):
        self.pdf_path = Path(pdf_path)
        self.transactions = []
        self.bill_info = {}
        
    def extract_text(self) -> str:
        """从PDF中提取所有文本"""
        print(f"[读取] 正在读取PDF: {self.pdf_path.name}")
        full_text = ""
        with pdfplumber.open(self.pdf_path) as pdf:
            print(f"   总页数: {len(pdf.pages)}")
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text:
                    full_text += text + "\n"
                print(f"   已处理: {i+1}/{len(pdf.pages)} 页", end='\r')
        print(f"\n[完成] PDF读取完成,共提取 {len(full_text)} 个字符")
        return full_text
    
    def extract_tables(self) -> List[List[List[str]]]:
        """从PDF中提取所有表格数据"""
        print(f"[表格] 正在提取表格数据...")
        all_tables = []
        with pdfplumber.open(self.pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                tables = page.extract_tables()
                if tables:
                    all_tables.extend(tables)
                    print(f"   第{i+1}页找到 {len(tables)} 个表格")
        print(f"[完成] 共提取 {len(all_tables)} 个表格")
        return all_tables
        
    def _extract_bill_info(self, text: str):
        """提取账单基本信息"""
        # 常见关键字模式
        patterns = {
            '账单月份': r'(?:账单|Statement).*?(\d{4})[年\s]*(\d{1,2})[月\s]',
            '账单日': r'账单日[：:\s]*(\d{4}年\d{1,2}月\d{1,2}日)',
            '信用额度': r'信用额度[：:\s]*[¥￥]?\s*([\d,]+\.?\d*)',
            '本期应还': r'本期应还(?:金额)?[：:\s]*[¥￥]?\s*([\d,]+\.?\d*)',
            '最低还款': r'本期最低还款额[：:\s]*[¥￥]?\s*([\d,]+\.?\d*)',
            '到期还款日': r'到期还款日[：:\s]*(\d{4}年\d{1,2}月\d{1,2}日)',
        }
        
        for key, pattern in patterns.items():
            match = re.search(pattern, text)
            if match:
                if key == '账单月份':
                    self.bill_info[key] = f"{match.group(1)}-{match.group(2).zfill(2)}"
                else:
                    self.bill_info[key] = match.group(1).strip()
    
    def _is_header_row(self, row: List[str]) -> bool:
        """判断是否是交易明细的表头行"""
        # 招商银行表头关键字
        keywords = ['交易日', '记账日', '交易摘要', '金额/币种', '卡号末四位', '交易地金额']
        # 英文关键字
        eng_keywords = ['Trans', 'Post', 'Description', 'Amount', 'Card Number']
        
        row_str = "".join([str(x) for x in row if x])
        
        # 检查是否包含足够多的关键字
        match_count = sum(1 for k in keywords if k in row_str)
        eng_match_count = sum(1 for k in eng_keywords if k in row_str)
        
        return match_count >= 3 or eng_match_count >= 3
    
    def _parse_date(self, date_str: str) -> str:
        """解析日期字符串"""
        if not date_str:
            return ""
            
        # 移除多余空格
        date_str = str(date_str).strip()
        
        # 尝试多种日期格式
        patterns = [
            r'(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})',
            r'(\d{1,2})[-/月](\d{1,2})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, date_str)
            if match:
                groups = match.groups()
                if len(groups) == 3:
                    return f"{groups[0]}-{groups[1].zfill(2)}-{groups[2].zfill(2)}"
                elif len(groups) == 2:
                    # 补充年份
                    year = datetime.now().year
                    # 如果在账单中有提取到年份,使用账单年份
                    if '账单月份' in self.bill_info:
                        year_match = re.search(r'(\d{4})', self.bill_info['账单月份'])
                        if year_match:
                            year = int(year_match.group(1))
                    
                    return f"{year}-{groups[0].zfill(2)}-{groups[1].zfill(2)}"
        
        return date_str
    
    def _parse_date_cmb(self, date_str: str) -> str:
        """解析招商银行专用日期格式 (MM/DD)"""
        if not date_str:
            return ""
            
        # 招商银行格式: 11/27 (月/日)
        match = re.search(r'(\d{1,2})/(\d{1,2})', str(date_str))
        if match:
            month = match.group(1).zfill(2)
            day = match.group(2).zfill(2)
            
            # 从账单信息中获取年份,或使用当前年份
            year = datetime.now().year
            if '账单月份' in self.bill_info:
                year_match = re.search(r'(\d{4})', self.bill_info['账单月份'])
                if year_match:
                    year = int(year_match.group(1))
                    # 特殊处理:如果是1月账单出现12月交易,年份减1
                    if self.bill_info['账单月份'].endswith('01') and month == '12':
                        year -= 1
            
            return f"{year}-{month}-{day}"
        
        # 尝试其他格式
        return self._parse_date(date_str)
    
    def _determine_transaction_type(self, description: str, amount: float) -> str:
        """根据描述和金额判断交易类型"""
        desc = str(description).lower()
        
        # 还款
        if '还款' in desc or 'payment' in desc:
            return '还款'
        
        # 退款
        if '退款' in desc or 'refund' in desc or amount > 0:
            return '退款'
        
        # 消费
        return '消费'

    def _parse_amount(self, amount_str: str) -> float:
        """解析金额"""
        if not amount_str:
            return 0.0
        
        # 移除货币符号和逗号
        amount_str = str(amount_str).replace('¥', '').replace('￥', '').replace(',', '').strip()
        
        # 处理正负号
        is_negative = '-' in amount_str or '支出' in amount_str
        
        # 提取数字
        match = re.search(r'([\d,]+\.?\d*)', amount_str)
        if match:
            try:
                amount = float(match.group(1).replace(',', ''))
                # 注意:这里的正负号逻辑根据调用者自行处理,这里只返回带符号的原始数值
                # 如果字符串本来就有负号,就返回负数;否则返回正数
                return -abs(amount) if is_negative else abs(amount)
            except ValueError:
                return 0.0
        
        return 0.0

    
    def _parse_transaction_row_cmb(self, row: List[str]) -> Dict[str, Any]:
        """解析招商银行信用卡账单的交易行
        
        格式: [交易日, 记账日, 交易摘要, 人民币金额, 卡号末四位, 交易地金额]
        还款: ['', '11/27', '自动还款', '-1,731.52', '3686', '-1,731.52']  # 还款不计入收支
        退款: ['11/23', '11/24', '支付宝-拼多多平台商户', '-25.20', '3686', '-25.20(CN)']  # 退款=收入
        消费: ['11/23', '11/24', '支付宝-拼多多平台商户', '25.20', '3686', '25.20(CN)']  # 消费=支出
        """
        if not row or len(row) < 3:
            return None
        
        try:
            # 检查第一列是否为空(还款类交易)
            if not row[0] or str(row[0]).strip() == '':
                # 还款格式: ['', 交易日, 交易摘要, 金额, 卡号, 交易地金额]
                trans_date = row[1] if len(row) > 1 else ''
                post_date = trans_date  # 还款没有单独的记账日
                description = row[2] if len(row) > 2 else ''
                amount_str = row[3] if len(row) > 3 else '0'
                card_num = row[4] if len(row) > 4 else ''
                original_amount = row[5] if len(row) > 5 else amount_str
            elif len(row) == 6:
                # 标准格式: [交易日, 记账日, 交易摘要, 金额, 卡号, 交易地金额]
                trans_date = row[0]
                post_date = row[1]
                description = row[2]
                amount_str = row[3]
                card_num = row[4]
                original_amount = row[5]
            else:
                # 尝试智能识别
                trans_date = row[0] if len(row) > 0 else ''
                description = row[1] if len(row) > 1 else ''
                amount_str = row[2] if len(row) > 2 else '0'
                card_num = row[3] if len(row) > 3 else ''
                post_date = trans_date
                original_amount = amount_str
            
            # 跳过表头行
            if '交易日' in str(trans_date) or 'Trans' in str(trans_date):
                return None
            
            # 解析金额(保留正负号)
            amount = self._parse_amount(amount_str)
            if amount == 0:
                return None
            
            # 解析日期
            parsed_date = self._parse_date_cmb(trans_date)
            
            # 判断交易类型和收支
            # 新逻辑:
            # - 还款: 类型=还款,收支=还款(不计入收支统计)
            # - 退款: 类型=退款,收支=收入
            # - 消费: 类型=消费,收支=支出
            desc = str(description).lower()
            
            if '还款' in desc or 'payment' in desc:
                trans_type = '还款'
                income_or_expense = '还款'  # 还款单独标记,不计入收支
            elif '退款' in desc or 'refund' in desc or (amount < 0 and '还款' not in desc):
                trans_type = '退款'
                income_or_expense = '收入'  # 退款计入收入
            else:
                trans_type = '消费'
                income_or_expense = '支出'  # 消费计入支出
            
            return {
                '交易日期': parsed_date,
                '记账日期': self._parse_date_cmb(post_date),
                '交易说明': str(description).strip(),
                '金额': abs(amount),
                '类型': trans_type,
                '收支': income_or_expense,
                '卡号末四位': str(card_num).strip(),
                '币种': 'CNY'
            }
            
        except Exception as e:
            print(f"[警告] 解析行数据失败: {row}, 错误: {e}")
            return None
    
    def _parse_transactions_from_text(self, text: str) -> List[Dict[str, Any]]:
        """从文本中提取所有交易记录(补充表格遗漏的记录)"""
        transactions = []
        lines = text.split('\n')
        
        for line in lines:
            # 匹配招商银行交易格式: MM/DD MM/DD 描述 金额 卡号 金额(币种)
            # 例如: 11/23 11/24 支付宝-拼多多平台商户 25.20 3686 25.20(CN)
            # 或者是负数: 12/02 12/03 财付通-Lovelycup -16.00 3686 -16.00(CN)
            pattern = r'(\d{2}/\d{2})\s+(\d{2}/\d{2})\s+(.+?)\s+([-]?[\d,]+\.?\d*)\s+(\d{4})\s+([-]?[\d,]+\.?\d*)'
            match = re.search(pattern, line)
            
            if match:
                trans_date = match.group(1)
                post_date = match.group(2)
                description = match.group(3).strip()
                amount_str = match.group(4)
                card_num = match.group(5)
                
                # 跳过表头
                if '交易日' in description or 'Trans' in description:
                    continue
                
                # 解析金额
                amount = self._parse_amount(amount_str)
                if amount == 0:
                    continue
                
                # 解析日期
                parsed_date = self._parse_date_cmb(trans_date)
                
                # 判断类型
                desc_lower = description.lower()
                if '还款' in desc_lower or 'payment' in desc_lower:
                    trans_type = '还款'
                    income_or_expense = '还款'
                elif '退款' in desc_lower or 'refund' in desc_lower or (amount < 0 and '还款' not in desc_lower):
                    trans_type = '退款'
                    income_or_expense = '收入'
                else:
                    trans_type = '消费'
                    income_or_expense = '支出'
                
                transactions.append({
                    '交易日期': parsed_date,
                    '记账日期': self._parse_date_cmb(post_date),
                    '交易说明': description,
                    '金额': abs(amount),
                    '类型': trans_type,
                    '收支': income_or_expense,
                    '卡号末四位': card_num,
                    '币种': 'CNY'
                })
        
        return transactions

    def parse_credit_card_bill(self, text: str, tables: List[List[List[str]]]):
        """解析信用卡账单"""
        print("[解析] 正在解析信用卡账单...")
        
        # 提取账单基本信息
        self._extract_bill_info(text)
        
        # 方法1: 从表格中提取
        header_found = False
        
        for table in tables:
            if not table or len(table) == 0:
                continue
            
            first_row = table[0]
            
            # 检查是否是表头
            if self._is_header_row(first_row):
                header_found = True
                print(f"[表头] 找到表头: {first_row}")
                
                # 如果表格有多行,处理后续行
                if len(table) > 1:
                    for row in table[1:]:
                        transaction = self._parse_transaction_row_cmb(row)
                        if transaction:
                            self.transactions.append(transaction)
            
            # 如果已经找到表头,后续的单行表格都是交易记录
            elif header_found and len(table) == 1:
                transaction = self._parse_transaction_row_cmb(first_row)
                if transaction:
                    self.transactions.append(transaction)
        
        print(f"[表格] 从表格中提取了 {len(self.transactions)} 条记录")
        
        # 方法2: 从文本中提取(补充遗漏的记录)
        text_transactions = self._parse_transactions_from_text(text)
        
        # 去重:检查文本提取的记录是否已存在
        existing_keys = set()
        for t in self.transactions:
            key = f"{t['交易日期']}_{t['交易说明']}_{t['金额']}"
            existing_keys.add(key)
        
        added_count = 0
        for t in text_transactions:
            key = f"{t['交易日期']}_{t['交易说明']}_{t['金额']}"
            if key not in existing_keys:
                self.transactions.append(t)
                existing_keys.add(key)
                added_count += 1
        
        if added_count > 0:
            print(f"[文本] 从文本中补充了 {added_count} 条遗漏的记录")
        
        print(f"[完成] 解析完成,共找到 {len(self.transactions)} 条交易记录")
        
    def get_json_data(self) -> Dict[str, Any]:
        """获取JSON格式的解析数据(用于API服务)"""
        # 计算统计信息
        total_expense = sum(-t.get('金额', 0) for t in self.transactions if t.get('收支') == '支出')
        total_income = sum(t.get('金额', 0) for t in self.transactions if t.get('收支') == '收入')
        total_repayment = sum(-t.get('金额', 0) for t in self.transactions if t.get('收支') == '还款')
        total_net = total_income + total_expense
        
        return {
            'bill_info': self.bill_info,  # 账单基本信息(月份、额度等)
            'summary': {
                'total_expense': round(total_expense, 2),
                'total_income': round(total_income, 2),
                'total_repayment': round(total_repayment, 2),
                'net_amount': round(total_net, 2),
                'transaction_count': len(self.transactions)
            },
            'transactions': self.transactions
        }
