import { db, shopifyShopsTable } from "@workspace/db";
import { getMeshyStatusDetail } from "./meshy-service";
import { isShopifyConfigured } from "./shopify-config";
import { getPreparedModel, PREPARED_MATTRESS_HANDLE, verifyPreparedModel } from "./prepared-models";

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
 * state -- storage reports live only when the configured public asset is
 * actually present in App Storage.
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

  const storageConfigured = !!process.env.PUBLIC_OBJECT_SEARCH_PATHS?.trim();
  let storage: ProviderStatus;
  if (!storageConfigured) {
    storage = {
      configured: false,
      mode: "unavailable",
      detail: "PUBLIC_OBJECT_SEARCH_PATHS is not configured. Public asset serving is unavailable; no upload API is provided.",
    };
  } else {
    try {
      const entry = await getPreparedModel(PREPARED_MATTRESS_HANDLE);
      const exists = entry ? await verifyPreparedModel(entry) : false;
      storage = {
        configured: true,
        mode: exists ? "live" : "unavailable",
        detail: exists
          ? "Public App Storage GLB serving is configured and the registered prepared mattress asset exists (read-only; no upload API)."
          : "Public App Storage is configured but the prepared mattress registry entry or GLB object is missing (read-only; no upload API).",
      };
    } catch (err) {
      storage = {
        configured: true,
        mode: "unavailable",
        detail: `Could not verify the read-only public GLB asset: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { shopify, meshy, database, storage };
}
