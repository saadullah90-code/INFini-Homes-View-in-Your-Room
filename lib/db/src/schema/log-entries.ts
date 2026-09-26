import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Recent webhook/system events shown on the admin Logs page. This is a
// simple append-only log, not an audit trail with retention guarantees.
export const logEntriesTable = pgTable("log_entries", {
  id: serial("id").primaryKey(),
  level: text("level").notNull().default("info"),
  source: text("source").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLogEntrySchema = createInsertSchema(logEntriesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLogEntry = z.infer<typeof insertLogEntrySchema>;
export type LogEntry = typeof logEntriesTable.$inferSelect;
