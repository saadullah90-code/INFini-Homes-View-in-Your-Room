import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

// One row per generated (or generatable) 3D model for a product, tracking
// its position in the PENDING -> ... -> PUBLISHED pipeline.
export const productModelsTable = pgTable("product_models", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("PENDING"),
  provider: text("provider").notNull().default("mock"),
  providerTaskId: text("provider_task_id"),
  originalModelUrl: text("original_model_url"),
  optimizedModelUrl: text("optimized_model_url"),
  thumbnailUrl: text("thumbnail_url"),
  imageSetHash: text("image_set_hash"),
  fileSizeBytes: integer("file_size_bytes"),
  sourceImageCount: integer("source_image_count").notNull().default(0),
  errorMessage: text("error_message"),
  reviewer: text("reviewer"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  // Signed lookup token for the public /ar/:token route. Only set once a
  // model is published, and cleared again if it is unpublished.
  arToken: text("ar_token").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertProductModelSchema = createInsertSchema(productModelsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProductModel = z.infer<typeof insertProductModelSchema>;
export type ProductModel = typeof productModelsTable.$inferSelect;
