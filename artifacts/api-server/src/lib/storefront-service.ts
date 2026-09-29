import { db, productsTable, productModelsTable, logEntriesTable } from "@workspace/db";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { isEligibleProduct } from "./eligibility";
import { isStorefrontActive } from "./settings-service";
import { getPreparedModel, resolveModelUrl } from "./prepared-models";

// Public, shop-restricted read model for the storefront Custom Liquid
// frontend. Every function here is read-only: nothing writes to `products`
// or `product_models`, nothing calls Shopify or Meshy, and nothing returns a
// database id, Shopify id, or internal pipeline status string.

// Only the storefront domain for this one merchant may call the public
// endpoint that uses this service -- deliberately separate from the
// `*.myshopify.com` domain used for the OAuth/Admin API side of the app.
export const ALLOWED_STOREFRONT_SHOPS = new Set<string>([
  "infinihomes.shop",
  "www.infinihomes.shop",
]);

export function isAllowedStorefrontShop(shop: string): boolean {
  return ALLOWED_STOREFRONT_SHOPS.has(shop.trim().toLowerCase());
}

// Shopify product handles are lowercase slugs: letters, digits, hyphens.
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,253}[a-z0-9])?$/;

export function isValidProductHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle);
}

// Shopify's Liquid `product.id` is a plain positive integer (as a string
// once serialized into a data attribute) -- never the GID form used by the
// Admin GraphQL API.
const PRODUCT_ID_PATTERN = /^[0-9]{1,32}$/;

export function isValidShopifyProductId(productId: string): boolean {
  return PRODUCT_ID_PATTERN.test(productId.trim());
}

// Accepts either an absolute URL on an allowed shop, or a store-relative
// path (what Liquid's `product.url` returns by default). Either way, only a
// path under /products/ is accepted -- this is never used to fetch the URL,
// only to display/store it, but it's still validated so a malformed or
// unrelated URL can't be stored as if it were the product's page.
export function isValidStorefrontProductUrl(productUrl: string): boolean {
  const trimmed = productUrl.trim();
  if (trimmed.startsWith("/")) {
    return trimmed.startsWith("/products/");
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return false;
    if (!isAllowedStorefrontShop(url.hostname)) return false;
    return url.pathname.startsWith("/products/");
  } catch {
    return false;
  }
}

// Only Shopify's own CDN may be the source of an image URL -- this is the
// one place this endpoint could otherwise be tricked into pointing the
// catalog at an arbitrary external image, so it's checked strictly and the
// URL itself is never fetched server-side.
const SHOPIFY_CDN_HOSTS = new Set(["cdn.shopify.com"]);

export function isValidShopifyCdnImageUrl(imageUrl: string): boolean {
  try {
    const url = new URL(imageUrl);
    return url.protocol === "https:" && SHOPIFY_CDN_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Stable hash of a product's current image set, order-independent. */
export function computeImageSetHash(imageUrls: string[]): string {
  const normalized = [...imageUrls].map((u) => u.trim()).sort();
  return createHash("sha256").update(normalized.join("|")).digest("hex");
}

export interface StorefrontModelResult {
  fetched: boolean;
  eligible: boolean;
  available: boolean;
  inactive: boolean;
  imageUrl?: string;
  productHandle?: string;
  title?: string;
  modelUrl?: string;
  thumbnailUrl?: string | null;
  arUrl?: string;
  dimensions?: { width: number | null; height: number | null; depth: number | null; unit: string };
  modelNotice?: string;
}

/**
 * Looks up whether a previously fetched product identified by its Shopify
 * handle has a PUBLISHED model with a real GLB URL, and returns only the public
 * fields the storefront needs. Reuses the exact same publish-gating logic as
 * the existing `/ar/:token` route (status === "PUBLISHED" && optimizedModelUrl
 * set), just keyed by product handle instead of the AR token.
 */
export async function getStorefrontModel(
  handle: string,
  appBaseUrl: string,
): Promise<StorefrontModelResult> {
  const active = await isStorefrontActive();
  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.handle, handle), ne(productsTable.source, "sample")));

  if (!product) {
    return { fetched: false, eligible: false, available: false, inactive: false };
  }
  if (!active) {
    return { fetched: false, eligible: false, available: false, inactive: true };
  }
  const imageUrl = product.primaryImageUrl && isValidShopifyCdnImageUrl(product.primaryImageUrl)
    ? product.primaryImageUrl : undefined;
  if (!product.eligible) {
    return { fetched: true, eligible: false, available: false, inactive: false, imageUrl };
  }

  const [model] = await db
    .select()
    .from(productModelsTable)
    .where(eq(productModelsTable.productId, product.id));

  if (!model || model.status !== "PUBLISHED" || !model.optimizedModelUrl || !model.arToken ||
      (product.source !== "sample" && model.provider === "mock")) {
    return { fetched: true, eligible: true, available: false, inactive: false, imageUrl };
  }

  const prepared = model.provider === "prepared" ? await getPreparedModel(product.handle) : null;
  if (model.provider === "prepared" && !prepared) {
    throw new Error(`Published prepared model registry entry missing for ${product.handle}`);
  }
  return {
    fetched: true,
    eligible: true,
    available: true,
    inactive: false,
    imageUrl,
    productHandle: product.handle,
    title: product.title,
    modelUrl: resolveModelUrl(model.optimizedModelUrl, appBaseUrl),
    thumbnailUrl: model.thumbnailUrl,
    arUrl: `${appBaseUrl}/api/ar/${model.arToken}`,
    ...(prepared ? {
      dimensions: prepared.dimensions,
      modelNotice: prepared.notice,
    } : {}),
  };
}

// Marks a row created/refreshed via the no-OAuth storefront connect flow, as
// opposed to "shopify" (OAuth sync) or "sample" (seed data) sources already
// used elsewhere. `products.source` is a plain text column with no DB-level
// enum, so this is just a new string value, not a schema change.
const STOREFRONT_SOURCE = "storefront";

// Source tag used for the heartbeat log line, read back by
// `getStorefrontConnectionStatus`. Reuses the existing `log_entries` table
// instead of adding a new one -- the heartbeat fields are packed into
// `message` as JSON and parsed back out.
const HEARTBEAT_LOG_SOURCE = "storefront-heartbeat";

interface HeartbeatPayload {
  shop: string;
  lastProductHandle: string;
  lastProductId: string;
  lastProductConnectionStatus: "created" | "updated" | "unchanged";
}

async function recordHeartbeat(payload: HeartbeatPayload): Promise<void> {
  await db.insert(logEntriesTable).values({
    level: "info",
    source: HEARTBEAT_LOG_SOURCE,
    message: JSON.stringify(payload),
  });
}

export interface StorefrontConnectInput {
  shop: string;
  productId: string;
  handle: string;
  title: string;
  productType: string;
  vendor?: string;
  productUrl: string;
  imageUrls: string[];
}

export interface StorefrontConnectResult {
  connected: true;
  eligible: boolean;
  status: "created" | "updated";
}

/**
 * Registers or refreshes a product from the public, no-OAuth storefront
 * flow. Only ever reads the fields listed in `StorefrontConnectInput` --
 * never a Shopify token, Meshy key, or other secret, since none of those are
 * even accepted as input. Eligibility is always recomputed server-side via
 * the same `isEligibleProduct` rules used by the OAuth sync path, so the
 * caller can never mark itself eligible. Never triggers generation -- at
 * most it creates a model row in the same "ELIGIBLE" pre-generation state
 * the OAuth sync path already uses.
 */
export async function connectStorefrontProduct(
  input: StorefrontConnectInput,
  options: { recordFrontendHeartbeat?: boolean } = {},
): Promise<StorefrontConnectResult> {
  const { eligible, reason } = isEligibleProduct(input.productType, input.title);
  const imageUrls = input.imageUrls;
  const primaryImageUrl = imageUrls[0] ?? null;
  const newImageHash = computeImageSetHash(imageUrls);

  const [existing] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.handle, input.handle));

  const values = {
    shopifyProductId: input.productId,
    title: input.title,
    handle: input.handle,
    category: input.productType || "Uncategorized",
    eligible,
    eligibilityReason: reason,
    primaryImageUrl,
    imageUrls,
    variantCount: existing?.variantCount ?? 0,
    source: STOREFRONT_SOURCE,
  };

  let connectionStatus: "created" | "updated";

  if (existing) {
    await db.update(productsTable).set(values).where(eq(productsTable.id, existing.id));
    connectionStatus = "updated";

    const [model] = await db
      .select()
      .from(productModelsTable)
      .where(eq(productModelsTable.productId, existing.id));

    if (!model && eligible) {
      await db.insert(productModelsTable).values({
        productId: existing.id,
        status: "ELIGIBLE",
        provider: "mock",
        sourceImageCount: imageUrls.length,
      });
    } else if (model && model.imageSetHash && model.imageSetHash !== newImageHash) {
      // The product's Shopify images changed since this model was last
      // generated. Never regenerate automatically -- only send an
      // already-vetted model back to REVIEW so an admin re-checks it before
      // it (or its dimensions) is trusted again. Both REVIEW and this
      // demotion path already exist in the pipeline's status machine; no
      // new status value is introduced here.
      if (model.status === "PUBLISHED" || model.status === "APPROVED") {
        await db
          .update(productModelsTable)
          .set({ status: "REVIEW" })
          .where(eq(productModelsTable.id, model.id));
        await db.insert(logEntriesTable).values({
          level: "warn",
          source: "storefront-connect",
          message: `Product images changed for "${input.title}" (${input.handle}) after its model was ${model.status.toLowerCase()} -- moved back to REVIEW for re-approval.`,
        });
      }
    }
  } else {
    const [created] = await db.insert(productsTable).values(values).returning();
    connectionStatus = "created";

    if (eligible) {
      await db.insert(productModelsTable).values({
        productId: created.id,
        status: "ELIGIBLE",
        provider: "mock",
        sourceImageCount: imageUrls.length,
      });
    }
  }

  if (options.recordFrontendHeartbeat !== false) {
    await recordHeartbeat({
      shop: input.shop,
      lastProductHandle: input.handle,
      lastProductId: input.productId,
      lastProductConnectionStatus: connectionStatus,
    });
  }

  return { connected: true, eligible, status: connectionStatus };
}

export interface StorefrontConnectionStatus {
  allowedShops: string[];
  backendOnline: boolean;
  frontendConnected: boolean;
  lastSeenAt: string | null;
  lastProductHandle: string | null;
  lastProductId: string | null;
  lastProductConnectionStatus: string | null;
  connectedProductCount: number;
  eligibleProductCount: number;
  publishedModelCount: number;
}

// How recently the storefront must have called /storefront/connect for the
// admin dashboard to consider the frontend "connected" rather than merely
// "seen before, but not recently".
const FRONTEND_RECENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Honest status for the "Storefront Connection" section of the admin
 * dashboard -- entirely separate from the Shopify Admin API OAuth status
 * reported by `/status`/`getApiStatus`. Never claims OAuth is connected;
 * this only reflects whether the public, no-OAuth connect/model endpoints
 * have been used by the storefront recently.
 */
export async function getStorefrontConnectionStatus(): Promise<StorefrontConnectionStatus> {
  const [lastHeartbeat] = await db
    .select()
    .from(logEntriesTable)
    .where(eq(logEntriesTable.source, HEARTBEAT_LOG_SOURCE))
    .orderBy(desc(logEntriesTable.createdAt))
    .limit(1);

  let payload: HeartbeatPayload | null = null;
  if (lastHeartbeat) {
    try {
      payload = JSON.parse(lastHeartbeat.message) as HeartbeatPayload;
    } catch {
      payload = null;
    }
  }

  const lastSeenAt = lastHeartbeat ? lastHeartbeat.createdAt.toISOString() : null;
  const frontendConnected =
    !!lastHeartbeat && Date.now() - lastHeartbeat.createdAt.getTime() < FRONTEND_RECENCY_WINDOW_MS;

  const [connectedCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(and(eq(productsTable.source, STOREFRONT_SOURCE), sql`${productsTable.handle} not like 'test-%'`));

  const [eligibleCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(and(eq(productsTable.source, STOREFRONT_SOURCE), eq(productsTable.eligible, true), sql`${productsTable.handle} not like 'test-%'`));

  const [publishedCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productModelsTable)
    .innerJoin(productsTable, eq(productModelsTable.productId, productsTable.id))
    .where(and(eq(productsTable.source, STOREFRONT_SOURCE), eq(productModelsTable.status, "PUBLISHED"), sql`${productsTable.handle} not like 'test-%'`));

  return {
    allowedShops: Array.from(ALLOWED_STOREFRONT_SHOPS),
    backendOnline: true,
    frontendConnected,
    lastSeenAt,
    lastProductHandle: payload?.lastProductHandle ?? null,
    lastProductId: payload?.lastProductId ?? null,
    lastProductConnectionStatus: payload?.lastProductConnectionStatus ?? null,
    connectedProductCount: connectedCountRow?.count ?? 0,
    eligibleProductCount: eligibleCountRow?.count ?? 0,
    publishedModelCount: publishedCountRow?.count ?? 0,
  };
}
