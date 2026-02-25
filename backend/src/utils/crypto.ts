import { BASE32_CHARS, SECURITY_CONFIG } from '../config';

// ==========================================
// 1. Base32 与 TOTP 核心算法
// ==========================================
export function base32Decode(encoded: string): Uint8Array {
    const cleanInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
    const buffer = new Uint8Array(Math.floor(cleanInput.length * 5 / 8));
    let bits = 0, value = 0, index = 0;
    
    for (let i = 0; i < cleanInput.length; i++) {
        const charValue = BASE32_CHARS.indexOf(cleanInput[i]);
        if (charValue === -1) continue;
        value = (value << 5) | charValue;
        bits += 5;
        if (bits >= 8) {
            buffer[index++] = (value >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return buffer;
}

export async function hmacSHA1(key: Uint8Array | string, data: number): Promise<Uint8Array> {
    const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;
    const dataBuffer = new ArrayBuffer(8);
    new DataView(dataBuffer).setBigUint64(0, BigInt(data), false);
    
    const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    return new Uint8Array(signature);
}

export async function generateTOTP(secret: string | Uint8Array, timeStep = 30, digits = 6): Promise<string> {
    const time = Math.floor(Date.now() / 1000 / timeStep);
    const secretBytes = typeof secret === 'string' ? base32Decode(secret) : secret;
    
    const hmac = await hmacSHA1(secretBytes, time);
    const offset = hmac[hmac.length - 1] & 0xf;
    
    const code = (((hmac[offset] & 0x7f) << 24) | 
                  ((hmac[offset + 1] & 0xff) << 16) | 
                  ((hmac[offset + 2] & 0xff) << 8) | 
                  (hmac[offset + 3] & 0xff)) % Math.pow(10, digits);
                  
    return code.toString().padStart(digits, '0');
}

// ==========================================
// 2. JWT 签发与验证 (原生轻量实现)
// ==========================================
export async function generateSecureJWT(payload: Record<string, any>, secret: string): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT', iat: Math.floor(Date.now() / 1000) };
    const enhancedPayload = { 
        ...payload, 
        iat: Math.floor(Date.now() / 1000), 
        exp: Math.floor(Date.now() / 1000) + SECURITY_CONFIG.JWT_EXPIRY, 
        jti: crypto.randomUUID() 
    };
    
    const headerB64 = btoa(JSON.stringify(header)).replace(/[+/=]/g, (m) => ({'+':'-','/':'_','=':''}[m as keyof typeof map] || m));
    const payloadB64 = btoa(JSON.stringify(enhancedPayload)).replace(/[+/=]/g, (m) => ({'+':'-','/':'_','=':''}[m as keyof typeof map] || m));
    
    const data = `${headerB64}.${payloadB64}`;
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+/=]/g, (m) => ({'+':'-','/':'_','=':''}[m as keyof typeof map] || m));
    
    return `${data}.${signatureB64}`;
}

export async function verifySecureJWT(token: string, secret: string): Promise<any | null> {
    try {
        const [headerB64, payloadB64, signatureB64] = token.split('.');
        if (!headerB64 || !payloadB64 || !signatureB64) return null;

        const data = `${headerB64}.${payloadB64}`;
        const encoder = new TextEncoder();
        
        const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
        const signatureBytes = Uint8Array.from(atob(signatureB64.replace(/[-_]/g, (m) => ({'-':'+','_':'/'}[m as keyof typeof map] || m))), c => c.charCodeAt(0));
        const isValid = await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, encoder.encode(data));
        
        if (isValid) {
            const payload = JSON.parse(atob(payloadB64.replace(/[-_]/g, (m) => ({'-':'+','_':'/'}[m as keyof typeof map] || m))));
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
            return payload;
        }
        return null;
    } catch { 
        return null; 
    }
}

// PKCE 辅助函数
export function base64UrlEncode(str: Uint8Array): string {
    let binary = '';
    const len = str.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(str[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export async function generatePKCE() {
    const verifierBytes = new Uint8Array(32);
    crypto.getRandomValues(verifierBytes);
    const verifier = base64UrlEncode(verifierBytes);
    const challenge = base64UrlEncode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    return { verifier, challenge };
}

// ==========================================
// 3. AES-GCM 数据加解密 (用于保护 KV 里的 2FA 密钥)
// ==========================================
// ⚡️ 极速模式：直接使用密钥的哈希值作为 AES 密钥 (无需 PBKDF2 慢速派生)
async function getFastKey(secret: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    // 使用 SHA-256 确保密钥长度固定为 256 位 (32字节)
    const keyBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
    return crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// 🐢 兼容模式：PBKDF2 (用于解密旧数据)
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, 
        keyMaterial, 
        { name: 'AES-GCM', length: 256 }, 
        false, 
        ['encrypt', 'decrypt']
    );
}

export async function encryptData(data: any, masterKey: string): Promise<{ encrypted: number[], iv: number[], salt?: number[] }> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // 🚀 默认使用极速模式 (不再生成 salt，不再进行 PBKDF2 计算)
    const key = await getFastKey(masterKey);
    
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data)));
    return { 
        encrypted: Array.from(new Uint8Array(encrypted)), 
        iv: Array.from(iv)
        // salt: undefined  <-- 新数据不再包含 salt
    };
}

export async function decryptData(encryptedData: { encrypted: number[], iv: number[], salt?: number[] }, masterKey: string): Promise<any> {
    const decoder = new TextDecoder();
    const iv = new Uint8Array(encryptedData.iv);
    const encrypted = new Uint8Array(encryptedData.encrypted);
    
    let key: CryptoKey;

    // 🔄 智能兼容：如果发现数据中有 salt，说明是旧数据，使用 PBKDF2 解密
    if (encryptedData.salt && encryptedData.salt.length > 0) {
        const salt = new Uint8Array(encryptedData.salt);
        key = await deriveKey(masterKey, salt);
    } else {
        // 🚀 否则使用极速模式解密
        key = await getFastKey(masterKey);
    }

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return JSON.parse(decoder.decode(decrypted));
}