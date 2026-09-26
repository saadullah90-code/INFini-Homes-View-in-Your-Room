---
name: Gating paid AI generation behind a persisted setting
description: Pattern for preventing accidental spend when a paid provider (e.g. Meshy, generation APIs) is optionally live.
---

When a feature can call either a free mock provider or a paid live provider
(e.g. Meshy 3D generation, image/video generation APIs), gate the live path
behind a persisted database setting (e.g. `liveGenerationEnabled: boolean`,
default false) rather than just checking whether an API key/secret exists.

**Why:** If gating only checks "does the API key exist", adding the key for
an unrelated reason (or it being present from a template) can silently
enable real spend. A separate, explicit, persisted flag means an admin must
take a deliberate action to flip it, independent of key presence.

**How to apply:** Store the flag in the app's settings table/row, default
false. Compute "mode" (mock/live/unavailable) as a function of both the flag
and key presence, and surface both honestly on a status endpoint. Never let
a generic `PATCH /settings`-style endpoint flip this flag as a side effect —
require a distinct, explicit action (and ideally an explicit confirmation
phrase from the user) before enabling it.
