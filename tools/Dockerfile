# 使用官方 Python 轻量级镜像
FROM python:3.9-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量，防止生成 .pyc 文件，确保输出直接打印
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 安装系统依赖 (如果需要处理图像可能需要 libgl11-mesa-glx, 但 pdfplumber 通常不需要)
# RUN apt-get update && apt-get install -y --no-install-recommends gcc libffi-dev

# 复制依赖文件
COPY requirements-server.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements-server.txt

# 复制源码
COPY server.py .
COPY bill_parser.py .

# 暴露端口
EXPOSE 5000

# 启动命令
CMD ["python", "server.py"]
