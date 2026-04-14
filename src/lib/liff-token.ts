/**
 * LIFF トークン署名
 *
 * 旧設計: LIFF URL に ?uid=Uxxxx を生で埋めていた → URL履歴・スクショで漏れたら他社のデータに書き込める
 * 新設計: LINE userId + 発行時刻を HMAC-SHA256 で署名し、5分以内のみ有効なトークンを発行
 */

import * as crypto from 'crypto';

function getSecret(): string {
  const secret = process.env.LIFF_TOKEN_SECRET || process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    throw new Error('LIFF_TOKEN_SECRET or LINE_CHANNEL_SECRET must be set');
  }
  return secret;
}
const SECRET: string = getSecret();
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30分（請求書フォーム入力に十分な時間）

export interface LiffTokenPayload {
  lineUserId: string;
  issuedAt: number;
}

export function signLiffToken(lineUserId: string): string {
  const issuedAt = Date.now();
  const payload = `${lineUserId}.${issuedAt}`;
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

export function verifyLiffToken(token: string): LiffTokenPayload | null {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(payload)
      .digest('base64url');

    // タイミング攻撃対策: 定数時間比較
    if (signature.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null;

    const [lineUserId, issuedAtStr] = payload.split('.');
    const issuedAt = Number(issuedAtStr);
    if (!lineUserId || !issuedAt) return null;

    // 有効期限チェック
    if (Date.now() - issuedAt > TOKEN_TTL_MS) return null;

    return { lineUserId, issuedAt };
  } catch {
    return null;
  }
}
