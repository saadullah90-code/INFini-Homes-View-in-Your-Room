---
name: Shopify Custom Liquid size cap
description: Shopify theme-editor Liquid setting limit and the misleading error when a pasted snippet exceeds it.
---

Shopify's theme-editor `liquid` input setting has a 50 KB content limit. Keep a paste-ready single-block snippet comfortably below 50,000 bytes, and replace the old field contents rather than appending a revision.

**Why:** An otherwise parseable oversized snippet was rejected with “This code has errors. Correct the syntax to save your custom Liquid,” shown near the closing script tag. Shopify's official theme limits and input-settings documentation confirm that exceeding 50 KB produces a save error, as can invalid Liquid.

**How to apply:** Check the bytes of the actual file the merchant will paste before delivery. When the editor reports a generic syntax error, inspect size as well as Liquid syntax; do not assume the highlighted last line is the cause. When adding visible UI under this cap, compact existing CSS and nonessential copy before removing accessibility labels, measurement caveats, or working controls. Keep user-facing interactions ahead of optional on-page diagnostics; console warnings can cover basic troubleshooting without consuming the field's limited space.