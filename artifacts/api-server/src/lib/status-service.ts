import { db, shopifyShopsTable } from "@workspace/db";
import { getMeshyStatusDetail } from "./meshy-service";
import { isShopifyConfigured } from "./shopify-config";

export interface ProviderStatus {
  configured: boolean;
  mode: "mock" | "live" | "unavailable";
  detail: string;
}

export interface ApiStatus {
  shopify: ProviderStatus;
  meshy: ProviderStatus;
  database: ProviderStatus;
  storage: ProviderStatus;
}

async function getShopifyStatus(): Promise<ProviderStatus> {
  if (!isShopifyConfigured()) {
    return {
      configured: false,
      mode: "unavailable",
      detail:
        "No Shopify store is connected yet. This requires a merchant-created Shopify Partner custom app (SHOPIFY_API_KEY / SHOPIFY_API_SECRET).",
    };
  }

  const rows = await db.select().from(shopifyShopsTable);
  const active = rows.find((r) => !r.uninstalledAt);

  if (!active) {
    return {
      configured: true,
      mode: "unavailable",
      detail: "Shopify credentials are set, but no store has completed OAuth installation yet.",
    };
  }

  return {
    configured: true,
    mode: "live",
    detail: `Connected to ${active.shopDomain} (read-only). Scopes: ${active.scope}.${
      active.lastSyncedAt ? ` Last synced ${active.lastSyncedAt.toISOString()}.` : " No sync has run yet."
    }`,
  };
}

/**
 * Reports honest provider/connection status. Never fakes a "connected"
 * state -- Shopify and object storage report "unavailable" until they are
 * actually wired up.
 */
export async function getApiStatus(
  meshyLiveGenerationEnabled: boolean,
): Promise<ApiStatus> {
  const shopify = await getShopifyStatus();

  const meshy = getMeshyStatusDetail(meshyLiveGenerationEnabled);

  const database: ProviderStatus = {
    configured: !!process.env.DATABASE_URL,
    mode: process.env.DATABASE_URL ? "live" : "unavailable",
    detail: process.env.DATABASE_URL
      ? "Connected to the project's PostgreSQL database."
      : "DATABASE_URL is not set.",
  };

  const storage: ProviderStatus = {
    configured: false,
    mode: "unavailable",
    detail:
      "Object storage is not yet wired up. Recommended: Replit Object Storage for GLB/thumbnail files, added in a later phase.",
  };

  return { shopify, meshy, database, storage };
}
