import { Router, type IRouter } from "express";
import { GetApiStatusResponse } from "@workspace/api-zod";
import { getApiStatus } from "../lib/status-service";
import { getAppSettings } from "../lib/settings-service";

const router: IRouter = Router();

router.get("/status", async (_req, res): Promise<void> => {
  const settings = await getAppSettings();
  const status = await getApiStatus(settings.meshyLiveGenerationEnabled);
  res.json(GetApiStatusResponse.parse(status));
});

export default router;
