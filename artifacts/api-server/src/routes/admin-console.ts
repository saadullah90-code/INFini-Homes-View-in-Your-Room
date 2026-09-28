import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";
import {
  LoginAdminConsoleBody,
  UpdateAdminConsoleLicenseBody,
  GetAdminConsoleLicenseResponse,
} from "@workspace/api-zod";
import { getAppSettings } from "../lib/settings-service";

const router: IRouter = Router();
const COOKIE = "ih_admin_console";
const MAX_AGE_MS = 8 * 60 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

router.use("/admin-console", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

function configured() {
  return Boolean(process.env.ADMIN_CONSOLE_PASSWORD && process.env.SESSION_SECRET);
}

function signature(timestamp: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET + ":" + process.env.ADMIN_CONSOLE_PASSWORD)
    .update(timestamp).digest("base64url");
}

function validSession(cookie: unknown): boolean {
  if (!configured() || typeof cookie !== "string") return false;
  const match = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(cookie);
  if (!match) return false;
  const age = Date.now() - Number(match[1]);
  if (age < 0 || age > MAX_AGE_MS) return false;
  const received = Buffer.from(match[2]);
  const expected = Buffer.from(signature(match[1]));
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function sameOrigin(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.get("host");
  } catch {
    return false;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!configured()) {
    res.status(503).json({ error: "Admin password has not been configured." });
    return;
  }
  if (!validSession(req.cookies?.[COOKIE])) {
    res.status(401).json({ error: "Admin login required." });
    return;
  }
  next();
}

function licenseResponse(settings: Awaited<ReturnType<typeof getAppSettings>>) {
  return GetAdminConsoleLicenseResponse.parse({
    enabled: settings.storefrontEnabled,
    expiresAt: settings.storefrontExpiresAt,
    active: settings.storefrontEnabled && settings.storefrontExpiresAt.getTime() > Date.now(),
  });
}

router.post("/admin-console/login", (req, res): void => {
  if (!configured()) {
    res.status(503).json({ error: "Set ADMIN_CONSOLE_PASSWORD in Replit Secrets first." });
    return;
  }
  if (!sameOrigin(req)) {
    res.status(403).json({ error: "Invalid request origin." });
    return;
  }
  const body = LoginAdminConsoleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Enter the admin password." });
    return;
  }
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const failure = attempts.get(key);
  if (failure && failure.resetAt > now && failure.count >= 5) {
    res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
    return;
  }
  const entered = createHash("sha256").update(body.data.password).digest();
  const stored = createHash("sha256").update(process.env.ADMIN_CONSOLE_PASSWORD!).digest();
  if (!timingSafeEqual(entered, stored)) {
    attempts.set(key, failure && failure.resetAt > now
      ? { count: failure.count + 1, resetAt: failure.resetAt }
      : { count: 1, resetAt: now + 15 * 60_000 });
    if (attempts.size > 500) attempts.delete(attempts.keys().next().value!);
    res.status(401).json({ error: "Incorrect password." });
    return;
  }
  attempts.delete(key);
  const timestamp = String(now);
  res.cookie(COOKIE, timestamp + "." + signature(timestamp), {
    httpOnly: true,
    sameSite: "strict",
    secure: req.secure || req.get("x-forwarded-proto") === "https",
    path: "/api/admin-console",
    maxAge: MAX_AGE_MS,
  });
  res.json({ ok: true });
});

router.post("/admin-console/logout", (req, res): void => {
  if (!sameOrigin(req)) {
    res.status(403).json({ error: "Invalid request origin." });
    return;
  }
  res.clearCookie(COOKIE, { path: "/api/admin-console" });
  res.status(204).end();
});

router.get("/admin-console/license", requireAdmin, async (_req, res): Promise<void> => {
  res.json(licenseResponse(await getAppSettings()));
});

router.patch("/admin-console/license", requireAdmin, async (req, res): Promise<void> => {
  if (!sameOrigin(req)) {
    res.status(403).json({ error: "Invalid request origin." });
    return;
  }
  const rawDate = req.body?.expiresOn;
  if (typeof rawDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate) ||
      !Number.isFinite(Date.parse(rawDate + "T00:00:00Z")) ||
      new Date(rawDate + "T00:00:00Z").toISOString().slice(0, 10) !== rawDate) {
    res.status(400).json({ error: "Enter a valid renewal date (YYYY-MM-DD)." });
    return;
  }
  const body = UpdateAdminConsoleLicenseBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Choose an on/off state and renewal date." });
    return;
  }
  await getAppSettings();
  const [updated] = await db.update(appSettingsTable).set({
    storefrontEnabled: body.data.enabled,
    storefrontExpiresAt: new Date(rawDate + "T23:59:59.999+05:00"),
  }).where(eq(appSettingsTable.id, 1)).returning();
  req.log.info({ enabled: updated.storefrontEnabled, expiresAt: updated.storefrontExpiresAt }, "Storefront access updated");
  res.json(licenseResponse(updated));
});

export default router;