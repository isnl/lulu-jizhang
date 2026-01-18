#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""详细分析PDF表格数量"""

import sys
import io
import pdfplumber

# 设置Windows控制台输出为UTF-8
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with pdfplumber.open('2025年12月信用卡账单.pdf') as pdf:
    print(f"总页数: {len(pdf.pages)}\n")
    
    total_tables = 0
    for page_num, page in enumerate(pdf.pages, 1):
        tables = page.extract_tables()
        print(f"第{page_num}页: {len(tables)}个表格")
        total_tables += len(tables)
    
    print(f"\n总表格数: {total_tables}")
    print(f"预期交易数: 37 (34消费 + 2退款 + 1还款)")
    print(f"实际解析数: 19")
    print(f"缺失数: {37 - 19}")
