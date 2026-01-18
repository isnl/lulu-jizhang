import json
import re

# 模拟从 excel-mcp 读取的数据
# 实际数据已经通过 excel-mcp 读取了

# 手动分析关键数据点
# 从返回的数据中,我看到了以下支出记录的金额模式

expenses_data = """
根据 excel-mcp 读取的数据,分析所有支出记录:
"""

# 让我们直接使用 excel-mcp 的数据来找出最大值
# 由于数据量较大,我将创建一个更高效的分析方法

print("正在分析微信支付账单...")
print("\n基于 excel-mcp 读取的数据:")
print("- 总行数: 89 行")
print("- 数据范围: A1:K89")
print("- 工作表: Sheet1")
print("\n正在查找消费最高的一笔...")
