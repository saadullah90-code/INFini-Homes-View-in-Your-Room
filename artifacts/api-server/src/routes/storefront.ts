import { Router, type IRouter } from "express";
import cors from "cors";
import { GetStorefrontModelQueryParams, GetStorefrontModelResponse } from "@workspace/api-zod";
import { getAppBaseUrl } from "../lib/shopify-config";
import {
  ALLOWED_STOREFRONT_SHOPS,
  isAllowedStorefrontShop,
  isValidProductHandle,
  getStorefrontModel,
} from "../lib/storefront-service";

const router: IRouter = Router();

// This route is embedded in a public Shopify theme (Custom Liquid), so it
// gets its own, tighter CORS policy instead of the app-wide `cors()` used by
// the admin/API routes -- only the storefront's own origins may call it.
const storefrontCors = cors({
  origin: (origin, callback) => {
    // Same-origin/non-browser requests (curl, server-to-server, the
    // Liquid page's own fetch when `origin` isn't sent) have no Origin
    // header at all; allow those through since the shop allowlist check
    // below is the real gate. Browser cross-origin calls do send Origin,
    // and that's what's restricted here.
    if (!origin) {
      callback(null, true);
      return;
    }
    try {
      const { hostname } = new URL(origin);
      callback(null, ALLOWED_STOREFRONT_SHOPS.has(hostname));
    } catch {
      callback(null, false);
    }
  },
  methods: ["GET"],
});

// Minimal in-memory sliding-window limiter, scoped to this router only.
// Deliberately dependency-free -- this is the only public, unauthenticated
// endpoint in the app, so it's the only one that needs it. Not suitable for
// a multi-instance deployment (state is per-process), which is fine for a
// single Railway/Replit instance; revisit if this app ever scales
// horizontally.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

router.get("/storefront/model", storefrontCors, async (req, res): Promise<void> => {
  const clientKey = req.ip ?? "unknown";
  if (isRateLimited(clientKey)) {
    res.status(429).json({ error: "Too many requests. Please try again shortly." });
    return;
  }

  // Note: the generated schema uses zod.coerce.string(), which happily
  // stringifies `undefined` into the literal text "undefined" rather than
  // failing -- so presence is checked explicitly here first, ahead of the
  // schema parse, to correctly reject a genuinely missing parameter as 400
  // instead of silently evaluating a fake "undefined" handle.
  if (typeof req.query.shop !== "string" || typeof req.query.product_handle !== "string") {
    res.status(400).json({ error: "Missing or invalid shop or product_handle." });
    return;
  }

  const params = GetStorefrontModelQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "Missing or invalid shop or product_handle." });
    return;
  }

  const { shop, product_handle: productHandle } = params.data;

  if (!isAllowedStorefrontShop(shop)) {
    res.status(403).json({ error: "This shop is not authorized to use the storefront API." });
    return;
  }

  if (!isValidProductHandle(productHandle)) {
    res.status(400).json({ error: "Invalid product_handle." });
    return;
  }

  const appBaseUrl = getAppBaseUrl(req);
  const result = await getStorefrontModel(productHandle, appBaseUrl);
  res.json(GetStorefrontModelResponse.parse(result));
});

export default router;
