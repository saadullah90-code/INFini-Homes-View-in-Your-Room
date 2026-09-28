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
7. Backend mein pehle se fetched product ka page kholo. Sirf app mein pehle se maujood products par button dikhega; unknown/sample products par nahin.
8. **"View Product in Your Room & Measure Your Size"** button test karo. Yeh polished teal CTA product photo ya model ke liye hai; bina preview ke button room-fit wording dikhata hai.
9. Desktop par product preview button dabao → QR aur **Enter your dimensions** button saath nazar aayenge. QR phone se scan karo; **Hide QR code** se QR band kar sakte ho.
10. Mobile/iPad par aam fetched products ki Shopify photo ke liye **View in your space (2D photo)** tap karo. White wardrobe aur medical mattress par **sirf published 3D/AR preview** milega; un par 2D photo-camera option nahin hai. Baqi photos ko drag/pinch, **− / +** buttons ya slider se adjust karo. QR scan camera automatically nahin kholta.

Core viewer aur calculator ke liye **ek hi file** paste karni hai — koi doosri JS/CSS file alag se add karne ki zaroorat nahi. White wardrobe camera-image test optional second block hai.

## What you need to know before relying on this

- **All previously fetched products show this block.** The read-only backend lookup returns `fetched` independently of Furniture/Mattress `eligible`; unknown/sample products still show nothing, and visiting a page never registers it. A Shopify photo (or the catalog's valid Shopify CDN image) is needed for the 2D overlay on other fetched products. White wardrobe and medical mattress use their published 3D model and AR button instead, without a 2D photo-camera option—even from an older photo QR link. Models must stay approved and available in the live backend. Other photo previews support drag/pinch, slider and −/+ buttons, but are not true AR. QR opens the mobile preview, never AR or camera automatically.
- **Product sizes need real measurements.** Shopify Size/Dimensions options appear in the calculator. A complete label such as `200 W × 210 L × 20 H cm` automatically supplies product width, depth/length and height; the customer only enters room measurements. The product measurement inputs appear **only for Custom size** (planning, not a purchasable variant). A Shopify label without all three labeled measurements and `cm` cannot calculate a fit: add the real measurements to that Shopify size label instead of guessing. A published 3D reference size remains a separate reference option, not a measurement for other variants. No dimensions come from an image. Wall and floor can be entered independently; back gap defaults to 0 cm.
- **Modeled size is not a selected-variant promise.** The specific generated mattress preview is **200W × 210L × 20H cm only**. It is not verified for other mattress variants, and choosing a different Shopify variant does not resize the 3D model. Where the API supplies `dimensions` (`width`, `height`, `depth`, `unit`) and/or `modelNotice`, the modal displays the modeled preview dimensions and notice; the size disclaimer remains visible even if metadata is missing. Do not use this preview as an exact measurement of a different variant.
- **AR support depends on the actual published GLB and device/browser.** In the 3D preview, pinch zooms the camera. In supported AR modes, pinch resizes the placed model and drag moves it on the floor; this changes only its visual placement/scale, not the listed product dimensions or room-fit calculation. Mobile/iPad shows a tap-to-launch AR button only after the model loads; unsupported browsers show a note instead. On supported iOS, model-viewer may generate Quick Look USDZ from the GLB at tap time; there is no separate verified USDZ asset or guarantee Quick Look works on every device. No automatic camera activation occurs.
- **Replit is currently the backend.** The one line to change later, when moving to Railway, is `VIEW_IN_YOUR_ROOM_API` near the top of the `<script>` block in `view-in-your-room.liquid`. Nothing else in the file needs to change.
- **Publish the backend update before replacing the Shopify block.** The updated `GET /api/storefront/model` returns `fetched`, `eligible`, `available`, and optionally `imageUrl`. Until the published backend supports `fetched`, already-eligible products can still show, but excluded fetched products remain hidden. Then replace the complete Custom Liquid field and save. The snippet never calls `POST /api/storefront/connect`; no Shopify token or Meshy key is included.

## How it works

```
Shopify product page
  → Custom Liquid block (this file)
  → GET {backend}/api/storefront/model?shop=...&product_handle={{ product.handle }}
  → backend checks: product previously fetched? model PUBLISHED? real GLB URL exists?
    → wardrobe/mattress → published 3D model, mobile AR, calculator; no 2D photo
    → fetched:false    → nothing shown
    → fetched:true, available:false → Shopify product image (if present) and separate size calculator
    → available:true   → published <model-viewer> and separate size calculator;
                          mobile photo-camera option only for other products with images
                           → desktop: QR and Enter your dimensions appear together
                         → mobile: opening the page with ?view_ar=1 (e.g. from
                           the QR scan) auto-opens the viewer once availability
                           is confirmed
```

The QR points to the canonical Shopify product page with its selected numeric `variant` parameter. It uses `view_product_image=1` for other products showing photos, `view_ar=1` for published 3D, and `view_dimensions=1` when neither preview exists. Older image QR links for wardrobe/mattress now open their 3D preview instead. QR links never carry secrets and never start AR or camera automatically. The 2D photo button remains available for other fetched products with usable photos.

## White wardrobe camera/image experiment (separate block)

`wardrobe-camera-test.liquid` is an **old optional, isolated 2D visual test** for the white two-door wardrobe. Do not install it; if it is already in the Shopify product template, remove that separate block so no 2D button remains. The main block handles old image QR links by opening 3D instead.

The live Shopify wardrobe product has Color and Assembly variants, **not** Size variants. Its published 3D reference has 80 W × 40 D × 185 H cm dimensions. The calculator is in the original block; it never estimates measurements from this image.

The main block now displays the published white-wardrobe 3D model instead of its old photo preview. A supported mobile browser can launch AR after the model loads. The 3D reference is for the white wardrobe at 80 W × 40 D × 185 H cm; choosing another colour does not alter its geometry.
