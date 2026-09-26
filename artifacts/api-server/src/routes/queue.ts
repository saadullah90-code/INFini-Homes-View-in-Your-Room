import { Router, type IRouter } from "express";
import { db, generationJobsTable } from "@workspace/db";
import { ListQueueJobsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/queue", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(generationJobsTable)
    .orderBy(generationJobsTable.createdAt);
  res.json(ListQueueJobsResponse.parse(rows));
});

export default router;
