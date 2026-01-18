# 工具集 Tools

本目录包含各种数据处理和转换工具。

## 📄 PDF转Excel工具

### 快速使用

**方法1: 拖放使用(推荐)**
```
将PDF文件拖到 convert-pdf.bat 上即可
```

**方法2: 命令行**
```bash
python pdf-to-excel.py "账单.pdf"
```

### 文件说明

| 文件 | 说明 |
|------|------|
| `pdf-to-excel.py` | PDF转Excel主程序 |
| `convert-pdf.bat` | Windows批处理脚本(拖放使用) |
| `requirements.txt` | Python依赖配置 |
| `PDF转Excel使用指南.md` | 详细使用文档 |
| `快速开始.md` | 快速入门指南 |

### 安装依赖

```bash
pip install -r requirements.txt
```

或

```bash
pip install pdfplumber openpyxl
```

---

## 📊 账单分析工具

| 文件 | 说明 |
|------|------|
| `analyze-alipay.js` | 支付宝账单分析 |
| `analyze_wechat_bill.js` | 微信账单分析 |
| `analyze_bill.js` | 通用账单分析 |
| `test-alipay-parser.js` | 支付宝解析测试 |
| `read-wechat-bill.js` | 微信账单读取 |

---

## 🔧 使用示例

### 转换PDF账单

```bash
# 转换单个文件
python pdf-to-excel.py "../2025年12月信用卡账单.pdf"

# 指定输出文件
python pdf-to-excel.py "账单.pdf" -o "输出.xlsx"
```

### 分析支付宝账单

```bash
node analyze-alipay.js
```

### 分析微信账单

```bash
node analyze_wechat_bill.js
```

---

## 📚 更多信息

- 详细文档: 查看各工具对应的说明文档
- 问题反馈: 如遇到问题请提供样本文件
