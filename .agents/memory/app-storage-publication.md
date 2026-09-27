---
name: App Storage publication
description: Prepared model availability across development and published storefront
---
When an existing published app gains App Storage configuration, verify the asset through both development and production URLs; development success does not mean the currently running published build has the new storage configuration.

**Why:** A prepared GLB was uploaded and verified in development, but the published server continued reporting missing public object search paths and returning an error until a new publish could pick up the configuration. A registry entry alone did not assign or publish the model in the production database.

**How to apply:** Publish the configuration change through the normal user-controlled flow, verify the published asset endpoint, then use the existing model review and publish path instead of bypassing its human approval gate.