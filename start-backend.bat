@echo off
chcp 65001
title 记账小程序 - Node.js 后端服务

echo ========================================================
echo 正在检查环境...
echo ========================================================

cd /d "%~dp0"

if not exist "node_modules\multer" (
    echo [提示] 首次运行，正在安装必要依赖 (multer)...
    call npm install multer
    echo.
)

echo ========================================================
echo 启动 Node.js 后端服务...
echo 监听端口: 3000
echo ========================================================

node app.js

echo.
echo [错误] 服务意外停止。
pause
