# INFini Homes — View in Your Room (Custom Liquid)

## Setup (Roman Urdu / English)

1. Shopify Admin kholo.
2. **Online Store → Themes → Customize**.
3. Product template kholo (jis page par product dikhta hai).
4. Wahan **Custom Liquid** section/block add karo (Add block → Custom Liquid).
5. `view-in-your-room.liquid` ka **complete code** copy karke paste karo.
6. **Save** karo.
7. Ek eligible product open karo (Furniture ya Mattress category wala).
8. **"View in Your Room"** button test karo.
9. Desktop par **View in Your Room** dabao → viewer khulay → **Show QR code** dabao → phone se scan karo. **Hide QR code** se band karo; modal close/reopen par QR reset hota hai.
10. Mobile/iPad par viewer khol kar **View in your space (AR)** tap karo (agar browser/device support karta ho). QR scan sirf product page/viewer kholta hai, camera automatically nahin.

Sirf **ek hi file** paste karni hai — koi doosri JS/CSS file alag se add karne ki zaroorat nahi.

## What you need to know before relying on this

- **Only a published model can be previewed or handed off to AR.** The backend decides eligibility and availability. An eligible product may display the button before its model is published; the modal then clearly says it is unavailable and offers **Retry**. A failed availability check also offers Retry. Neither case creates a pretend model or QR code.
- **Modeled size is not a selected-variant promise.** The specific generated mattress preview is **200W × 210L × 20H cm only**. It is not verified for other mattress variants, and choosing a different Shopify variant does not resize the 3D model. Where the API supplies `dimensions` (`width`, `height`, `depth`, `unit`) and/or `modelNotice`, the modal displays the modeled preview dimensions and notice; the size disclaimer remains visible even if metadata is missing. Do not use this preview as an exact measurement of a different variant.
- **AR support depends on the actual published GLB and device/browser.** Mobile/iPad shows a direct tap-to-launch AR button only after the model loads; unsupported browsers show a note instead. On supported iOS, model-viewer may generate Quick Look USDZ from the GLB at tap time; there is no separate verified USDZ asset or guarantee Quick Look works on every device. No automatic camera activation occurs.
- **Replit is currently the backend.** The one line to change later, when moving to Railway, is `VIEW_IN_YOUR_ROOM_API` near the top of the `<script>` block in `view-in-your-room.liquid`. Nothing else in the file needs to change.
- **No secrets are in this file.** It calls the public storefront model availability endpoint (`GET /api/storefront/model`) and product connection endpoint (`POST /api/storefront/connect`) using public product details. No Shopify token or Meshy key is included.

## How it works

```
Shopify product page
  → Custom Liquid block (this file)
  → GET {backend}/api/storefront/model?shop=...&product_handle={{ product.handle }}
  → backend checks: product eligible? model PUBLISHED? real GLB URL exists?
   → eligible, available:false → button may show an unavailable/retry state
   → available:true   → button shows → click opens a modal with <model-viewer>
                          → desktop: Show QR code reveals handoff QR on request
                         → mobile: opening the page with ?view_ar=1 (e.g. from
                           the QR scan) auto-opens the viewer once availability
                           is confirmed
```

The QR points to the canonical Shopify product page with `view_ar=1` and the selected numeric `variant` query parameter (from the page URL or Shopify product form, if available). It never carries a token or secret; debug and unrelated URL parameters are excluded. Scanning opens the viewer, **not** AR automatically.
