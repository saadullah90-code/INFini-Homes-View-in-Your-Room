import { Router, type IRouter } from "express";
import cors from "cors";
import {
  GetStorefrontModelQueryParams,
  GetStorefrontModelResponse,
  ConnectStorefrontProductBody,
  ConnectStorefrontProductResponse,
  GetStorefrontConnectionStatusResponse,
} from "@workspace/api-zod";
import { getAppBaseUrl } from "../lib/shopify-config";
import {
  ALLOWED_STOREFRONT_SHOPS,
  isAllowedStorefrontShop,
  isValidProductHandle,
  isValidShopifyProductId,
  isValidStorefrontProductUrl,
  isValidShopifyCdnImageUrl,
  getStorefrontModel,
  connectStorefrontProduct,
  getStorefrontConnectionStatus,
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
  // GET is used by /storefront/model, POST by /storefront/connect. Both
  // routes share this same restrictive, shop-allowlisted CORS policy.
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
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

router.post("/storefront/connect", storefrontCors, async (req, res): Promise<void> => {
  const clientKey = req.ip ?? "unknown";
  if (isRateLimited(clientKey)) {
    res.status(429).json({ error: "Too many requests. Please try again shortly." });
    return;
  }

  const parsed = ConnectStorefrontProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid product fields." });
    return;
  }
  const body = parsed.data;

  if (!isAllowedStorefrontShop(body.shop)) {
    res.status(403).json({ error: "This shop is not authorized to use the storefront API." });
    return;
  }
  if (!isValidProductHandle(body.handle)) {
    res.status(400).json({ error: "Invalid handle." });
    return;
  }
  if (!isValidShopifyProductId(body.productId)) {
    res.status(400).json({ error: "Invalid productId." });
    return;
  }
  if (!body.title.trim()) {
    res.status(400).json({ error: "Missing title." });
    return;
  }
  if (!isValidStorefrontProductUrl(body.productUrl)) {
    res.status(400).json({ error: "Invalid productUrl." });
    return;
  }
  if (body.imageUrls.length === 0 || !body.imageUrls.every(isValidShopifyCdnImageUrl)) {
    res.status(400).json({ error: "imageUrls must be non-empty Shopify CDN (cdn.shopify.com) URLs." });
    return;
  }

  const result = await connectStorefrontProduct({
    shop: body.shop,
    productId: body.productId,
    handle: body.handle,
    title: body.title,
    productType: body.productType ?? "",
    vendor: body.vendor,
    productUrl: body.productUrl,
    imageUrls: body.imageUrls,
  });

  res.json(ConnectStorefrontProductResponse.parse(result));
});

// Admin-dashboard-only status read. Deliberately NOT mounted under
// /api/storefront's own CORS handling above (it's still on this router for
// colocation with the rest of the storefront logic, but its path doesn't
// start with /storefront) -- it falls through to the app-wide `cors()` in
// app.ts like every other internal/admin route, since only same-origin
// admin dashboard traffic is expected to call it.
router.get("/admin/storefront-status", async (_req, res): Promise<void> => {
  const status = await getStorefrontConnectionStatus();
  res.json(GetStorefrontConnectionStatusResponse.parse(status));
});

export default router;
