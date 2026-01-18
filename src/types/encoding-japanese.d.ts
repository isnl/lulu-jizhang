declare module 'encoding-japanese' {
    export function detect(data: Uint8Array | number[]): string | boolean
    export function convert(data: Uint8Array | number[], options: {
        to: string
        from: string | 'AUTO'
    }): number[]
    export function codeToString(code: number[]): string
    export function stringToCode(str: string): number[]
}
