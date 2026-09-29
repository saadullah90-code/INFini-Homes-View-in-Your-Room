---
name: Railway monorepo import
description: Why Railway's automatic pnpm workspace import failed and how to deploy this app with minimal services.
---

Railway's automatic JavaScript monorepo import treated shared libraries and the mockup sandbox as standalone services. Those are not independently runnable; deploy the root workspace as one web service that builds the frontend and backend together.

**Why:** The initial seven auto-created services all failed at frozen installation: Railpack selected pnpm 9 while the workspace lockfile was generated with pnpm 10, reporting an overrides configuration mismatch. Pinning the root package-manager version makes the installer and lockfile agree.

**How to apply:** If Railway is re-imported, avoid its "deploy all workspace packages" option. A successful web deployment also needs PostgreSQL; do not claim the service is fully operational just because its build or HTTP healthcheck passes.

The user chose a separate Railway PostgreSQL database, accepting one web service plus one database service rather than connecting to Replit's database. Preserve the existing production data during the move; an empty database or sample seed is not a valid substitute.

**Why:** The production catalog contains thousands of products and model records, and the user asked for no unrelated change or data loss.

**How to apply:** Import a consistent production snapshot into Railway before switching Shopify traffic. Once the Railway site is verified, update the Shopify Liquid backend URL; the existing published Replit backend remains live until then.

Railway's Postgres template provides a private-network connection URL by default. A URL copied from Railway may still resolve to its internal host, even when named as a public URL.

**Why:** An external migration client could reach the Replit source but could not resolve the Railway private database host. A temporary Railway TCP proxy allowed the import with the existing credentials.

**How to apply:** For outside-to-Railway imports, use the proxy hostname and port with the database URL's existing credentials, without displaying them. Remove the proxy after verifying the import; the web service keeps using the private connection reference.