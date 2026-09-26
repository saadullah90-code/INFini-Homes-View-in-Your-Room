import { Router, type IRouter } from "express";
import { db, shopifyShopsTable, logEntriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  isValidShopDomain,
  verifyOAuthHmac,
  createOAuthState,
  verifyOAuthState,
  encryptAccessToken,
  decryptAccessToken,
} from "../lib/shopify-crypto";
import { getAppBaseUrl, getShopifyApiSecret, isShopifyConfigured } from "../lib/shopify-config";
import { buildAuthorizeUrl, exchangeCodeForToken, registerWebhooks } from "../lib/shopify-client";
import { syncShopifyProducts } from "../lib/shopify-sync-service";

const router: IRouter = Router();

// Step 1 of the standard OAuth authorization-code grant: the merchant (or
// the admin, during setup) hits this with ?shop=xxxx.myshopify.com and gets
// redirected to Shopify's consent screen. This is a non-embedded app, so
// the classic redirect-based grant is the correct, currently-supported flow
// (Shopify's "managed installation"/token-exchange path is for apps
// embedded in Shopify Admin via App Bridge, which this app is not).
router.get("/shopify/install", (req, res): void => {
  if (!isShopifyConfigured()) {
    res.status(503).json({
      error: "Shopify is not configured yet. SHOPIFY_API_KEY and SHOPIFY_API_SECRET must be set first.",
    });
    return;
  }

  const shop = typeof req.query.shop === "string" ? req.query.shop : "";
  if (!isValidShopDomain(shop)) {
    res.status(400).json({ error: "Invalid or missing shop parameter -- expected e.g. infinihomes.myshopify.com" });
    return;
  }

  const appBaseUrl = getAppBaseUrl(req);
  const redirectUri = `${appBaseUrl}/api/shopify/auth/callback`;
  const state = createOAuthState(shop);

  res.redirect(buildAuthorizeUrl(shop, redirectUri, state));
});

// Step 2: Shopify redirects back here with ?code&hmac&shop&state. Verify
// HMAC + state, exchange the code for an offline access token, store it
// encrypted, then register the three required webhooks and kick off an
// initial read-only sync.
router.get("/shopify/auth/callback", async (req, res): Promise<void> => {
  if (!isShopifyConfigured()) {
    res.status(503).json({ error: "Shopify is not configured." });
    return;
  }

  const shop = typeof req.query.shop === "string" ? req.query.shop : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";

  if (!isValidShopDomain(shop) || !code || !state) {
    res.status(400).json({ error: "Missing or invalid shop, code, or state." });
    return;
  }

  if (!verifyOAuthState(state, shop)) {
    res.status(403).json({ error: "Invalid or expired OAuth state -- possible CSRF attempt. Restart the install." });
    return;
  }

  if (!verifyOAuthHmac(req.query as Record<string, unknown>, getShopifyApiSecret())) {
    res.status(403).json({ error: "Invalid HMAC signature on OAuth callback." });
    return;
  }

  try {
    const { access_token: accessToken, scope } = await exchangeCodeForToken(shop, code);

    await db
      .insert(shopifyShopsTable)
      .values({
        shopDomain: shop,
        accessTokenEncrypted: encryptAccessToken(accessToken),
        scope,
        uninstalledAt: null,
      })
      .onConflictDoUpdate({
        target: shopifyShopsTable.shopDomain,
        set: { accessTokenEncrypted: encryptAccessToken(accessToken), scope, uninstalledAt: null },
      });

    const appBaseUrl = getAppBaseUrl(req);
    await registerWebhooks(shop, accessToken, appBaseUrl);

    await db.insert(logEntriesTable).values({
      level: "info",
      source: "shopify-auth",
      message: `Shopify app installed for ${shop}. Scopes: ${scope}. Webhooks registered.`,
    });

    // Kick off an initial read-only sync so the catalog isn't empty, but
    // don't fail the install if it errors -- the admin can retry from the
    // dashboard via POST /shopify/sync.
    syncShopifyProducts(shop, accessToken).catch((err) => {
      req.log.error({ err, shop }, "Initial Shopify sync after install failed");
    });

    res.status(200).send(
      `<html><body style="font-family:sans-serif;padding:40px"><h1>Shopify app installed</h1><p>Connected to <strong>${shop}</strong>. Read-only product sync has started. You can close this tab and return to the admin dashboard's Connections page.</p></body></html>`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err, shop }, "Shopify OAuth callback failed");
    await db.insert(logEntriesTable).values({
      level: "error",
      source: "shopify-auth",
      message: `Shopify install failed for ${shop}: ${message}`,
    });
    res.status(500).json({ error: `Shopify install failed: ${message}` });
  }
});

// Manual, admin-triggered read-only sync. Never generates or publishes
// anything -- purely pulls current product/media/category data from Shopify
// into the local read model.
router.post("/shopify/sync", async (req, res): Promise<void> => {
  const rows = await db.select().from(shopifyShopsTable);
  const active = rows.find((r) => !r.uninstalledAt);

  if (!active) {
    res.status(400).json({ error: "No connected Shopify store. Visit /api/shopify/install?shop=<store>.myshopify.com first." });
    return;
  }

  try {
    const accessToken = decryptAccessToken(active.accessTokenEncrypted);
    const summary = await syncShopifyProducts(active.shopDomain, accessToken);
    await db.update(shopifyShopsTable).set({ lastSyncedAt: new Date() }).where(eq(shopifyShopsTable.id, active.id));
    res.json({ shop: active.shopDomain, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Manual Shopify sync failed");
    res.status(502).json({ error: `Shopify sync failed: ${message}` });
  }
});

export default router;
