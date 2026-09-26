# INFini Homes — View in Your Room (Custom Liquid)

## Setup (Roman Urdu / English)

1. Shopify Admin kholo.
2. **Online Store → Themes → Customize**.
3. Product template kholo (jis page par product dikhta hai).
4. Wahan **Custom Liquid** section/block add karo (Add block → Custom Liquid).
5. `view-in-your-room.liquid` ka **complete code** copy karke paste karo.
6. **Save** karo.
7. Ek eligible product open karo (Furniture ya Mattress category wala, jiska model backend par PUBLISHED ho).
8. **"View in Your Room"** button test karo.
9. Desktop par QR code test karo (button dabao → modal khulay → QR scan karo).
10. Mobile par test karo (button se seedha 3D/AR khulay).

Sirf **ek hi file** paste karni hai — koi doosri JS/CSS file alag se add karne ki zaroorat nahi.

## What you need to know before relying on this

- **Real Meshy generation is not enabled yet.** Every model in the system right now is a mock sample asset used to test the review/approve/publish pipeline — no real Meshy credits have been spent, and none will be until you give the exact explicit approval phrase the project requires.
- **A published model is required for the button to appear.** If a product has no model, or its model hasn't been approved and published in the admin dashboard, the "View in Your Room" button simply does not render on that product page. The Replit backend is the single source of truth for this — the Liquid code never guesses.
- **USDZ / iOS "Quick Look" AR is not considered complete.** There is currently no real USDZ generation pipeline. On iPhone/iPad, the 3D viewer still works (rotate/zoom), but the AR button is intentionally hidden with a plain note ("AR view for iPhone/iPad isn't available for this product yet.") instead of pointing at a fake or broken asset. Android AR (WebXR / Google Scene Viewer) uses the real GLB and does work today, where the device supports it.
- **Replit is currently the backend.** The one line to change later, when moving to Railway, is `VIEW_IN_YOUR_ROOM_API` near the top of the `<script>` block in `view-in-your-room.liquid`. Nothing else in the file needs to change.
- **No secrets are in this file.** It only ever calls one public, read-only endpoint (`GET /api/storefront/model`) that is restricted to `infinihomes.shop` / `www.infinihomes.shop` and returns nothing beyond a title, a model URL, a thumbnail, and an AR link — no Shopify token, no Meshy key, no database ID.

## How it works

```
Shopify product page
  → Custom Liquid block (this file)
  → GET {backend}/api/storefront/model?shop=...&product_handle={{ product.handle }}
  → backend checks: product eligible? model PUBLISHED? real GLB URL exists?
  → available:false  → button stays hidden, nothing else happens
  → available:true   → button shows → click opens a modal with <model-viewer>
                         → desktop: also shows a QR code to the same product
                           page with ?view_ar=1, for a mobile handoff
                         → mobile: opening the page with ?view_ar=1 (e.g. from
                           the QR scan) auto-opens the viewer once availability
                           is confirmed
```

The QR code and the `?view_ar=1` parameter never carry any token or secret — they just point back at the normal, public Shopify product URL.
