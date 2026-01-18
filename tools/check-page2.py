#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""查看第2页的所有交易"""

import sys
import io
import pdfplumber
import re

# 设置Windows控制台输出为UTF-8
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with pdfplumber.open('2025年12月信用卡账单.pdf') as pdf:
    print("=" * 80)
    print("第2页文本内容")
    print("=" * 80)
    
    page2 = pdf.pages[1]
    text = page2.extract_text()
    
    # 查找所有包含日期格式的行(可能是交易记录)
    lines = text.split('\n')
    transaction_lines = []
    
    for line in lines:
        # 匹配日期格式 MM/DD
        if re.search(r'\d{2}/\d{2}', line):
            transaction_lines.append(line)
    
    print(f"\n找到 {len(transaction_lines)} 行包含日期的文本:\n")
    for i, line in enumerate(transaction_lines, 1):
        print(f"{i}. {line}")
