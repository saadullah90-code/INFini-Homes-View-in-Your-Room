import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, logEntriesTable } from "@workspace/db";
import { ListLogsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/logs", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(logEntriesTable)
    .orderBy(desc(logEntriesTable.createdAt))
    .limit(200);
  res.json(ListLogsResponse.parse(rows));
});

export default router;
