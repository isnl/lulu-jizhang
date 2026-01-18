import csv
import sys

# 设置输出编码为UTF-8
sys.stdout.reconfigure(encoding='utf-8')

# 读取支付宝账单CSV文件
filepath = 'alipay_record_20260116_1744_1.csv'

try:
    # 尝试不同的编码
    for encoding in ['gbk', 'gb18030', 'utf-8']:
        try:
            with open(filepath, 'r', encoding=encoding) as f:
                lines = f.readlines()
                
            print(f"成功使用编码: {encoding}")
            print("\n" + "="*80)
            print("前10行原始内容:")
            print("="*80)
            for i, line in enumerate(lines[:10]):
                print(f"第{i+1}行: {line.strip()}")
            
            # 找到表头行（通常在第5行）
            print("\n" + "="*80)
            print("CSV结构分析:")
            print("="*80)
            
            # 跳过前4行，从第5行开始是表头
            reader = csv.DictReader(lines[4:], delimiter=',')
            
            # 获取列名
            fieldnames = reader.fieldnames
            print(f"\n列数: {len(fieldnames)}")
            print("\n列名列表:")
            for i, col in enumerate(fieldnames, 1):
                print(f"  {i}. {col.strip()}")
            
            # 读取前5条数据记录
            print("\n" + "="*80)
            print("前5条数据记录:")
            print("="*80)
            
            count = 0
            for row in reader:
                if count >= 5:
                    break
                count += 1
                print(f"\n记录 {count}:")
                for key, value in row.items():
                    if value and value.strip():  # 只显示非空字段
                        print(f"  {key.strip()}: {value.strip()}")
            
            break
            
        except UnicodeDecodeError:
            continue
            
except Exception as e:
    print(f"错误: {e}")
    import traceback
    traceback.print_exc()
