import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  productModelsTable,
  productsTable,
  generationJobsTable,
  logEntriesTable,
} from "@workspace/db";
import {
  ListModelsResponse,
  GetModelParams,
  GetModelResponse,
  GenerateModelParams,
  GenerateModelBody,
  GenerateModelResponse,
  ApproveModelParams,
  ApproveModelBody,
  ApproveModelResponse,
  RejectModelParams,
  RejectModelBody,
  RejectModelResponse,
  PublishModelParams,
  PublishModelResponse,
  UnpublishModelParams,
  UnpublishModelResponse,
} from "@workspace/api-zod";
import { generateMockModel } from "../lib/meshy-service";
import { generateArToken } from "../lib/ar-token";
import { getAppSettings } from "../lib/settings-service";

const router: IRouter = Router();

router.get("/models", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(productModelsTable)
    .orderBy(productModelsTable.createdAt);
  res.json(ListModelsResponse.parse(rows));
});

router.get("/models/:id", async (req, res): Promise<void> => {
  const params = GetModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [model] = await db
    .select()
    .from(productModelsTable)
    .where(eq(productModelsTable.id, params.data.id));

  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  res.json(GetModelResponse.parse(model));
});

router.post("/models/:id/generate", async (req, res): Promise<void> => {
  const params = GenerateModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = GenerateModelBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  if (!body.data.confirm) {
    res.status(400).json({
      error: "Explicit confirmation (confirm: true) is required to start a generation.",
    });
    return;
  }

  const [model] = await db
    .select()
    .from(productModelsTable)
    .where(eq(productModelsTable.id, params.data.id));

  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, model.productId));

  if (!product || !product.eligible) {
    res.status(400).json({
      error: "Product is not eligible for 3D/AR generation (Furniture/Mattress only).",
    });
    return;
  }

  // Phase 1 always uses the mock provider -- live Meshy generation is not
  // implemented yet regardless of the meshyLiveGenerationEnabled setting.
  const settings = await getAppSettings();

  const [queuedModel] = await db
    .update(productModelsTable)
    .set({ status: "PROCESSING", provider: "mock", errorMessage: null })
    .where(eq(productModelsTable.id, model.id))
    .returning();

  const [job] = await db
    .insert(generationJobsTable)
    .values({
      productModelId: model.id,
      status: "PROCESSING",
      provider: "mock",
      attempt: 1,
      maxAttempts: 3,
    })
    .returning();

  try {
    const result = await generateMockModel(product.id);

    const [generated] = await db
      .update(productModelsTable)
      .set({
        status: "REVIEW",
        originalModelUrl: result.originalModelUrl,
        optimizedModelUrl: result.originalModelUrl,
        thumbnailUrl: result.thumbnailUrl,
        fileSizeBytes: result.fileSizeBytes,
        providerTaskId: result.providerTaskId,
        sourceImageCount: product.imageUrls.length,
      })
      .where(eq(productModelsTable.id, model.id))
      .returning();

    await db
      .update(generationJobsTable)
      .set({ status: "GENERATED" })
      .where(eq(generationJobsTable.id, job.id));

    await db.insert(logEntriesTable).values({
      level: "info",
      source: "generation",
      message: `Mock 3D model generated for "${product.title}" and queued for review.`,
    });

    req.log.info({ modelId: model.id }, "Mock generation complete");
    res.json(GenerateModelResponse.parse(generated));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown generation error";

    const [failed] = await db
      .update(productModelsTable)
      .set({ status: "FAILED", errorMessage: message })
      .where(eq(productModelsTable.id, model.id))
      .returning();

    await db
      .update(generationJobsTable)
      .set({ status: "FAILED", lastError: message })
      .where(eq(generationJobsTable.id, job.id));

    await db.insert(logEntriesTable).values({
      level: "error",
      source: "generation",
      message: `Generation failed for "${product.title}": ${message}`,
    });

    req.log.error({ modelId: model.id, err }, "Generation failed");
    res.json(GenerateModelResponse.parse(failed));
  }

  void settings; // reserved for Phase 2 live-generation branch
});

router.post("/models/:id/approve", async (req, res): Promise<void> => {
  const params = ApproveModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = ApproveModelBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [model] = await db
    .select()
    .from(productModelsTable)
    .where(eq(productModelsTable.id, params.data.id));

  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  if (model.status !== "REVIEW") {
    res.status(400).json({ error: `Model is not in review (status: ${model.status})` });
    return;
  }

  const [updated] = await db
    .update(productModelsTable)
    .set({
      status: "APPROVED",
      reviewer: body.data.reviewer,
      reviewedAt: new Date(),
      approvedAt: new Date(),
      rejectionReason: null,
    })
    .where(eq(productModelsTable.id, model.id))
    .returning();

  await db.insert(logEntriesTable).values({
    level: "info",
    source: "review",
    message: `Model ${model.id} approved by ${body.data.reviewer}.`,
  });

  res.json(ApproveModelResponse.parse(updated));
});

router.post("/models/:id/reject", async (req, res): Promise<void> => {
  const params = RejectModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = RejectModelBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [model] = await db
    .select()
    .from(productModelsTable)
    .where(eq(productModelsTable.id, params.data.id));

  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  if (model.status !== "REVIEW") {
    res.status(400).json({ error: `Model is not in review (status: ${model.status})` });
    return;
  }

  const [updated] = await db
    .update(productModelsTable)
    .set({
      status: "FAILED",
      reviewer: body.data.reviewer,
      reviewedAt: new Date(),
      rejectionReason: body.data.reason,
    })
    .where(eq(productModelsTable.id, model.id))
    .returning();

  await db.insert(logEntriesTable).values({
    level: "warn",
    source: "review",
    message: `Model ${model.id} rejected by ${body.data.reviewer}: ${body.data.reason}`,
  });

  res.json(RejectModelResponse.parse(updated));
});

router.post("/models/:id/publish", async (req, res): Promise<void> => {
  const params = PublishModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [model] = await db
    .select()
    .from(productModelsTable)
    .where(eq(productModelsTable.id, params.data.id));

  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  if (model.status !== "APPROVED") {
    res.status(400).json({ error: `Model is not approved (status: ${model.status})` });
    return;
  }

  const [updated] = await db
    .update(productModelsTable)
    .set({
      status: "PUBLISHED",
      publishedAt: new Date(),
      arToken: model.arToken ?? generateArToken(),
    })
    .where(eq(productModelsTable.id, model.id))
    .returning();

  await db.insert(logEntriesTable).values({
    level: "info",
    source: "publish",
    message: `Model ${model.id} published to the storefront.`,
  });

  res.json(PublishModelResponse.parse(updated));
});

router.post("/models/:id/unpublish", async (req, res): Promise<void> => {
  const params = UnpublishModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [model] = await db
    .select()
    .from(productModelsTable)
    .where(eq(productModelsTable.id, params.data.id));

  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  if (model.status !== "PUBLISHED") {
    res.status(400).json({ error: `Model is not published (status: ${model.status})` });
    return;
  }

  const [updated] = await db
    .update(productModelsTable)
    .set({ status: "APPROVED" })
    .where(eq(productModelsTable.id, model.id))
    .returning();

  await db.insert(logEntriesTable).values({
    level: "info",
    source: "publish",
    message: `Model ${model.id} unpublished from the storefront.`,
  });

  res.json(UnpublishModelResponse.parse(updated));
});

export default router;
