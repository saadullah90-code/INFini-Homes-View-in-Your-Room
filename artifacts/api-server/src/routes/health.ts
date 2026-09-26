import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Landing route for the app's configured Application URL (Shopify Dev
// Dashboard requires this to resolve to something other than a 404/hang).
// Deliberately returns only a static, non-sensitive payload -- no env vars,
// tokens, or credentials.
router.get("/", (_req, res) => {
  res.json({ ok: true, service: "INFini Homes View in Your Room" });
});

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
