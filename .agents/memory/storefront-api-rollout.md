---
name: Storefront API rollout
description: Why Shopify Liquid changes need both a published backend and a separately replaced theme block.
---

The merchant's Custom Liquid snippet and the published Replit API do not update together. When the snippet depends on a new response field, retain a safe fallback for the older published response where possible, and state which new behavior still requires publishing first.

**Why:** Local code and the development endpoint may be correct while the live Shopify page still calls an older published API and runs an older pasted snippet. A new-only response contract can hide previously working buttons during rollout.

**How to apply:** Verify the live API response shape before delivery. Stage compatible snippet behavior for old responses, suggest publishing the backend, and explain that the merchant must replace the complete Custom Liquid block after the live API supports the new contract. Never claim local validation has changed the live store.