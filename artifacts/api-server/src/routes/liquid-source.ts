import { Router, type IRouter } from "express";
import { GetLiquidSourceResponse } from "@workspace/api-zod";
import { getLiquidSource } from "../lib/liquid-source";

const router: IRouter = Router();

// Admin-dashboard-only helper: lets the Settings page display the exact,
// live contents of shopify-custom-liquid/view-in-your-room.liquid without
// duplicating it. Not mounted under /storefront -- this is not part of the
// public, shop-restricted storefront surface, and must keep the app's
// normal (permissive) CORS so the admin dashboard's own origin can call it.
router.get("/liquid-source", async (_req, res): Promise<void> => {
  try {
    const source = await getLiquidSource();
    res.json(GetLiquidSourceResponse.parse(source));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to read Custom Liquid source." });
  }
});

export default router;
