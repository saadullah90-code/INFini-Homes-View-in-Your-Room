import { db, productsTable, productModelsTable, logEntriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isEligibleProduct } from "./eligibility";
import { shopifyGraphQL } from "./shopify-client";

// Read-only sync: every function here only ever reads from Shopify and
// writes to *this app's own* database. Nothing here calls a Shopify
// mutation against product/image/price data, and nothing modifies the
// products a merchant sees in their Shopify Admin.

const PRODUCTS_QUERY = `
  query SyncProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        handle
        category { fullName }
        productType
        media(first: 10) {
          nodes {
            ... on MediaImage {
              image { url }
            }
          }
        }
        variantsCount { count }
      }
    }
  }
`;

interface ShopifyProductNode {
  id: string;
  title: string;
  handle: string;
  category: { fullName: string } | null;
  productType: string;
  media: { nodes: Array<{ image?: { url: string } | null }> };
  variantsCount: { count: number };
}

interface ProductsQueryResult {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: ShopifyProductNode[];
  };
}

export interface SyncSummary {
  scanned: number;
  created: number;
  updated: number;
  eligible: number;
}

async function upsertShopifyProduct(node: ShopifyProductNode): Promise<{ created: boolean; eligible: boolean }> {
  const category = node.category?.fullName || node.productType || "";
  const imageUrls = node.media.nodes.map((m) => m.image?.url).filter((u): u is string => !!u);
  const { eligible, reason } = isEligibleProduct(category, node.title);

  const [existing] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.shopifyProductId, node.id));

  const values = {
    shopifyProductId: node.id,
    title: node.title,
    handle: node.handle,
    category: category || "Uncategorized",
    eligible,
    eligibilityReason: reason,
    primaryImageUrl: imageUrls[0] ?? null,
    imageUrls,
    variantCount: node.variantsCount.count,
    source: "shopify" as const,
  };

  if (existing) {
    await db.update(productsTable).set(values).where(eq(productsTable.id, existing.id));

    // If eligibility flipped to true and no model row exists yet, create one
    // in PENDING/ELIGIBLE so it shows up in the review pipeline -- generation
    // still requires an explicit admin action + confirm:true, never automatic.
    if (eligible) {
      const [model] = await db
        .select()
        .from(productModelsTable)
        .where(eq(productModelsTable.productId, existing.id));
      if (!model) {
        await db.insert(productModelsTable).values({
          productId: existing.id,
          status: "ELIGIBLE",
          provider: "mock",
          sourceImageCount: imageUrls.length,
        });
      }
    }
    return { created: false, eligible };
  }

  const [created] = await db.insert(productsTable).values(values).returning();
  if (eligible) {
    await db.insert(productModelsTable).values({
      productId: created.id,
      status: "ELIGIBLE",
      provider: "mock",
      sourceImageCount: imageUrls.length,
    });
  }
  return { created: true, eligible };
}

/** Full read-only catalog sync, paginated. Never touches Shopify data. */
export async function syncShopifyProducts(shopDomain: string, accessToken: string): Promise<SyncSummary> {
  const summary: SyncSummary = { scanned: 0, created: 0, updated: 0, eligible: 0 };
  let cursor: string | null = null;

  do {
    const data: ProductsQueryResult = await shopifyGraphQL(shopDomain, accessToken, PRODUCTS_QUERY, { cursor });
    for (const node of data.products.nodes) {
      const { created, eligible } = await upsertShopifyProduct(node);
      summary.scanned += 1;
      if (created) summary.created += 1;
      else summary.updated += 1;
      if (eligible) summary.eligible += 1;
    }
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);

  await db.insert(logEntriesTable).values({
    level: "info",
    source: "shopify-sync",
    message: `Synced ${summary.scanned} product(s) from ${shopDomain} (${summary.created} new, ${summary.updated} updated, ${summary.eligible} eligible).`,
  });

  return summary;
}

/** Applies a single product's current Shopify state, for the products/update webhook. */
export async function syncSingleShopifyProduct(
  shopDomain: string,
  accessToken: string,
  shopifyProductGid: string,
): Promise<void> {
  const query = `
    query GetProduct($id: ID!) {
      product(id: $id) {
        id
        title
        handle
        category { fullName }
        productType
        media(first: 10) { nodes { ... on MediaImage { image { url } } } }
        variantsCount { count }
      }
    }
  `;
  const data = await shopifyGraphQL<{ product: ShopifyProductNode | null }>(shopDomain, accessToken, query, {
    id: shopifyProductGid,
  });
  if (!data.product) return; // deleted/inaccessible -- products/delete webhook handles removal
  await upsertShopifyProduct(data.product);
}

/** Marks a product removed from the local catalog on the products/delete webhook. Never calls Shopify to delete anything -- this only reflects a deletion that already happened in Shopify. */
export async function removeShopifyProduct(shopifyProductGid: string): Promise<void> {
  await db.delete(productsTable).where(eq(productsTable.shopifyProductId, shopifyProductGid));
  await db.insert(logEntriesTable).values({
    level: "info",
    source: "shopify-webhook",
    message: `Product ${shopifyProductGid} removed from local catalog (deleted in Shopify).`,
  });
}
