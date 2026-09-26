import { db, logEntriesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { isEligibleProduct } from "./eligibility";
import {
  connectStorefrontProduct,
  isValidProductHandle,
  isValidShopifyCdnImageUrl,
  isValidShopifyProductId,
} from "./storefront-service";

// Deliberately fixed: the admin cannot supply a URL, shop name, or credentials.
const CATALOG_URL = "https://infinihomes.shop/products.json";
const SHOP = "infinihomes.shop";
const PAGE_SIZE = 250;
const MAX_PAGES = 40;
const TOTAL_TIMEOUT_MS = 8 * 60 * 1000;
const PAGE_TIMEOUT_MS = 15000;
const MAX_PAGE_BYTES = 12 * 1024 * 1024;
const LOG_SOURCE = "public-catalog-sync";

interface PublicProduct {
  id: number;
  handle: string;
  title: string;
  product_type: string;
  vendor?: string;
  images?: { src: string }[];
}

export interface PublicCatalogSyncResult {
  shop: string;
  totalPublicProducts: number;
  furnitureCount: number;
  mattressCount: number;
  otherCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  completedAt: string;
}

let syncing = false;
export function isPublicCatalogSyncing(): boolean {
  return syncing;
}

async function fetchPage(page: number, deadline: number): Promise<PublicProduct[]> {
  const timeout = Math.min(PAGE_TIMEOUT_MS, deadline - Date.now());
  if (timeout <= 0) throw new Error("Public catalog sync exceeded its 8-minute timeout.");
  const url = `${CATALOG_URL}?limit=${PAGE_SIZE}&page=${page}`;
  let response: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(url, {
      redirect: "manual",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(Math.min(PAGE_TIMEOUT_MS, Math.max(1, deadline - Date.now()))),
    });
    if (response.status !== 429) break;
    await response.body?.cancel();
    if (attempt === 3) throw new Error(`Public Shopify catalog rate-limited page ${page} (HTTP 429). Please retry later.`);
    const delay = Math.min(2000 * 2 ** attempt, Math.max(0, deadline - Date.now()));
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  if (!response) throw new Error(`Public Shopify catalog page ${page} could not be loaded.`);
  if (!response.ok) throw new Error(`Public Shopify catalog page ${page} returned HTTP ${response.status}.`);
  if (!response.headers.get("content-type")?.toLowerCase().includes("json"))
    throw new Error(`Public Shopify catalog page ${page} did not return JSON.`);
  if (Number(response.headers.get("content-length")) > MAX_PAGE_BYTES)
    throw new Error(`Public Shopify catalog page ${page} is too large.`);
  if (!response.body) throw new Error(`Public Shopify catalog page ${page} was empty.`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_PAGE_BYTES) throw new Error(`Public Shopify catalog page ${page} is too large.`);
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || !("products" in parsed) ||
      !Array.isArray(parsed.products) || parsed.products.length > PAGE_SIZE) {
    throw new Error(`Public Shopify catalog page ${page} has an invalid products list.`);
  }
  return parsed.products as PublicProduct[];
}

export async function syncPublicCatalog(): Promise<PublicCatalogSyncResult> {
  if (syncing) throw new Error("A public catalog sync is already running.");
  syncing = true;
  try {
    const deadline = Date.now() + TOTAL_TIMEOUT_MS;
    const result: PublicCatalogSyncResult = {
      shop: SHOP, totalPublicProducts: 0, furnitureCount: 0, mattressCount: 0,
      otherCount: 0, createdCount: 0, updatedCount: 0, skippedCount: 0, completedAt: "",
    };
    let complete = false;
    const seen = new Set<string>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const products = await fetchPage(page, deadline);
      for (const product of products) {
        if (Date.now() >= deadline) throw new Error("Public catalog sync exceeded its 8-minute timeout.");
        if (!product || typeof product.title !== "string" || typeof product.handle !== "string")
          throw new Error(`Public Shopify catalog page ${page} contains an invalid product; sync was not marked complete.`);
        if (seen.has(product.handle)) throw new Error(`Duplicate product handle ${product.handle} in public catalog.`);
        seen.add(product.handle);
        // Match Liquid's product.type exactly: tags must not make an
        // otherwise-ineligible product eligible until its page connects.
        const category = typeof product.product_type === "string" ? product.product_type : "";
        const eligible = isEligibleProduct(category, product.title).eligible;
        const mattress = /\bmattress(?:es)?\b/i.test(`${category} ${product.title}`);
        result.totalPublicProducts++;
        if (mattress && eligible) result.mattressCount++;
        else if (eligible) result.furnitureCount++;
        else result.otherCount++;
        // Shopify can publish Unicode handles; the existing storefront route
        // accepts ASCII slugs only. Include those products in catalog totals
        // but never register an unusable model lookup.
        if (!isValidShopifyProductId(String(product.id)) ||
            !isValidProductHandle(product.handle) || !product.title.trim() ||
            product.handle.startsWith("test-")) {
          result.skippedCount++;
          continue;
        }
        const imageUrls = (product.images ?? []).map(image => image.src)
          .filter((url): url is string => typeof url === "string" && isValidShopifyCdnImageUrl(url));
        const connected = await connectStorefrontProduct({
          shop: SHOP,
          productId: String(product.id),
          handle: product.handle,
          title: product.title,
          productType: category,
          vendor: product.vendor,
          productUrl: `https://${SHOP}/products/${product.handle}`,
          imageUrls,
        }, { recordFrontendHeartbeat: false });
        if (connected.status === "created") result.createdCount++;
        else result.updatedCount++;
      }
      if (products.length < PAGE_SIZE) {
        complete = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 750));
    }
    if (!complete) throw new Error(`Public catalog exceeded the ${MAX_PAGES * PAGE_SIZE}-product safety limit; sync was not marked complete.`);
    result.completedAt = new Date().toISOString();
    await db.insert(logEntriesTable).values({
      level: "info",
      source: LOG_SOURCE,
      message: JSON.stringify(result),
    });
    return result;
  } finally {
    syncing = false;
  }
}

export async function getPublicCatalogStatus(): Promise<{ lastCompletedSync: PublicCatalogSyncResult | null; syncing: boolean }> {
  const [entry] = await db.select().from(logEntriesTable)
    .where(eq(logEntriesTable.source, LOG_SOURCE))
    .orderBy(desc(logEntriesTable.createdAt)).limit(1);
  let lastCompletedSync: PublicCatalogSyncResult | null = null;
  if (entry) {
    try {
      lastCompletedSync = JSON.parse(entry.message) as PublicCatalogSyncResult;
    } catch {
      throw new Error("Stored public catalog sync result is invalid.");
    }
  }
  return { lastCompletedSync, syncing };
}