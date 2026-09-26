import { Router, type IRouter } from "express";
import { getPublicCatalogStatus, isPublicCatalogSyncing, syncPublicCatalog } from "../lib/public-catalog-service";

const router: IRouter = Router();

router.get("/admin/public-catalog-status", async (_req, res): Promise<void> => {
  res.json(await getPublicCatalogStatus());
});

router.post("/admin/public-catalog-sync", async (_req, res): Promise<void> => {
  if (isPublicCatalogSyncing()) {
    res.status(409).json({ error: "A public catalog sync is already running." });
    return;
  }
  try {
    res.json(await syncPublicCatalog());
  } catch (error) {
    res.status(502).json({
      error: `Public catalog sync did not complete: ${error instanceof Error ? error.message : String(error)}. Previously imported records were preserved; counts from a previous completed sync remain unchanged.`,
    });
  }
});

export default router;