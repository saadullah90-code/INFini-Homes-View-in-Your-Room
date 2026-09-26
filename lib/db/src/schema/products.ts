import { boolean, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Products considered by the eligibility pipeline. Only Furniture/Mattress
// categories are eligible for 3D/AR generation -- everything else is stored
// here too so the admin can see *why* it was excluded.
export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  // Null until a real Shopify sync populates this row.
  shopifyProductId: text("shopify_product_id"),
  title: text("title").notNull(),
  handle: text("handle").notNull(),
  category: text("category").notNull(),
  eligible: boolean("eligible").notNull().default(false),
  eligibilityReason: text("eligibility_reason").notNull(),
  primaryImageUrl: text("primary_image_url"),
  imageUrls: text("image_urls").array().notNull().default([]),
  variantCount: integer("variant_count").notNull().default(0),
  // Real-world dimensions used for AR scale, absent until an admin calibrates them.
  dimensionsWidth: numeric("dimensions_width", { mode: "number" }),
  dimensionsHeight: numeric("dimensions_height", { mode: "number" }),
  dimensionsDepth: numeric("dimensions_depth", { mode: "number" }),
  dimensionsUnit: text("dimensions_unit"),
  // 'sample' rows are seeded demo data; 'shopify' rows come from a live store sync.
  source: text("source").notNull().default("sample"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
