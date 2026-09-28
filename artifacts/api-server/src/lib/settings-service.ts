import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SETTINGS_ROW_ID = 1;

/**
 * Returns the singleton app settings row, creating it with safe defaults
 * (meshyLiveGenerationEnabled: false) if it doesn't exist yet.
 */
export async function getAppSettings() {
  const [existing] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, SETTINGS_ROW_ID));

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(appSettingsTable)
    .values({ id: SETTINGS_ROW_ID })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  const [row] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, SETTINGS_ROW_ID));
  return row;
}

export async function isStorefrontActive() {
  const settings = await getAppSettings();
  return settings.storefrontEnabled && settings.storefrontExpiresAt.getTime() > Date.now();
}

export async function updateAppSettings(
  patch: Partial<{
    maxConcurrentGenerations: number;
    showButtonBeforePublish: boolean;
    buttonText: string;
    defaultUnit: string;
  }>,
) {
  await getAppSettings();
  const [updated] = await db
    .update(appSettingsTable)
    .set(patch)
    .where(eq(appSettingsTable.id, SETTINGS_ROW_ID))
    .returning();
  return updated;
}
