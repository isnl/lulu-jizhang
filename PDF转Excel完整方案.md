# PDF账单转Excel工具 - 完整方案

## 🎉 已完成!

我已经为您创建了一套完整的PDF账单转Excel转换工具,并成功测试了您的信用卡账单!

---

## 📦 创建的文件

### 核心工具
1. **`tools/pdf-to-excel.py`** - Python转换脚本(主程序)
   - 自动识别PDF中的表格和文本
   - 智能提取交易记录
   - 生成格式化的Excel文件
   - 支持Windows控制台UTF-8输出

2. **`tools/convert-pdf.bat`** - Windows批处理脚本
   - 拖放PDF文件即可转换
   - 自动检查和安装依赖
   - 用户友好的界面

3. **`tools/requirements.txt`** - Python依赖配置
   - pdfplumber - PDF解析
   - openpyxl - Excel生成

### 文档
4. **`tools/PDF转Excel使用指南.md`** - 详细使用文档
5. **`tools/快速开始.md`** - 快速入门指南
6. **`tools/README.md`** - 工具集总览

### 示例代码
7. **`tools/import-pdf-excel.js`** - Excel导入示例
   - 演示如何读取转换后的Excel
   - 智能分类交易
   - 批量导入到数据库

---

## ✅ 测试结果

### 转换成功!

**输入**: `2025年12月信用卡账单.pdf`  
**输出**: `2025年12月信用卡账单.xlsx`

```
============================================================
[工具] PDF账单转Excel工具
============================================================
[读取] 正在读取PDF: 2025年12月信用卡账单.pdf
   总页数: 2
[完成] PDF读取完成,共提取 2706 个字符
[表格] 正在提取表格数据...
   第1页找到 10 个表格
   第2页找到 16 个表格
[完成] 共提取 26 个表格
[解析] 正在解析信用卡账单...
[完成] 解析完成,共找到 38 条交易记录
[保存] 正在生成Excel文件
[完成] Excel文件已保存
   共 38 条交易记录
============================================================
```

### Excel文件结构

**工作表**: 交易明细

| 列 | 说明 | 示例 |
|----|------|------|
| 序号 | 交易序号 | 1, 2, 3... |
| 交易日期 | 交易发生日期 | 2026-11-27 |
| 交易说明 | 交易描述 | 自动还款、财付通-购物 |
| 金额 | 交易金额 | -128.50(支出红色), 1000.00(收入绿色) |
| 类型 | 收入/支出 | 收入、支出 |
| 币种 | 货币类型 | CNY |

**特点**:
- ✅ 表头带绿色背景
- ✅ 支出金额显示为红色
- ✅ 收入金额显示为绿色
- ✅ 底部自动汇总
- ✅ 表格带边框
- ✅ 首行冻结

---

## 🚀 使用方法

### 方法1: 拖放使用(最简单)

1. 找到 `tools/convert-pdf.bat`
2. 将PDF文件拖到这个批处理文件上
3. 等待转换完成
4. 在PDF文件同目录下找到生成的Excel文件

### 方法2: 命令行使用

```bash
# 进入tools目录
cd tools

# 转换PDF
python pdf-to-excel.py "账单.pdf"

# 指定输出文件名
python pdf-to-excel.py "账单.pdf" -o "我的账单.xlsx"
```

### 方法3: 批量转换

创建 `batch-convert.bat`:

```batch
@echo off
cd tools
for %%f in (..\*.pdf) do (
    python pdf-to-excel.py "%%f"
)
pause
```

---

## 🔧 工具特点

### 智能识别
- ✅ 自动识别PDF中的交易明细表格
- ✅ 支持多种表格格式
- ✅ 智能提取日期、金额、说明
- ✅ 备用文本解析(表格识别失败时)

### 格式化输出
- ✅ 美观的Excel样式
- ✅ 收支颜色标记(红色支出/绿色收入)
- ✅ 自动计算汇总
- ✅ 表格边框和对齐
- ✅ 列宽自动调整

### 兼容性
- ✅ Windows控制台UTF-8支持
- ✅ 支持中文文件名
- ✅ 多种日期格式识别
- ✅ 多种金额格式解析

---

## 📊 支持的PDF格式

### 当前支持
- ✅ 信用卡账单(已测试)
- ✅ 包含表格的PDF账单
- ✅ 可选择文本的PDF

### 不支持
- ❌ 扫描版PDF(需要先OCR)
- ❌ 加密的PDF
- ❌ 纯图片PDF

### 如何处理扫描版PDF

1. **使用OCR工具**:
   - Adobe Acrobat Pro
   - ABBYY FineReader
   - 在线OCR服务

2. **转换为可选择文本的PDF**

3. **然后使用本工具转换**

---

## 🔄 集成到记账系统

### 步骤1: 转换PDF
```bash
python pdf-to-excel.py "账单.pdf"
```

### 步骤2: 导入Excel

使用提供的 `import-pdf-excel.js` 示例代码:

```javascript
import { importPDFConvertedExcel, batchImportRecords } from './tools/import-pdf-excel.js';

// 读取Excel
const records = await importPDFConvertedExcel(file);

// 批量导入
const results = await batchImportRecords(records);
```

### 步骤3: 智能分类

工具会自动根据交易说明进行分类:
- 餐饮: 包含"餐"、"食"、"美团"等
- 交通: 包含"地铁"、"公交"、"滴滴"等
- 购物: 包含"淘宝"、"京东"、"超市"等
- 娱乐: 包含"电影"、"游戏"、"会员"等
- 其他: 未匹配的交易

---

## 💡 高级用法

### 自定义解析规则

编辑 `pdf-to-excel.py`:

```python
# 修改列名识别
def _map_columns(self, header):
    # 添加您的银行特有的列名
    if '消费时间' in cell_lower:
        col_map['date'] = i
    # ...

# 修改金额解析
def _parse_amount(self, amount_str):
    # 添加特殊格式处理
    # ...

# 修改日期解析
def _parse_date(self, date_str):
    # 添加新的日期格式
    # ...
```

### 提取账单信息

工具会自动提取(如果PDF中包含):
- 账单月份
- 卡号
- 持卡人
- 本期应还金额
- 最后还款日

这些信息会保存在"账单信息"工作表中。

---

## 📝 依赖说明

### Python库

```
pdfplumber>=0.10.0  # PDF解析
openpyxl>=3.1.0     # Excel生成
```

### 安装方法

```bash
# 方法1: 使用requirements.txt
pip install -r tools/requirements.txt

# 方法2: 单独安装
pip install pdfplumber openpyxl
```

---

## ❓ 常见问题

### Q1: 转换后数据不完整?

**原因**: PDF格式特殊,表格识别失败

**解决**:
1. 检查PDF是否可以选择文本
2. 查看控制台输出,看是否识别到表格
3. 如需要,可以提供PDF样本优化脚本

### Q2: 金额解析不准确?

**原因**: 不同银行的金额格式不同

**解决**:
修改 `_parse_amount()` 函数,添加您的格式:

```python
def _parse_amount(self, amount_str):
    # 添加您的格式处理
    if '借' in amount_str:
        is_negative = True
    # ...
```

### Q3: 日期格式错误?

**原因**: 日期格式识别失败

**解决**:
修改 `_parse_date()` 函数,添加新格式:

```python
patterns = [
    r'(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})',
    r'(\d{1,2})[-/月](\d{1,2})',
    r'您的新格式正则表达式',  # 添加这里
]
```

### Q4: 控制台乱码?

**已解决**: 脚本已自动设置UTF-8编码

如仍有问题,在命令行运行:
```bash
chcp 65001
python pdf-to-excel.py "账单.pdf"
```

---

## 🎯 下一步建议

### 1. 测试其他PDF
尝试转换其他银行的账单,看是否需要调整解析规则

### 2. 集成到Web界面
创建一个上传页面,让用户可以:
- 上传PDF
- 自动转换
- 预览数据
- 一键导入

### 3. 添加更多功能
- 支持多币种
- 自动分类优化
- 重复交易检测
- 数据验证

### 4. 优化分类规则
根据您的实际使用情况,优化 `import-pdf-excel.js` 中的分类逻辑

---

## 📞 技术支持

如果您需要:
- 优化特定银行的PDF解析
- 添加新功能
- 修复bug
- 集成到系统

请提供:
1. PDF样本(可脱敏)
2. 期望的输出格式
3. 具体需求说明

我会帮您优化工具!

---

## 📚 相关文档

- [PDF转Excel使用指南](./tools/PDF转Excel使用指南.md) - 详细使用说明
- [快速开始](./tools/快速开始.md) - 快速入门
- [工具集README](./tools/README.md) - 工具总览

---

## 🎉 总结

您现在拥有:
- ✅ 完整的PDF转Excel工具
- ✅ 简单易用的批处理脚本
- ✅ 详细的使用文档
- ✅ Excel导入示例代码
- ✅ 已测试的转换结果

**开始使用**: 将PDF文件拖到 `tools/convert-pdf.bat` 上即可!
