import { createHmac, createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// All Shopify trust boundaries (OAuth callback HMAC, install-state CSRF
// token, webhook HMAC, access-token-at-rest encryption) are implemented here
// with Node's built-in crypto -- no external Shopify SDK dependency, so the
// exact verification logic is auditable in one place.
//
// SHOPIFY_API_SECRET is Shopify's own signing secret for OAuth/webhook HMACs
// (required by Shopify's protocol, not our choice). SESSION_SECRET (already
// present in this project) is reused, via HKDF-style derivation, as the key
// for our own state-token signing and access-token-at-rest encryption --
// this avoids requesting a secret that already effectively exists.

function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required for Shopify OAuth state signing and token encryption.");
  }
  return secret;
}

function deriveKey(info: string): Buffer {
  // scrypt with a fixed, purpose-specific salt derives an independent key
  // per use-case from the same base secret, so state-signing and
  // token-encryption never share literal key material.
  return scryptSync(requireSessionSecret(), `shopify:${info}`, 32);
}

/**
 * Verifies Shopify's HMAC over the OAuth callback query string.
 * Per Shopify's documented algorithm: remove `hmac` and `signature`, sort
 * remaining params, join as `key=value` with `&`, HMAC-SHA256 with the app
 * secret, compare hex digest.
 */
export function verifyOAuthHmac(query: Record<string, unknown>, apiSecret: string): boolean {
  const { hmac, signature, ...rest } = query;
  if (typeof hmac !== "string" || !hmac) return false;
  void signature;

  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${Array.isArray(rest[key]) ? rest[key]?.join(",") : rest[key]}`)
    .join("&");

  const digest = createHmac("sha256", apiSecret).update(message).digest("hex");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(hmac, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Verifies a webhook request body against the X-Shopify-Hmac-Sha256 header.
 * Must be called with the *raw* request body bytes -- a re-serialized JSON
 * body will not match Shopify's signature.
 */
export function verifyWebhookHmac(rawBody: Buffer, headerHmac: string | undefined, apiSecret: string): boolean {
  if (!headerHmac) return false;
  const digest = createHmac("sha256", apiSecret).update(rawBody).digest("base64");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(headerHmac, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Validates a shop parameter is a well-formed *.myshopify.com domain. */
export function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes -- OAuth install/callback round trip only.

/** Creates a signed, time-limited, stateless CSRF token for the OAuth flow. */
export function createOAuthState(shop: string): string {
  const payload = JSON.stringify({ shop, ts: Date.now() });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = createHmac("sha256", deriveKey("oauth-state")).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyOAuthState(state: string, expectedShop: string): boolean {
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) return false;

  const expectedSig = createHmac("sha256", deriveKey("oauth-state")).update(payloadB64).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  try {
    const { shop, ts } = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      shop: string;
      ts: number;
    };
    return shop === expectedShop && Date.now() - ts < STATE_TTL_MS;
  } catch {
    return false;
  }
}

/** AES-256-GCM encrypt, for storing the Admin API access token at rest. */
export function encryptAccessToken(token: string): string {
  const key = deriveKey("access-token-encryption");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptAccessToken(encrypted: string): string {
  const key = deriveKey("access-token-encryption");
  const raw = Buffer.from(encrypted, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
