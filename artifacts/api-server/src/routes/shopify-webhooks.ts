import { Router, type IRouter } from "express";
import { db, shopifyShopsTable, logEntriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyWebhookHmac } from "../lib/shopify-crypto";
import { getShopifyApiSecret } from "../lib/shopify-config";
import { syncSingleShopifyProduct, removeShopifyProduct } from "../lib/shopify-sync-service";
import { markShopUninstalled } from "../lib/shopify-client";
import { decryptAccessToken } from "../lib/shopify-crypto";

const router: IRouter = Router();

// Every handler here verifies the X-Shopify-Hmac-Sha256 header against the
// *raw* request body (captured by the express.json() `verify` hook in
// app.ts) before trusting the payload. Shop domain comes from the verified
// X-Shopify-Shop-Domain header, never from the body alone.
function verifyShopifyWebhook(req: import("express").Request): boolean {
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];
  if (typeof hmacHeader !== "string" || !req.rawBody) return false;
  return verifyWebhookHmac(req.rawBody, hmacHeader, getShopifyApiSecret());
}

router.post("/webhooks/shopify/products-update", async (req, res): Promise<void> => {
  if (!verifyShopifyWebhook(req)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const shopDomain = req.headers["x-shopify-shop-domain"];
  const productGid = (req.body as { admin_graphql_api_id?: string })?.admin_graphql_api_id;

  if (typeof shopDomain !== "string" || !productGid) {
    res.status(400).json({ error: "Missing shop domain or product id" });
    return;
  }

  const [shop] = await db.select().from(shopifyShopsTable).where(eq(shopifyShopsTable.shopDomain, shopDomain));
  if (!shop || shop.uninstalledAt) {
    res.status(404).json({ error: "Unknown or uninstalled shop" });
    return;
  }

  try {
    const accessToken = decryptAccessToken(shop.accessTokenEncrypted);
    await syncSingleShopifyProduct(shopDomain, accessToken, productGid);
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.error({ err, shopDomain, productGid }, "products/update webhook sync failed");
    res.status(500).json({ error: "Sync failed" });
  }
});

router.post("/webhooks/shopify/products-delete", async (req, res): Promise<void> => {
  if (!verifyShopifyWebhook(req)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const productId = (req.body as { id?: number | string })?.id;
  if (!productId) {
    res.status(400).json({ error: "Missing product id" });
    return;
  }

  // Shopify's products/delete payload carries the numeric REST id, not the
  // GID we store -- normalize to the GID form used in `products.shopifyProductId`.
  const gid = `gid://shopify/Product/${productId}`;

  try {
    await removeShopifyProduct(gid);
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.error({ err, productId }, "products/delete webhook handling failed");
    res.status(500).json({ error: "Delete handling failed" });
  }
});

router.post("/webhooks/shopify/app-uninstalled", async (req, res): Promise<void> => {
  if (!verifyShopifyWebhook(req)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const shopDomain = req.headers["x-shopify-shop-domain"];
  if (typeof shopDomain !== "string") {
    res.status(400).json({ error: "Missing shop domain" });
    return;
  }

  await markShopUninstalled(shopDomain);
  await db.insert(logEntriesTable).values({
    level: "warn",
    source: "shopify-webhook",
    message: `App uninstalled from ${shopDomain}. Stored access token invalidated locally.`,
  });

  res.status(200).json({ ok: true });
});

export default router;
