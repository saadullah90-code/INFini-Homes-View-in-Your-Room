import "express";

declare global {
  namespace Express {
    interface Request {
      // Captured by the express.json() `verify` hook in app.ts so Shopify
      // webhook handlers can HMAC-verify the exact raw payload bytes.
      rawBody?: Buffer;
    }
  }
}
