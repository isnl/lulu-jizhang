/* Shim for Vue files */
declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<{}, {}, any>
    export default component
}

/* Vite 环境变量类型定义 */
interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string
    // 可以在这里添加更多环境变量
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
