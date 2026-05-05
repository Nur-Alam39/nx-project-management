import * as jose from 'jose';

export const AUTH_COOKIE_NAME = 'auth_token';
export const JWT_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export type AuthTokenPayload = {
  sub: string;
  email: string;
};

export async function signAuthToken(
  payload: AuthTokenPayload,
  secret: Uint8Array
): Promise<string> {
  return new jose
    .SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${JWT_MAX_AGE_SEC}s`)
    .sign(secret);
}

export async function verifyAuthToken(
  token: string,
  secret: Uint8Array
): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    const sub = payload.sub;
    const email = payload.email;
    if (!sub || typeof email !== 'string') return null;
    return { sub, email };
  } catch {
    return null;
  }
}

export function getJwtSecretFromEnv(): Uint8Array {
  const s = process.env['JWT_SECRET'];
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET must be set (minimum 16 characters)');
  }
  return new TextEncoder().encode(s);
}
