import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Singleton table -- exactly one row (id = 1) holds the app's configuration.
export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  maxConcurrentGenerations: integer("max_concurrent_generations").notNull().default(2),
  showButtonBeforePublish: boolean("show_button_before_publish").notNull().default(false),
  buttonText: text("button_text").notNull().default("View in Your Room"),
  defaultUnit: text("default_unit").notNull().default("cm"),
  // Stays false until the merchant explicitly approves the first live provider generation.
  meshyLiveGenerationEnabled: boolean("meshy_live_generation_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettingsTable.$inferSelect;
