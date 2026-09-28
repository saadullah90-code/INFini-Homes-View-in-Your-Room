import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, productModelsTable, productsTable } from "@workspace/db";
import { GetArExperienceParams, GetArExperienceResponse } from "@workspace/api-zod";
import { getAppBaseUrl } from "../lib/shopify-config";
import { isStorefrontActive } from "../lib/settings-service";
import { getPreparedModel, resolveModelUrl } from "../lib/prepared-models";

const router: IRouter = Router();

// Public route -- resolves a signed handoff token (generated at publish
// time) to the published model, for the desktop -> mobile QR/AR handoff.
router.get("/ar/:token", async (req, res): Promise<void> => {
  if (!(await isStorefrontActive())) {
    res.status(404).json({ error: "View in Your Room is not currently available." });
    return;
  }
  const params = GetArExperienceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [model] = await db
    .select()
    .from(productModelsTable)
    .where(eq(productModelsTable.arToken, params.data.token));

  if (!model || model.status !== "PUBLISHED" || !model.optimizedModelUrl) {
    res.status(404).json({ error: "Invalid, expired, or unpublished token" });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, model.productId));

  if (!product) {
    res.status(404).json({ error: "Invalid, expired, or unpublished token" });
    return;
  }
  if (product.source !== "sample" && model.provider === "mock") {
    res.status(404).json({ error: "No real model is published for this product" });
    return;
  }
  const prepared = model.provider === "prepared" ? await getPreparedModel(product.handle) : null;
  if (model.provider === "prepared" && !prepared) {
    res.status(500).json({ error: `Published prepared model registry entry missing for ${product.handle}` });
    return;
  }

  res.json(
    GetArExperienceResponse.parse({
      productTitle: product.title,
      modelUrl: resolveModelUrl(model.optimizedModelUrl, getAppBaseUrl(req)),
      thumbnailUrl: model.thumbnailUrl,
      dimensions: product.dimensionsUnit
        ? {
            width: product.dimensionsWidth,
            height: product.dimensionsHeight,
            depth: product.dimensionsDepth,
            unit: product.dimensionsUnit,
          }
        : null,
      ...(prepared ? { modelNotice: prepared.notice } : {}),
    }),
  );
});

export default router;
