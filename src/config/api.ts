// API 配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const apiConfig = {
    baseUrl: API_BASE_URL,

    // API 端点
    endpoints: {
        records: `${API_BASE_URL}/records`
    }
}

// 辅助函数：构建完整 URL
export function buildApiUrl(endpoint: string, params?: Record<string, string>): string {
    const url = new URL(endpoint, window.location.origin)

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value)
        })
    }

    return url.toString()
}
