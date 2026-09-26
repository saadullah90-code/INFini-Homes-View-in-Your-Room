import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productModelsTable } from "./product-models";

// Queue of generation attempts against a 3D provider (mock or Meshy).
export const generationJobsTable = pgTable("generation_jobs", {
  id: serial("id").primaryKey(),
  productModelId: integer("product_model_id")
    .notNull()
    .references(() => productModelsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("PENDING"),
  provider: text("provider").notNull().default("mock"),
  attempt: integer("attempt").notNull().default(1),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertGenerationJobSchema = createInsertSchema(generationJobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGenerationJob = z.infer<typeof insertGenerationJobSchema>;
export type GenerationJob = typeof generationJobsTable.$inferSelect;
