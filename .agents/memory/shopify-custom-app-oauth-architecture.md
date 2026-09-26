---
name: Shopify custom app OAuth architecture
description: Pattern for a non-embedded custom Shopify app's OAuth flow, webhook callback URLs, and token-at-rest encryption on Replit.
---

For a custom Shopify Partner-dashboard app (not embedded in Shopify Admin,
i.e. no App Bridge UI inside `admin.shopify.com`) that needs read/write
Admin API access to one external store, the standard OAuth 2.0
authorization-code grant is still the correct, currently-supported flow —
Shopify's newer "token exchange"/managed-installation path is for apps
embedded via App Bridge, which a standalone admin-dashboard-style app is not.

**Why:** Confirmed while wiring a 3D/AR product pipeline's admin dashboard
(a separate app, not embedded in Shopify Admin) to Shopify Admin GraphQL —
using the classic redirect-based grant avoided an unnecessary App Bridge
dependency and matched the app's non-embedded architecture.

**How to apply:**
- Build the OAuth callback and webhook callback URLs from the *incoming
  request's host* at install time (`req.get("host")`), not a hardcoded or
  guessed domain, and not a maintained "app URL" env var. This is always
  correct for whatever host actually served the request (dev domain today,
  production domain after publishing) without drift — the tradeoff is that
  webhooks are pinned to the host active at install time, so moving from dev
  to a published production domain requires reinstalling (re-running OAuth)
  to re-register webhooks against the new host.
- Encrypt the Admin API access token at rest (AES-256-GCM) using a key
  derived (via scrypt with a purpose-specific salt) from an *existing*
  session secret rather than requesting a brand-new encryption secret —
  avoids proliferating secrets for something that's really "another use of
  the same trust root."
- Verify OAuth callback HMAC (over sorted query params) and webhook HMAC
  (over the raw, unparsed request body) using the same `SHOPIFY_API_SECRET`
  — capture the raw body via the body-parser's `verify` hook so a
  re-serialized JSON body doesn't break the signature check.
- Scope tightly: `read_products` alone covers product listing, media/images,
  and Shopify's standardized product taxonomy category — no `write_*` scope
  needed for a read-only catalog sync.
