// Простая однопользовательская авторизация паролем из APP_PASSWORD (раздел 9.4 ТЗ).
// Без БД/сессий на сервере: cookie — это подписанный HMAC-токен с сроком
// действия, что верифицируется тем же паролем как секретом. Используем Web
// Crypto (`crypto.subtle`), а не Node `crypto`, — модуль импортируется и из
// middleware.ts, которое исполняется в Edge runtime.

export const SESSION_COOKIE_NAME = "notifyme_session";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 дней

function getAppPassword(): string {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    throw new Error("APP_PASSWORD is not set");
  }
  return password;
}

function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function verifyPassword(input: string): Promise<boolean> {
  const secret = getAppPassword();
  // HMAC обеих строк одним ключом и сравнение дайджестов — чтобы не сравнивать
  // пароль посимвольно и не открывать длину/содержимое через тайминг.
  const key = await importHmacKey(secret);
  const [a, b] = await Promise.all([
    crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)),
    crypto.subtle.sign("HMAC", key, new TextEncoder().encode(secret)),
  ]);
  const aBytes = new Uint8Array(a);
  const bBytes = new Uint8Array(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const secret = getAppPassword();
  const key = await importHmacKey(secret);
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })));
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  try {
    const secret = getAppPassword();
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return false;

    const { exp } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}
