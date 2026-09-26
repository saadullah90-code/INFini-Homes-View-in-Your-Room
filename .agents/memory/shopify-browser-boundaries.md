---
name: Shopify browser boundaries
description: Live Liquid URL formats and browser-only integration failure modes
---
Validate Shopify integration using a browser cross-origin request, not only direct API calls. Shopify may render images as protocol-relative storefront-hosted `/cdn/shop/files/` URLs even though its public catalog returns canonical `cdn.shopify.com` URLs.

**Why:** Direct API tests previously passed while real Liquid registration failed on both image validation and missing OPTIONS preflight handling. Publishing alone did not resolve these failures.

**How to apply:** Compare real Shopify-rendered attributes with endpoint validation. Test the browser preflight and normalize only verified merchant image paths. Treat public-catalog imports separately from evidence that Liquid actually connected; disclose browser fixtures as fixtures, not live-theme verification.

Customer-facing QR handoffs must target a verified public deployment or Shopify product URL, not the preview's current origin.

**Why:** A QR generated in the workspace from location.origin led shoppers to a Replit login page despite the published app being public.

**How to apply:** Verify the deployment URL and visibility before choosing the QR target. Test the destination without account cookies; preview-origin reachability does not establish anonymous customer access.