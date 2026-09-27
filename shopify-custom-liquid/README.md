# INFini Homes — View in Your Room (Custom Liquid)

## Setup (Roman Urdu / English)

1. Shopify Admin kholo.
2. **Online Store → Themes → Customize**.
3. Product template kholo (jis page par product dikhta hai).
4. Wahan **Custom Liquid** section/block add karo (Add block → Custom Liquid).
5. `view-in-your-room.liquid` ka **complete code** copy karke paste karo.
6. **Save** karo.
7. Kisi bhi product ka page kholo. Calculator sab product pages par hai; 3D/AR sirf published models par hai.
8. **"View in Your Room"** button test karo.
9. Desktop par product preview button dabao → QR aur **Enter your dimensions** button saath nazar aayenge. QR phone se scan karo; **Hide QR code** se QR band kar sakte ho.
10. Mobile/iPad par viewer khol kar **View in your space (AR)** tap karo (agar browser/device support karta ho). QR scan sirf product page/viewer kholta hai, camera automatically nahin.

Core viewer aur calculator ke liye **ek hi file** paste karni hai — koi doosri JS/CSS file alag se add karne ki zaroorat nahi. White wardrobe camera-image test optional second block hai.

## What you need to know before relying on this

- **Only a published model can be previewed or handed off to AR.** The backend decides 3D/AR eligibility and availability. The main preview and independent **Enter your dimensions** calculator appear on every product using the product template that contains this Custom Liquid block. The white wardrobe shows its first Shopify PNG instead of a 3D model; other products show their published 3D model, or their first product image if no model is published. An image QR opens the image on a phone, never the calculator.
- **Product sizes need real measurements.** If Shopify has a Size/Dimensions option, its values appear in the calculator's picker. The name alone does not supply width/depth/height, so customers enter those values unless the API offers a published reference model with a clearly labeled reference size. Custom sizes are planning estimates, not purchasable variants. No dimensions come from an image. Wall width/height and floor width/depth can be entered independently; the gap behind furniture must be supplied separately (default 0 cm).
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
    → wardrobe         → first Shopify PNG in preview and separate size calculator
    → available:false  → first Shopify product image (if present) and separate size calculator
    → available:true   → published <model-viewer> (other products) and separate size calculator
                           → desktop: QR and Enter your dimensions appear together
                         → mobile: opening the page with ?view_ar=1 (e.g. from
                           the QR scan) auto-opens the viewer once availability
                           is confirmed
```

The QR points to the canonical Shopify product page with the selected numeric `variant` query parameter (from the page URL or Shopify product form, if available). It uses `view_product_image=1` when the preview shows an image, `view_ar=1` when it shows a published 3D model, and `view_dimensions=1` only when neither image nor model exists. Previous `view_dimensions=1` QR links also open the product image if one exists, not the calculator. It never carries a token or secret; debug and unrelated URL parameters are excluded. Scanning opens the image immediately, but never starts AR or a camera automatically. On a phone, **Start camera (2D image overlay)** is available for the wardrobe PNG after a separate tap; drag/visual image size are not measured AR.

## White wardrobe camera/image experiment (separate block)

`wardrobe-camera-test.liquid` is an **optional, isolated visual test** for the white two-door wardrobe product only. The updated main `view-in-your-room.liquid` block handles the new `view_product_image=1` image QR **without** this second block. The second test block now opens only by its own separate button. All products get the calculator from the main block.

The live Shopify wardrobe product has Color and Assembly variants, **not** Size variants. Its published 3D reference has 80 W × 40 D × 185 H cm dimensions. The calculator is in the original block; it never estimates measurements from this image.

The main preview shows the uploaded transparent white-wardrobe front PNG immediately. On mobile, the **Start camera** button lets the customer overlay it on a live camera after a tap. Drag the image or use the **visual-only** image-size slider; closing the preview stops the camera. Camera access requires a supported browser, HTTPS, and the shopper's permission. This is a **2D visual experiment** without floor tracking, real-world scale, or 3D/AR placement; it is always the white image even when another colour is selected. The separate second test block is not required for this flow.
