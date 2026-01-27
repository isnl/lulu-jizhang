// 认证状态管理
import { ref, computed } from 'vue'

const AUTH_TOKEN_KEY = 'auth_token'
const AUTH_USER_KEY = 'auth_user'

interface User {
    id: number
    username: string
}

// 响应式状态
const token = ref<string | null>(localStorage.getItem(AUTH_TOKEN_KEY))
const user = ref<User | null>(JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null'))

// 计算属性
export const isAuthenticated = computed(() => !!token.value)
export const currentUser = computed(() => user.value)

// 设置认证信息
export function setAuth(authToken: string, authUser: User) {
    token.value = authToken
    user.value = authUser
    localStorage.setItem(AUTH_TOKEN_KEY, authToken)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser))
}

// 清除认证信息
export function clearAuth() {
    token.value = null
    user.value = null
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
}

// 获取 token
export function getToken(): string | null {
    return token.value
}

// 带认证的 fetch 封装
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers)

    if (token.value) {
        headers.set('Authorization', `Bearer ${token.value}`)
    }

    const response = await fetch(url, {
        ...options,
        headers
    })

    // 如果返回 401，清除认证状态
    if (response.status === 401) {
        clearAuth()
        // 触发重新登录
        window.dispatchEvent(new CustomEvent('auth:required'))
    }

    return response
}

// 登录
export async function login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        })

        const result = await response.json()

        if (result.success) {
            setAuth(result.data.token, result.data.user)
            return { success: true }
        } else {
            return { success: false, error: result.error || '登录失败' }
        }
    } catch (error) {
        return { success: false, error: '网络错误，请稍后重试' }
    }
}

// 登出
export function logout() {
    clearAuth()
}

// 检查登录状态
export async function checkAuth(): Promise<boolean> {
    if (!token.value) {
        return false
    }

    try {
        const response = await authFetch('/api/auth/me')
        if (response.ok) {
            const result = await response.json()
            if (result.success) {
                user.value = result.data
                return true
            }
        }
    } catch {
        // ignore
    }

    clearAuth()
    return false
}
