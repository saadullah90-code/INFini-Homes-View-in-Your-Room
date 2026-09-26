import { db, shopifyShopsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { SHOPIFY_API_VERSION, SHOPIFY_SCOPES, getShopifyApiKey, getShopifyApiSecret } from "./shopify-config";
import { decryptAccessToken } from "./shopify-crypto";

/** Builds the merchant-facing authorize URL for the OAuth authorization-code grant. */
export function buildAuthorizeUrl(shop: string, redirectUri: string, state: string): string {
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", getShopifyApiKey());
  url.searchParams.set("scope", SHOPIFY_SCOPES.join(","));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

interface TokenExchangeResult {
  access_token: string;
  scope: string;
}

/** Exchanges the OAuth `code` for a permanent (offline) Admin API access token. */
export async function exchangeCodeForToken(shop: string, code: string): Promise<TokenExchangeResult> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: getShopifyApiKey(),
      client_secret: getShopifyApiSecret(),
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`Shopify token exchange failed: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as TokenExchangeResult;
}

export async function getActiveShop(): Promise<{ shopDomain: string; accessToken: string } | null> {
  const [row] = await db
    .select()
    .from(shopifyShopsTable)
    .where(isNull(shopifyShopsTable.uninstalledAt))
    .limit(1);

  if (!row) return null;
  return { shopDomain: row.shopDomain, accessToken: decryptAccessToken(row.accessTokenEncrypted) };
}

export interface ShopifyGraphQLError {
  message: string;
}

/**
 * Thin Admin GraphQL client. Read-only by construction: callers pass a
 * query/mutation string, but every call site in this app only ever sends
 * `query { ... }` operations (no mutations against product data) -- webhook
 * *registration* is the one exception, and that mutates only this app's own
 * webhook subscriptions, never merchant catalog data.
 */
export async function shopifyGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify Admin GraphQL request failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: T; errors?: ShopifyGraphQLError[] };
  if (json.errors?.length) {
    throw new Error(`Shopify Admin GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) {
    throw new Error("Shopify Admin GraphQL response had no data.");
  }
  return json.data;
}

export async function markShopUninstalled(shopDomain: string): Promise<void> {
  await db
    .update(shopifyShopsTable)
    .set({ uninstalledAt: new Date() })
    .where(eq(shopifyShopsTable.shopDomain, shopDomain));
}

const WEBHOOK_TOPICS = ["PRODUCTS_UPDATE", "PRODUCTS_DELETE", "APP_UNINSTALLED"] as const;

const CREATE_WEBHOOK_MUTATION = `
  mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: { callbackUrl: $callbackUrl, format: JSON }
    ) {
      webhookSubscription { id topic }
      userErrors { field message }
    }
  }
`;

/**
 * Registers this app's three required webhooks against the live store,
 * using callback URLs built from the *current* app base URL (the host that
 * actually served the OAuth callback). Called once, right after a
 * successful install/token exchange -- never touches product data.
 */
export async function registerWebhooks(shopDomain: string, accessToken: string, appBaseUrl: string): Promise<void> {
  const callbackUrlFor = (topicPath: string) => `${appBaseUrl}/api/webhooks/shopify/${topicPath}`;

  const topicToPath: Record<(typeof WEBHOOK_TOPICS)[number], string> = {
    PRODUCTS_UPDATE: "products-update",
    PRODUCTS_DELETE: "products-delete",
    APP_UNINSTALLED: "app-uninstalled",
  };

  for (const topic of WEBHOOK_TOPICS) {
    const callbackUrl = callbackUrlFor(topicToPath[topic]);
    const data = await shopifyGraphQL<{
      webhookSubscriptionCreate: {
        webhookSubscription: { id: string; topic: string } | null;
        userErrors: { field: string[]; message: string }[];
      };
    }>(shopDomain, accessToken, CREATE_WEBHOOK_MUTATION, { topic, callbackUrl });

    const { userErrors } = data.webhookSubscriptionCreate;
    if (userErrors.length > 0) {
      // "already exists"-style errors are expected on reinstall; anything
      // else is worth surfacing but shouldn't abort the rest of the install.
      throw new Error(`Failed to register ${topic} webhook: ${userErrors.map((e) => e.message).join("; ")}`);
    }
  }
}
