# Theme App Extension -- foundation only

This directory is scaffolding for the storefront-facing "View in Your Room"
app block, in the standard Shopify Theme App Extension shape
(`shopify.extension.toml`, `blocks/`, `locales/`, `assets/`).

**Status: not deployed, not registered with Shopify, no effect on the live
store.** It exists so the extension has a home when that work is scheduled.

## What's here
- `shopify.extension.toml` -- extension manifest (type: `theme`)
- `blocks/product-viewer.liquid` -- placeholder app block, renders nothing
- `locales/en.default.json` -- placeholder locale strings

## What's needed before this can ship
1. A Shopify CLI-managed app project (`shopify app init`) that this extension
   is linked into, or the CLI pointed at this monorepo's app config.
2. The actual `<model-viewer>` markup in `product-viewer.liquid`, reading a
   product metafield that points at this app's published `/ar/:token`
   experience.
3. A metafield definition + a way to write it (Admin API `write` scope,
   deliberately not requested yet -- see the Shopify integration report).
4. `shopify app deploy` to publish the extension version, then the merchant
   adding the block to their product page template in the theme editor.

None of this is wired up yet. Building it out is separate, explicit future
work.
