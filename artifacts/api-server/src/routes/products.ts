import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import {
  ListProductsResponse,
  GetProductParams,
  GetProductResponse,
  RecheckProductEligibilityParams,
  RecheckProductEligibilityResponse,
} from "@workspace/api-zod";
import { isEligibleProduct } from "../lib/eligibility";

const router: IRouter = Router();

function serializeProduct(row: typeof productsTable.$inferSelect) {
  return {
    ...row,
    dimensions: row.dimensionsUnit
      ? {
          width: row.dimensionsWidth,
          height: row.dimensionsHeight,
          depth: row.dimensionsDepth,
          unit: row.dimensionsUnit,
        }
      : null,
  };
}

router.get("/products", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(productsTable)
    .orderBy(productsTable.createdAt);
  res.json(ListProductsResponse.parse(rows.map(serializeProduct)));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(GetProductResponse.parse(serializeProduct(product)));
});

router.post("/products/:id/recheck-eligibility", async (req, res): Promise<void> => {
  const params = RecheckProductEligibilityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const result = isEligibleProduct(existing.category, existing.title);

  const [updated] = await db
    .update(productsTable)
    .set({ eligible: result.eligible, eligibilityReason: result.reason })
    .where(eq(productsTable.id, params.data.id))
    .returning();

  req.log.info(
    { productId: updated.id, eligible: updated.eligible },
    "Re-checked product eligibility",
  );

  res.json(RecheckProductEligibilityResponse.parse(serializeProduct(updated)));
});

export default router;
