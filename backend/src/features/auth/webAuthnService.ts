import { EnvBindings, AppError } from '@/app/config';
import { generateSecureJWT } from '@/shared/utils/crypto';
import * as schema from '@/shared/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';

export class WebAuthnService {
    private env: EnvBindings;
    private rpName = '2FAuth Worker';
    private rpID: string;
    private origin: string;

    constructor(env: EnvBindings, url: string) {
        this.env = env;
        const parsedUrl = new URL(url);
        this.rpID = parsedUrl.hostname;
        this.origin = `${parsedUrl.protocol}//${parsedUrl.host}`;
    }

    /**
     * 生成注册选项
     */
    async generateRegistrationOptions(userId: string, userEmail: string) {
        // 获取已存在的凭证
        const results = await this.env.DB.select({ credential_id: schema.authPasskeys.credentialId })
            .from(schema.authPasskeys)
            .where(eq(schema.authPasskeys.userId, userEmail));

        const options = await generateRegistrationOptions({
            rpName: this.rpName,
            rpID: this.rpID,
            userID: new TextEncoder().encode(userId),
            userName: userEmail,
            attestationType: 'none',
            excludeCredentials: results.map((row: any) => ({
                id: row.credential_id,
                type: 'public-key',
            })),
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
            },
        });

        return options;
    }

    /**
     * 验证注册响应
     */
    async verifyRegistrationResponse(userEmail: string, body: any, expectedChallenge: string, credentialName?: string) {
        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: this.origin,
            expectedRPID: this.rpID,
        });

        if (verification.verified && verification.registrationInfo) {
            const { credential } = verification.registrationInfo;

            // 存储到 DB
            await this.env.DB.insert(schema.authPasskeys).values({
                credentialId: credential.id,
                userId: userEmail,
                publicKey: credential.publicKey as any,
                counter: verification.registrationInfo.credential.counter,
                name: credentialName || `Passkey ${new Date().toLocaleDateString()}`,
                createdAt: Date.now()
            });

            return { success: true };
        }

        throw new AppError('webauthn_registration_failed', 400);
    }

    /**
     * 生成登录选项
     */
    async generateAuthenticationOptions() {
        const options = await generateAuthenticationOptions({
            rpID: this.rpID,
            userVerification: 'preferred',
        });

        return options;
    }

    /**
     * 验证登录响应
     */
    async verifyAuthenticationResponse(body: any, expectedChallenge: string) {
        const credentialID = body.id;

        // 从 DB 查找凭证
        const [credential] = await this.env.DB.select()
            .from(schema.authPasskeys)
            .where(eq(schema.authPasskeys.credentialId, credentialID))
            .limit(1);

        if (!credential) {
            throw new AppError('passkey_not_found', 404);
        }

        const verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: this.origin,
            expectedRPID: this.rpID,
            credential: {
                id: credential.credentialId,
                publicKey: new Uint8Array(Object.values(credential.publicKey)) as any,
                counter: credential.counter,
                transports: []
            },
        });

        if (verification.verified && verification.authenticationInfo) {
            // 更新计数器
            await this.env.DB.update(schema.authPasskeys)
                .set({
                    counter: verification.authenticationInfo.newCounter,
                    lastUsedAt: Date.now()
                })
                .where(eq(schema.authPasskeys.credentialId, credentialID));

            // 验证白名单 (这里我们需要模拟一个 OAuthUserInfo 结构)
            const userEmail = credential.userId; // 在这里 user_id 存储的是 Email

            // 签发 Token
            const token = await this.generateSystemToken({
                id: userEmail,
                username: userEmail.split('@')[0],
                email: userEmail,
                provider: 'passkey'
            });

            return {
                success: true,
                token,
                userInfo: {
                    id: userEmail,
                    username: userEmail.split('@')[0],
                    email: userEmail,
                    provider: 'passkey'
                }
            };
        }

        throw new AppError('webauthn_login_failed', 400);
    }

    private async generateSystemToken(userInfo: any): Promise<string> {
        const payload = {
            userInfo: {
                id: userInfo.id,
                username: userInfo.username,
                email: userInfo.email,
                avatar: userInfo.avatar,
                provider: userInfo.provider
            }
        };

        if (!this.env.JWT_SECRET) {
            throw new AppError('missing_jwt_secret', 500);
        }

        return await generateSecureJWT(payload, this.env.JWT_SECRET);
    }

    /**
     * 获取用户的凭证列表
     */
    async listCredentials(userEmail: string) {
        const results = await this.env.DB.select({
            id: schema.authPasskeys.credentialId,
            name: schema.authPasskeys.name,
            created_at: schema.authPasskeys.createdAt,
            last_used_at: schema.authPasskeys.lastUsedAt
        })
            .from(schema.authPasskeys)
            .where(eq(schema.authPasskeys.userId, userEmail))
            .orderBy(desc(schema.authPasskeys.createdAt));
        return results;
    }

    /**
     * 删除凭证
     */
    async deleteCredential(userEmail: string, credentialId: string) {
        await this.env.DB.delete(schema.authPasskeys)
            .where(and(
                eq(schema.authPasskeys.userId, userEmail),
                eq(schema.authPasskeys.credentialId, credentialId)
            ));
        return { success: true };
    }
}
