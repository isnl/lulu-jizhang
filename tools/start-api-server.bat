@echo off
chcp 65001
echo 正在安装/检查依赖...
pip install -r requirements-server.txt

echo.
echo ========================================================
echo 启动 PDF 解析 API 服务...
echo 请在浏览器访问 http://localhost:5000 进行测试
echo ========================================================
python server.py
pause
