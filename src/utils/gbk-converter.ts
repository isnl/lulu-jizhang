// 简单的GBK到UTF-8转换工具
// 使用浏览器的FileReader API

export async function convertGBKtoUTF8(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (e) => {
            const result = e.target?.result
            if (typeof result === 'string') {
                resolve(result)
            } else {
                reject(new Error('读取文件失败'))
            }
        }

        reader.onerror = () => {
            reject(new Error('读取文件失败'))
        }

        // 尝试使用GBK编码读取
        // 注意：并非所有浏览器都支持GBK编码
        try {
            reader.readAsText(file, 'GBK')
        } catch (e) {
            // 如果不支持GBK，尝试GB2312
            try {
                reader.readAsText(file, 'GB2312')
            } catch (e2) {
                // 最后尝试GB18030
                try {
                    reader.readAsText(file, 'GB18030')
                } catch (e3) {
                    reject(new Error('浏览器不支持GBK编码，请将CSV文件转换为UTF-8编码后重试'))
                }
            }
        }
    })
}
