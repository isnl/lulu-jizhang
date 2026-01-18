/**
 * PDF账单解析 - Cloudflare Function
 * 使用 DeepSeek AI 进行智能解析
 */

interface Env {
    DEEPSEEK_API_KEY: string
}

interface Transaction {
    交易日期: string
    交易说明: string
    金额: number
    收支: '支出' | '收入' | '还款'
}

interface ParseResult {
    success: boolean
    data?: {
        transactions: Transaction[]
    }
    error?: string
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
    try {
        const formData = await context.request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return Response.json({ success: false, error: '未上传文件' }, { status: 400 })
        }

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            return Response.json({ success: false, error: '仅支持 PDF 格式文件' }, { status: 400 })
        }

        // 读取 PDF 文件内容
        const arrayBuffer = await file.arrayBuffer()

        // 使用 pdfjs-dist 提取文本 (Cloudflare Workers 兼容版本)
        const pdfText = await extractTextFromPDF(arrayBuffer)

        if (!pdfText || pdfText.trim().length === 0) {
            return Response.json({ success: false, error: 'PDF 文本提取失败或文件为空' }, { status: 400 })
        }

        // 调用 DeepSeek AI 进行解析
        const apiKey = context.env.DEEPSEEK_API_KEY || 'sk-b4c8d41c1167486585824d2a8e741f8a'
        const transactions = await parseWithDeepSeek(pdfText, apiKey)

        return Response.json({
            success: true,
            data: {
                transactions
            }
        })

    } catch (error: any) {
        console.error('PDF解析错误:', error)
        return Response.json({
            success: false,
            error: error.message || '解析失败'
        }, { status: 500 })
    }
}

/**
 * 从 PDF ArrayBuffer 中提取文本
 * 使用改进的算法提取 PDF 中的文本内容
 */
async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
        const uint8Array = new Uint8Array(arrayBuffer)

        // 尝试多种解码方式
        let rawText = ''

        // 方法1: UTF-8 解码
        try {
            const decoder = new TextDecoder('utf-8', { fatal: false })
            rawText = decoder.decode(uint8Array)
        } catch (e) {
            // 方法2: Latin1 解码 (PDF常用)
            const decoder = new TextDecoder('iso-8859-1', { fatal: false })
            rawText = decoder.decode(uint8Array)
        }

        // 提取所有文本内容的多种方法
        const extractedTexts: string[] = []

        // 方法1: 提取 BT...ET 块中的文本 (PDF文本对象)
        const btEtRegex = /BT\s+(.*?)\s+ET/gs
        const btEtMatches = rawText.match(btEtRegex)
        if (btEtMatches) {
            btEtMatches.forEach(block => {
                // 提取括号中的文本
                const textMatches = block.match(/\(([^)]*)\)/g)
                if (textMatches) {
                    textMatches.forEach(match => {
                        const text = match.slice(1, -1) // 移除括号
                            .replace(/\\r/g, '\n')
                            .replace(/\\n/g, '\n')
                            .replace(/\\\(/g, '(')
                            .replace(/\\\)/g, ')')
                            .replace(/\\\\/g, '\\')
                        if (text.trim()) {
                            extractedTexts.push(text.trim())
                        }
                    })
                }
            })
        }

        // 方法2: 提取尖括号中的十六进制编码文本
        const hexTextRegex = /<([0-9A-Fa-f\s]+)>/g
        let hexMatch
        while ((hexMatch = hexTextRegex.exec(rawText)) !== null) {
            try {
                const hexStr = hexMatch[1].replace(/\s/g, '')
                let text = ''
                for (let i = 0; i < hexStr.length; i += 2) {
                    const charCode = parseInt(hexStr.substr(i, 2), 16)
                    if (charCode >= 32 && charCode <= 126) {
                        text += String.fromCharCode(charCode)
                    }
                }
                if (text.trim()) {
                    extractedTexts.push(text.trim())
                }
            } catch (e) {
                // 忽略解析错误
            }
        }

        // 方法3: 提取所有可打印字符序列
        const printableRegex = /[\x20-\x7E\u4e00-\u9fa5]{3,}/g
        const printableMatches = rawText.match(printableRegex)
        if (printableMatches) {
            printableMatches.forEach(text => {
                if (text.trim().length > 2) {
                    extractedTexts.push(text.trim())
                }
            })
        }

        // 合并并去重
        const uniqueTexts = [...new Set(extractedTexts)]
        const finalText = uniqueTexts.join(' ')

        // 清理文本
        const cleanedText = finalText
            .replace(/\s+/g, ' ') // 多个空格合并为一个
            .replace(/[^\x20-\x7E\u4e00-\u9fa5\n]/g, ' ') // 移除特殊字符
            .trim()

        if (cleanedText.length < 50) {
            throw new Error('提取的文本内容过少,可能是扫描版PDF或加密PDF')
        }

        return cleanedText

    } catch (error: any) {
        console.error('PDF文本提取错误:', error)
        throw new Error(`PDF文本提取失败: ${error.message}`)
    }
}

/**
 * 使用 DeepSeek AI 解析 PDF 文本
 */
async function parseWithDeepSeek(pdfText: string, apiKey: string): Promise<Transaction[]> {
    const prompt = `你是一个专业的信用卡账单解析助手。请从以下PDF文本中提取所有交易记录,并按照指定的JSON格式输出。

**要求:**
1. 提取所有交易记录,包括消费(支出)、退款(收入)、还款等
2. 交易日期格式: YYYY-MM-DD
3. 金额为正数,单位为元
4. 收支类型: "支出"、"收入"、"还款"
5. 忽略账单摘要、总额等非交易信息
6. 如果交易说明过长,保留关键信息(不超过50字)

**PDF文本内容:**
${pdfText.substring(0, 8000)} 

**输出格式(JSON):**
请严格按照以下格式输出,不要添加任何其他内容:
{
  "transactions": [
    {
      "交易日期": "2025-12-15",
      "交易说明": "美团外卖",
      "金额": 45.80,
      "收支": "支出"
    }
  ]
}

请开始解析并输出JSON:`

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的账单解析助手,擅长从文本中提取结构化的交易数据。请严格按照JSON格式输出,不要添加任何解释性文字。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                response_format: { type: 'json_object' }, // DeepSeek 支持 JSON 模式
                temperature: 0.1, // 降低随机性,提高准确性
                max_tokens: 4000
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`DeepSeek API 调用失败: ${response.status} - ${errorText}`)
        }

        const result = await response.json() as any
        const content = result.choices?.[0]?.message?.content

        if (!content) {
            throw new Error('DeepSeek 返回内容为空')
        }

        // 解析 JSON 响应
        const parsed = JSON.parse(content)

        if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
            throw new Error('DeepSeek 返回格式不正确')
        }

        // 验证和清洗数据
        const validTransactions: Transaction[] = parsed.transactions
            .filter((t: any) => {
                return t.交易日期 && t.交易说明 && typeof t.金额 === 'number' && t.收支
            })
            .map((t: any) => ({
                交易日期: t.交易日期,
                交易说明: t.交易说明.substring(0, 50), // 限制长度
                金额: Math.abs(t.金额), // 确保为正数
                收支: t.收支 as '支出' | '收入' | '还款'
            }))

        return validTransactions

    } catch (error: any) {
        console.error('DeepSeek 解析错误:', error)
        throw new Error(`AI解析失败: ${error.message}`)
    }
}
