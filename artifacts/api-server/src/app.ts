import express, { type Express } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// The public storefront endpoint (mounted under /api/storefront) enforces
// its own, tighter, shop-restricted CORS policy in its route file. It must
// be excluded here, otherwise this app-wide wildcard CORS would run first,
// answer every preflight itself, and leave its permissive
// `Access-Control-Allow-Origin: *` header on every response before the
// storefront route's own restriction ever gets a chance to apply.
app.use((req, res, next) => {
  if (req.path.startsWith("/api/storefront")) {
    next();
    return;
  }
  cors()(req, res, next);
});
app.use(
  express.json({
    // Captures the exact raw bytes alongside the parsed body so Shopify
    // webhook handlers can verify the X-Shopify-Hmac-Sha256 signature
    // against the untouched payload -- a re-serialized JSON body would not
    // match Shopify's signature.
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", router);

// Railway runs the dashboard and API as one service. Replit's separate
// artifact proxy remains unchanged unless this explicit flag is set.
if (process.env.SERVE_FRONTEND === "1") {
  const dashboardDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../admin-dashboard/dist/public",
  );
  app.use(express.static(dashboardDir, { index: false }));
  app.get("/{*page}", (req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/") || path.extname(req.path)) {
      next();
      return;
    }
    res.sendFile(path.join(dashboardDir, "index.html"));
  });
}

export default app;
