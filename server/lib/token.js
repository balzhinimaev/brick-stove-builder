import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(body, secret) {
  return b64url(createHmac("sha256", secret).update(body).digest());
}

/**
 * Stateless HMAC-signed token: `base64url(payload).base64url(signature)`.
 * The client cannot forge or alter the login it carries without the secret.
 */
export function signToken(login, secret, ttlMs = DEFAULT_TTL_MS, now = Date.now()) {
  const body = b64url(JSON.stringify({ login, exp: now + ttlMs }));
  return `${body}.${sign(body, secret)}`;
}

export function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== "string") return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body, secret);
  const got = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (!payload || typeof payload.login !== "string" || typeof payload.exp !== "number" || payload.exp < now) {
    return null;
  }
  return { login: payload.login };
}
