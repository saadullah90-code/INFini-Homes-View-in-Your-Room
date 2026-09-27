# INFini Homes — View in Your Room (Custom Liquid)

## Setup (Roman Urdu / English)

1. Shopify Admin kholo.
2. **Online Store → Themes → Customize**.
3. Product template kholo (jis page par product dikhta hai).
4. Wahan **Custom Liquid** section/block add karo (Add block → Custom Liquid).
5. `view-in-your-room.liquid` ka **complete code** copy karke paste karo.
6. **Save** karo.
   - Purana code **poora select karke replace** karo; naya code us ke neeche append na karo.
   - Shopify ek Custom Liquid field mein maximum **50 KB** accept karta hai. Paste-ready main file is limit se neeche rakhi gayi hai; agar purana aur naya code ikattha paste ho to editor "This code has errors" dikha sakta hai.
7. Backend mein pehle se fetched eligible furniture ya mattress ka page kholo. Doosre products par button aur calculator nahin dikhenge.
8. **"View in Your Room"** button test karo.
9. Desktop par product preview button dabao → QR aur **Enter your dimensions** button saath nazar aayenge. QR phone se scan karo; **Hide QR code** se QR band kar sakte ho.
10. Mobile/iPad par published 3D model ke liye **View in your space (AR)** tap karo. Photo-preview walay eligible furniture aur mattress ke liye **View in your space (2D photo)** alag full-screen camera overlay kholta hai; **Back to preview** se wapas aao. QR scan camera automatically nahin kholta.

Core viewer aur calculator ke liye **ek hi file** paste karni hai — koi doosri JS/CSS file alag se add karne ki zaroorat nahi. White wardrobe camera-image test optional second block hai.

## What you need to know before relying on this

- **Only previously fetched eligible products show this block.** The read-only backend lookup decides whether a product already exists and is eligible Furniture/Mattress. Unknown or ineligible products show no button or calculator; visiting their page does not register them. A published model is required for real 3D/AR. The white wardrobe shows its first Shopify PNG instead of a 3D model; other eligible products show their published 3D model, or their first product image if no model is published. All image previews have a visual-only resize slider and support drag and two-finger pinch; on phones, the separate 2D camera overlay is available for any image preview. Opaque product photos retain their background, so this is not true AR placement. An image QR opens the image on a phone, never the calculator.
- **Product sizes need real measurements.** If Shopify has a Size/Dimensions option, its values appear in the calculator's picker. The name alone does not supply width/depth/height, so customers enter those values unless the API offers a published reference model with a clearly labeled reference size. Custom sizes are planning estimates, not purchasable variants. No dimensions come from an image. Wall width/height and floor width/depth can be entered independently; the gap behind furniture must be supplied separately (default 0 cm).
- **Modeled size is not a selected-variant promise.** The specific generated mattress preview is **200W × 210L × 20H cm only**. It is not verified for other mattress variants, and choosing a different Shopify variant does not resize the 3D model. Where the API supplies `dimensions` (`width`, `height`, `depth`, `unit`) and/or `modelNotice`, the modal displays the modeled preview dimensions and notice; the size disclaimer remains visible even if metadata is missing. Do not use this preview as an exact measurement of a different variant.
- **AR support depends on the actual published GLB and device/browser.** Mobile/iPad shows a direct tap-to-launch AR button only after the model loads; unsupported browsers show a note instead. On supported iOS, model-viewer may generate Quick Look USDZ from the GLB at tap time; there is no separate verified USDZ asset or guarantee Quick Look works on every device. No automatic camera activation occurs.
- **Replit is currently the backend.** The one line to change later, when moving to Railway, is `VIEW_IN_YOUR_ROOM_API` near the top of the `<script>` block in `view-in-your-room.liquid`. Nothing else in the file needs to change.
- **Publish the backend update before replacing the Shopify block.** The updated `GET /api/storefront/model` now returns `eligible` as well as `available`. Until the deployed backend supports that field, the button stays hidden rather than appearing on unverified products. The snippet no longer calls `POST /api/storefront/connect`. No Shopify token or Meshy key is included.

## How it works

```
Shopify product page
  → Custom Liquid block (this file)
  → GET {backend}/api/storefront/model?shop=...&product_handle={{ product.handle }}
  → backend checks: product eligible? model PUBLISHED? real GLB URL exists?
    → wardrobe         → first Shopify PNG in preview and separate size calculator
    → eligible:false   → nothing shown
    → eligible:true, available:false → first Shopify product image (if present) and separate size calculator
    → available:true   → published <model-viewer> (other products) and separate size calculator
                           → desktop: QR and Enter your dimensions appear together
                         → mobile: opening the page with ?view_ar=1 (e.g. from
                           the QR scan) auto-opens the viewer once availability
                           is confirmed
```

The QR points to the canonical Shopify product page with the selected numeric `variant` query parameter (from the page URL or Shopify product form, if available). It uses `view_product_image=1` when the preview shows an image, `view_ar=1` when it shows a published 3D model, and `view_dimensions=1` only when neither image nor model exists. Previous `view_dimensions=1` QR links also open the product image if one exists, not the calculator. It never carries a token or secret; debug and unrelated URL parameters are excluded. Scanning opens the image immediately, but never starts AR or a camera automatically. On a phone, **Start camera (2D image overlay)** is available for the wardrobe PNG after a separate tap; drag/visual image size are not measured AR.

## White wardrobe camera/image experiment (separate block)

`wardrobe-camera-test.liquid` is an **optional, isolated visual test** for the white two-door wardrobe product only. The updated main `view-in-your-room.liquid` block handles the `view_product_image=1` image QR **without** this second block. The second test block opens only by its own separate button. Only previously fetched eligible Furniture/Mattress products get the calculator from the main block.

The live Shopify wardrobe product has Color and Assembly variants, **not** Size variants. Its published 3D reference has 80 W × 40 D × 185 H cm dimensions. The calculator is in the original block; it never estimates measurements from this image.

The main preview shows the uploaded transparent white-wardrobe front PNG immediately. On mobile, **View in your space (2D photo)** opens a separate full-screen camera view after a tap; **Back to preview** stops the camera and returns to the product preview. Drag, pinch, or use the **visual-only** image-size slider; closing the preview also stops the camera. Camera access requires a supported browser, HTTPS, and the shopper's permission. This is a **2D visual experiment** without floor tracking, real-world scale, or 3D/AR placement; it is always the white image even when another colour is selected. The separate second test block is not required for this flow.
