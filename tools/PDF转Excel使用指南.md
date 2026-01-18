# PDF账单转Excel工具使用指南

## 📋 功能说明

这个工具可以将PDF格式的账单(特别是信用卡账单)转换为Excel格式,自动提取:
- 📊 交易明细(日期、说明、金额)
- 📝 账单基本信息(账单月份、卡号、应还金额等)
- 💰 自动计算收支汇总

## 🚀 快速开始

### 1. 安装依赖

```bash
# 安装Python依赖
pip install -r requirements.txt
```

或者单独安装:

```bash
pip install pdfplumber openpyxl
```

### 2. 基本使用

```bash
# 转换PDF账单(自动生成同名Excel文件)
python pdf-to-excel.py "账单.pdf"

# 指定输出文件名
python pdf-to-excel.py "账单.pdf" -o "我的账单.xlsx"
```

### 3. 示例

```bash
# 转换信用卡账单
python pdf-to-excel.py "2025年12月信用卡账单.pdf"

# 输出: 2025年12月信用卡账单.xlsx
```

## 📊 生成的Excel格式

生成的Excel文件包含两个工作表:

### 1. 账单信息表
| 项目 | 内容 |
|------|------|
| 账单月份 | 2025-12 |
| 卡号 | 6222 **** 1234 |
| 本期应还 | 5,280.50 |
| 最后还款日 | 2026-01-15 |

### 2. 交易明细表
| 序号 | 交易日期 | 交易说明 | 金额 | 类型 | 币种 |
|------|----------|----------|------|------|------|
| 1 | 2025-12-01 | 超市购物 | -128.50 | 支出 | CNY |
| 2 | 2025-12-05 | 餐饮消费 | -85.00 | 支出 | CNY |
| 3 | 2025-12-10 | 还款 | 1000.00 | 收入 | CNY |

**特点:**
- ✅ 支出金额显示为红色
- ✅ 收入金额显示为绿色
- ✅ 自动计算合计
- ✅ 表格带边框和样式

## 🔧 支持的账单格式

目前支持:
- ✅ 中国主流银行信用卡账单
- ✅ 包含表格的PDF账单
- ✅ 纯文本格式的PDF账单

## 📝 工作原理

1. **读取PDF**: 使用`pdfplumber`提取PDF中的文本和表格
2. **智能识别**: 自动识别交易明细表格和账单信息
3. **数据解析**: 提取日期、金额、交易说明等字段
4. **格式化输出**: 生成美观的Excel文件

## ⚠️ 注意事项

1. **PDF格式要求**:
   - PDF必须是可选择文本的(非扫描图片)
   - 如果是扫描件,需要先进行OCR识别

2. **数据准确性**:
   - 转换后请检查数据是否完整
   - 不同银行的PDF格式可能需要调整解析规则

3. **编码问题**:
   - 工具使用UTF-8编码
   - 如遇到乱码,请检查PDF文件编码

## 🛠️ 高级用法

### 批量转换

创建批处理脚本 `batch-convert.bat`:

```batch
@echo off
for %%f in (*.pdf) do (
    python pdf-to-excel.py "%%f"
)
echo 批量转换完成!
pause
```

### 在Python代码中使用

```python
from pdf_to_excel import PDFBillConverter

# 创建转换器
converter = PDFBillConverter('账单.pdf')

# 提取数据
text = converter.extract_text()
tables = converter.extract_tables()

# 解析账单
converter.parse_credit_card_bill(text, tables)

# 保存Excel
converter.save_to_excel('输出.xlsx')

# 访问提取的数据
print(f"账单信息: {converter.bill_info}")
print(f"交易记录: {converter.transactions}")
```

## 🐛 常见问题

### Q1: 提示缺少库怎么办?
```bash
pip install pdfplumber openpyxl
```

### Q2: 转换后没有数据?
- 检查PDF是否是扫描件(需要OCR)
- 尝试手动复制PDF内容,看是否能选择文本
- 查看控制台输出的调试信息

### Q3: 数据解析不准确?
- 不同银行的PDF格式不同,可能需要调整代码
- 可以将PDF文件发给我,我帮您优化解析规则

### Q4: 如何处理扫描版PDF?
需要先进行OCR识别:
```bash
# 使用OCR工具(如Adobe Acrobat)转换为可选择文本的PDF
# 或使用在线OCR服务
```

## 📚 相关资源

- [pdfplumber文档](https://github.com/jsvine/pdfplumber)
- [openpyxl文档](https://openpyxl.readthedocs.io/)

## 🔄 更新日志

### v1.0.0 (2026-01-17)
- ✅ 初始版本
- ✅ 支持信用卡账单转换
- ✅ 自动识别交易表格
- ✅ 生成格式化Excel文件
