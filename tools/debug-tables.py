#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""调试PDF解析"""

import sys
import io
import pdfplumber

# 设置Windows控制台输出为UTF-8
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with pdfplumber.open('2025年12月信用卡账单.pdf') as pdf:
    print("=" * 80)
    print("表格详细分析")
    print("=" * 80)
    
    all_tables = []
    for page_num, page in enumerate(pdf.pages, 1):
        tables = page.extract_tables()
        all_tables.extend(tables)
    
    print(f"\n总表格数: {len(all_tables)}\n")
    
    for i, table in enumerate(all_tables, 1):
        if not table:
            continue
        
        print(f"\n--- 表格 {i} ---")
        print(f"行数: {len(table)}, 列数: {len(table[0]) if table else 0}")
        
        # 显示第一行
        if table and len(table) > 0:
            print(f"第1行: {table[0]}")
        
        # 如果有第二行,也显示
        if len(table) > 1:
            print(f"第2行: {table[1]}")
