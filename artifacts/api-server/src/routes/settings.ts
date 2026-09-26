import { Router, type IRouter } from "express";
import { UpdateSettingsBody, GetSettingsResponse, UpdateSettingsResponse } from "@workspace/api-zod";
import { getAppSettings, updateAppSettings } from "../lib/settings-service";

const router: IRouter = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await getAppSettings();
  res.json(GetSettingsResponse.parse(settings));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const body = UpdateSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updated = await updateAppSettings(body.data);
  req.log.info({ patch: body.data }, "Updated app settings");
  res.json(UpdateSettingsResponse.parse(updated));
});

export default router;
