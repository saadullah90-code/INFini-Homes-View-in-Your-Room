import { getMeshyStatusDetail } from "./meshy-service";

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

/**
 * Reports honest provider/connection status. Never fakes a "connected"
 * state -- Shopify and object storage report "unavailable" until they are
 * actually wired up in a later phase.
 */
export async function getApiStatus(
  meshyLiveGenerationEnabled: boolean,
): Promise<ApiStatus> {
  const shopify: ProviderStatus = {
    configured: false,
    mode: "unavailable",
    detail:
      "No Shopify store is connected yet. This requires a merchant-created Shopify Partner custom app (SHOPIFY_API_KEY / SHOPIFY_API_SECRET) -- see the Phase 1 report for details.",
  };

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
