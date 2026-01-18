#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF结构分析工具
用于查看PDF的详细内容和表格结构
"""

import sys
import io
import pdfplumber

# 设置Windows控制台输出为UTF-8
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def analyze_pdf(pdf_path):
    print(f"[分析] 正在分析PDF: {pdf_path}")
    print("=" * 80)
    
    with pdfplumber.open(pdf_path) as pdf:
        print(f"总页数: {len(pdf.pages)}\n")
        
        for page_num, page in enumerate(pdf.pages, 1):
            print(f"\n{'=' * 80}")
            print(f"第 {page_num} 页")
            print(f"{'=' * 80}")
            
            # 提取文本
            text = page.extract_text()
            print(f"\n[文本内容] (前1000字符):")
            print("-" * 80)
            print(text[:1000] if text else "无文本")
            
            # 提取表格
            tables = page.extract_tables()
            print(f"\n[表格数量]: {len(tables)}")
            
            for i, table in enumerate(tables[:5], 1):  # 只显示前5个表格
                print(f"\n--- 表格 {i} ---")
                print(f"行数: {len(table)}, 列数: {len(table[0]) if table else 0}")
                
                # 显示表头
                if table and len(table) > 0:
                    print("\n表头:")
                    print(table[0])
                
                # 显示前3行数据
                if len(table) > 1:
                    print("\n前3行数据:")
                    for row in table[1:4]:
                        print(row)
                
                print("-" * 80)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python analyze-pdf.py <PDF文件路径>")
        sys.exit(1)
    
    analyze_pdf(sys.argv[1])
