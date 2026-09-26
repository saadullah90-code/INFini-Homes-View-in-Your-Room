---
name: Keyword eligibility matching
description: Why substring keyword matching over-matches for category/title classification, and the fix.
---

When classifying products by category/title keywords (e.g. "is this
Furniture or Mattress?"), plain `string.includes(keyword)` over-matches:
"bed" matches inside "Bedding" and "Bedsheet"; "table" matches inside
"Table Lamp". This silently misclassifies unrelated products as eligible.

**Why:** Discovered building a Shopify 3D/AR eligibility pipeline — a
"Bedsheet Set" and a "Table Lamp" were both wrongly marked eligible for
furniture-only 3D generation until fixed.

**How to apply:** Use word-boundary matching (`\bkeyword\b` regex) instead of
`.includes()` for keyword-based classification. Also keep single generic
nouns (like bare "table") out of keyword lists when they commonly appear
inside unrelated compound terms — prefer specific phrases ("dining table",
"coffee table") or rely on the category field being authoritative.
