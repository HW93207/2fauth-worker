export const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const SECURITY_CONFIG = {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000,
    JWT_EXPIRY: 2 * 60 * 60, // 2小时
    MAX_INPUT_LENGTH: 100,
    MIN_EXPORT_PASSWORD_LENGTH: 12,
    MAX_OAUTH_ATTEMPTS: 3,
    OAUTH_LOCKOUT_TIME: 10 * 60 * 1000,
    MAX_FILE_SIZE: 10 * 1024 * 1024,
};

// Cloudflare Workers 环境变量类型定义
export type EnvBindings = {
    DB: D1Database;
    OAUTH_GITHUB_CLIENT_ID: string;
    OAUTH_GITHUB_CLIENT_SECRET: string;
    OAUTH_GITHUB_REDIRECT_URI: string;
    OAUTH_CLOUDFLARE_CLIENT_ID?: string;
    OAUTH_CLOUDFLARE_CLIENT_SECRET?: string;
    OAUTH_CLOUDFLARE_ORG_DOMAIN?: string; // 例如 https://your-team.cloudflareaccess.com
    OAUTH_CLOUDFLARE_REDIRECT_URI?: string;
    OAUTH_NODELOC_CLIENT_ID?: string;
    OAUTH_NODELOC_CLIENT_SECRET?: string;
    OAUTH_NODELOC_REDIRECT_URI?: string;
    OAUTH_ALLOWED_USERS: string;    // 允许登录的 Email 或 Username 白名单 (必填)
    JWT_SECRET: string;
    ENCRYPTION_KEY: string;
};

// 自定义错误类
export class AppError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 500) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
    }
}