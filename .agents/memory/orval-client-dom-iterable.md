---
name: Orval client dom.iterable
description: Fix for a typecheck failure in Orval-generated API client code that calls Headers.entries().
---

Orval-generated fetch-based API clients (`lib/api-client-react` style packages) call
`Headers.entries()`, which requires the `dom.iterable` TypeScript lib. If a
package's `tsconfig.json` only lists `"lib": ["dom", "es2022"]`, typecheck
fails on the generated code even though nothing about the current API spec
is wrong.

**Why:** This is a project-scaffold gap, not something tied to any specific
OpenAPI spec — it will resurface any time Orval (re)generates a client into a
package missing this lib entry.

**How to apply:** If `pnpm run typecheck:libs` or a client package's
typecheck fails with missing `Headers.entries()`/iterator errors after
running Orval codegen, add `"dom.iterable"` to that package's `tsconfig.json`
`lib` array.
