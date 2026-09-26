import { db, productsTable, productModelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

export interface StorefrontModelResult {
  available: boolean;
  productHandle?: string;
  title?: string;
  modelUrl?: string;
  thumbnailUrl?: string | null;
  arUrl?: string;
}

/**
 * Looks up whether an eligible product identified by its Shopify handle has
 * a PUBLISHED model with a real GLB URL, and if so returns only the public
 * fields the storefront needs. Reuses the exact same publish-gating logic as
 * the existing `/ar/:token` route (status === "PUBLISHED" && optimizedModelUrl
 * set), just keyed by product handle instead of the AR token.
 */
export async function getStorefrontModel(
  handle: string,
  appBaseUrl: string,
): Promise<StorefrontModelResult> {
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.handle, handle));

  if (!product || !product.eligible) {
    return { available: false };
  }

  const [model] = await db
    .select()
    .from(productModelsTable)
    .where(eq(productModelsTable.productId, product.id));

  if (!model || model.status !== "PUBLISHED" || !model.optimizedModelUrl || !model.arToken) {
    return { available: false };
  }

  return {
    available: true,
    productHandle: product.handle,
    title: product.title,
    modelUrl: model.optimizedModelUrl,
    thumbnailUrl: model.thumbnailUrl,
    arUrl: `${appBaseUrl}/api/ar/${model.arToken}`,
  };
}
