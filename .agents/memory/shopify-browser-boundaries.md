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

On iPhone, prefer an explicit, prominent Quick Look action; never promise automatic camera activation or permission bypass.

**Why:** The user confirmed the explicit native AR demo worked, whereas the embedded 3D preview alone was mistaken for the intended room-camera flow.

**How to apply:** Use a real USDZ when available, or disclose conversion limitations when generating USDZ from GLB. A successful sample demo does not verify a different product model or its physical scale.

Keep a generated or procedural product representation explicitly distinguished from an exact product scan; fixed-size previews must disclose that other variants are not represented.

**Why:** The merchant needs their own product rather than unrelated sample assets, but a mattress title and listed dimensions do not establish its exact fabric, geometry, or every size variant.

**How to apply:** Preserve the approximation and modeled-size notice through admin review, storefront, and AR handoff. Agent setup verification is not merchant visual approval.