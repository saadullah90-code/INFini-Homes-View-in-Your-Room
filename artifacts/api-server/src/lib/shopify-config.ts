// Central Shopify app configuration. Read-only scopes only -- Phase "Shopify
// integration" never writes to Shopify (no product/image/price mutation).
//
// Scope choice: `read_products` is the single scope needed for product
// listing, images/media, and Shopify's standardized product taxonomy
// (`Product.category`) via the Admin GraphQL API. No `write_*` scope is
// requested because nothing in this app modifies Shopify data.
export const SHOPIFY_SCOPES = ["read_products"] as const;

// Admin GraphQL API version. Shopify ships a new stable version quarterly
// (YYYY-01/04/07/10) and drops support for versions older than ~1 year --
// bump this periodically.
export const SHOPIFY_API_VERSION = "2025-01";

export function getShopifyApiKey(): string {
  const key = process.env.SHOPIFY_API_KEY;
  if (!key) {
    throw new Error("SHOPIFY_API_KEY is not set. Add it via the app's secrets before using Shopify OAuth.");
  }
  return key;
}

export function getShopifyApiSecret(): string {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    throw new Error("SHOPIFY_API_SECRET is not set. Add it via the app's secrets before using Shopify OAuth.");
  }
  return secret;
}

export function isShopifyConfigured(): boolean {
  return !!process.env.SHOPIFY_API_KEY && !!process.env.SHOPIFY_API_SECRET;
}

/**
 * Builds this app's own callback URL from the *incoming request's* host,
 * rather than a hardcoded or guessed domain. This is deliberate: whatever
 * host the request actually arrived on (today's Replit dev domain, or a
 * production domain after publishing) is, by construction, a host this
 * service is reachable at -- so it's always correct without maintaining a
 * separate "app URL" setting that could drift out of sync.
 *
 * IMPORTANT: this means the OAuth callback URL (and the webhook callback
 * URLs registered at install time) are pinned to whatever host was used
 * for that particular installation. Reinstalling after a domain change
 * (e.g. moving from the dev domain to a published production domain)
 * re-registers webhooks against the new host.
 */
export function getAppBaseUrl(req: { protocol: string; get(name: string): string | undefined }): string {
  const host = req.get("host");
  if (!host) {
    throw new Error("Could not determine request host to build the Shopify callback URL.");
  }
  // Replit's proxy terminates TLS in front of the app; trust HTTPS in any
  // environment where the request didn't arrive over plain loopback HTTP.
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? req.protocol : "https";
  return `${protocol}://${host}`;
}
