import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per Shopify store that has installed this app via OAuth. Holds
// only what's needed to call the Admin API on the merchant's behalf --
// never product data itself (that lives in `products`, synced read-only).
//
// The access token is stored encrypted (AES-256-GCM, key derived from
// SESSION_SECRET) -- never in plaintext, and never sent to the client.
export const shopifyShopsTable = pgTable("shopify_shops", {
  id: serial("id").primaryKey(),
  // e.g. "infinihomes.myshopify.com" -- always the *.myshopify.com domain,
  // never the custom storefront domain, since that's what the Admin API key.
  shopDomain: text("shop_domain").notNull().unique(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  scope: text("scope").notNull(),
  installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
  uninstalledAt: timestamp("uninstalled_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertShopifyShopSchema = createInsertSchema(shopifyShopsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertShopifyShop = z.infer<typeof insertShopifyShopSchema>;
export type ShopifyShop = typeof shopifyShopsTable.$inferSelect;
