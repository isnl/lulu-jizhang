#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF账单解析 API 服务
提供 /api/upload 接口,接收 PDF 文件,返回 JSON 数据
"""

from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import os
import tempfile
from pathlib import Path
from bill_parser import PDFBillConverter

app = Flask(__name__)
# 允许跨域请求(方便前端调用)
CORS(app)

# 设置上传文件大小限制 (10MB)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>账单解析服务</title>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f5f5f7; }
        .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #1d1d1f; text-align: center; margin-bottom: 30px; }
        .upload-area { border: 2px dashed #86868b; border-radius: 8px; padding: 40px; text-align: center; cursor: pointer; transition: all 0.3s; }
        .upload-area:hover { border-color: #0071e3; background-color: #f5fafe; }
        input[type="file"] { display: none; }
        button { background-color: #0071e3; color: white; border: none; padding: 12px 24px; border-radius: 20px; font-size: 16px; cursor: pointer; margin-top: 20px; transition: background 0.3s; }
        button:hover { background-color: #0077ed; }
        #result { margin-top: 30px; white-space: pre-wrap; background: #f5f5f7; padding: 15px; border-radius: 8px; font-family: monospace; max-height: 500px; overflow-y: auto; display: none; }
        .status { margin-top: 15px; color: #86868b; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📑 PDF账单解析微服务</h1>
        <div class="upload-area" onclick="document.getElementById('fileInput').click()">
            <p>点击或拖拽上传 PDF 账单文件</p>
            <input type="file" id="fileInput" accept=".pdf" onchange="handleFileSelect(this)">
            <div id="fileName" class="status"></div>
        </div>
        <div style="text-align: center;">
            <button onclick="uploadFile()">开始解析</button>
        </div>
        <div id="result"></div>
    </div>

    <script>
        function handleFileSelect(input) {
            const fileName = input.files[0] ? input.files[0].name : '';
            document.getElementById('fileName').textContent = fileName;
        }

        async function uploadFile() {
            const input = document.getElementById('fileInput');
            if (!input.files[0]) {
                alert('请先选择文件');
                return;
            }

            const formData = new FormData();
            formData.append('file', input.files[0]);

            const resultDiv = document.getElementById('result');
            resultDiv.style.display = 'block';
            resultDiv.textContent = '处理中...';

            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                resultDiv.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                resultDiv.textContent = '错误: ' + error.message;
            }
        }
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    """提供简单的测试页面"""
    return render_template_string(HTML_TEMPLATE)

@app.route('/health')
def health_check():
    """健康检查"""
    return jsonify({'status': 'ok', 'service': 'bill-parser'})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """上传并解析PDF"""
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '文件名为空'}), 400
    
    if file and file.filename.lower().endswith('.pdf'):
        try:
            # 创建临时文件保存上传的PDF
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                file.save(tmp.name)
                tmp_path = tmp.name
            
            try:
                # 调用核心解析逻辑
                converter = PDFBillConverter(tmp_path)
                text = converter.extract_text()
                tables = converter.extract_tables()
                converter.parse_credit_card_bill(text, tables)
                
                # 获取JSON结果
                result = converter.get_json_data()
                
                return jsonify({
                    'success': True,
                    'filename': file.filename,
                    'data': result
                })
                
            finally:
                # 清理临时文件
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                    
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    return jsonify({'error': '只支持PDF文件'}), 400

if __name__ == '__main__':
    # 开发模式运行
    app.run(host='0.0.0.0', port=5000, debug=True)
