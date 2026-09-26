---
name: Shopify custom app vs Replit connector
description: When Replit's built-in Shopify connector is the wrong fit for a Shopify integration task.
---

Replit's built-in Shopify connector (`shopify-store`) is designed for
Storefront-API buyer-facing storefronts on Repl-owned/claimed stores. It is
not the right fit for a custom installable Shopify app that needs OAuth,
Admin API access, webhooks, or Theme App Extensions on an existing external
production store the user already runs.

**Why:** Found while building a 3D/AR product-viewer Shopify app for an
existing external store — the connector couldn't provide Admin API/OAuth
access needed for product sync and app installation.

**How to apply:** For custom Shopify apps on an existing external store,
tell the user they need credentials from a self-created Shopify Partner
custom app (`SHOPIFY_API_KEY`/`SHOPIFY_API_SECRET`), stored as secrets — not
the Replit Shopify connector. Read the `shopify` skill for the buyer-storefront
case where the connector *is* appropriate.
