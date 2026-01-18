@echo off
chcp 65001 >nul
echo ========================================
echo    PDF账单转Excel工具
echo ========================================
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到Python，请先安装Python 3.7+
    echo    下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM 检查依赖是否安装
python -c "import pdfplumber, openpyxl" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  检测到缺少依赖库，正在安装...
    echo.
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ❌ 依赖安装失败，请手动执行: pip install pdfplumber openpyxl
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
    echo.
)

REM 如果没有参数，显示使用说明
if "%~1"=="" (
    echo 使用方法:
    echo   1. 将PDF文件拖放到此批处理文件上
    echo   2. 或者在命令行中运行: convert-pdf.bat "账单.pdf"
    echo.
    echo 示例:
    echo   convert-pdf.bat "2025年12月信用卡账单.pdf"
    echo.
    pause
    exit /b 0
)

REM 转换PDF
echo 正在转换: %~1
echo.
python pdf-to-excel.py "%~1"

if errorlevel 1 (
    echo.
    echo ❌ 转换失败，请查看上方错误信息
) else (
    echo.
    echo ✅ 转换成功！
)

echo.
pause
