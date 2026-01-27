// JWT 和密码工具函数
// 使用 Web Crypto API (Cloudflare Workers 原生支持)

interface JWTPayload {
    userId: number;
    username: string;
    exp: number;
    iat: number;
}

// Base64URL 编码
function base64UrlEncode(str: string): string {
    const base64 = btoa(str);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Base64URL 解码
function base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return atob(base64);
}

// 生成 JWT
export async function generateJWT(payload: Omit<JWTPayload, 'exp' | 'iat'>, secret: string, expiresIn: number = 7 * 24 * 60 * 60): Promise<string> {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JWTPayload = {
        ...payload,
        iat: now,
        exp: now + expiresIn
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    // 使用 Web Crypto API 生成 HMAC-SHA256 签名
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(signatureInput)
    );

    const encodedSignature = base64UrlEncode(
        String.fromCharCode(...new Uint8Array(signature))
    );

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// 验证 JWT
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }

        const [encodedHeader, encodedPayload, encodedSignature] = parts;
        const signatureInput = `${encodedHeader}.${encodedPayload}`;

        // 验证签名
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        const signatureBytes = Uint8Array.from(
            base64UrlDecode(encodedSignature),
            c => c.charCodeAt(0)
        );

        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signatureBytes,
            encoder.encode(signatureInput)
        );

        if (!isValid) {
            return null;
        }

        // 解析 payload
        const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload));

        // 检查过期时间
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

// 密码哈希（使用 PBKDF2）
export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const encoder = new TextEncoder();
    const actualSalt = salt || crypto.randomUUID();

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(actualSalt),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    );

    const hashArray = Array.from(new Uint8Array(derivedBits));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return {
        hash: `${actualSalt}:${hashHex}`,
        salt: actualSalt
    };
}

// 验证密码
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [salt] = storedHash.split(':');
    if (!salt) return false;

    const { hash } = await hashPassword(password, salt);
    return hash === storedHash;
}

// 生成随机 API Token
export function generateApiToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
