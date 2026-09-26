import { db, productsTable, productModelsTable, appSettingsTable, logEntriesTable } from "@workspace/db";
import { isEligibleProduct } from "./eligibility";
import { logger } from "./logger";

// Seed data purely for local development/demo. All rows are explicitly
// marked source: "sample" so the admin UI never confuses them with a real
// Shopify sync -- this project must never fabricate a live-store connection.
const SAMPLE_PRODUCTS = [
  {
    title: "Haven Sectional Sofa",
    handle: "haven-sectional-sofa",
    category: "Furniture > Living Room > Sofas",
    primaryImageUrl:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800",
    imageUrls: [
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800",
    ],
    variantCount: 4,
    dimensionsWidth: 220,
    dimensionsHeight: 85,
    dimensionsDepth: 95,
    dimensionsUnit: "cm",
  },
  {
    title: "Nimbus Memory Foam Mattress - Queen",
    handle: "nimbus-memory-foam-mattress-queen",
    category: "Mattresses",
    primaryImageUrl:
      "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800",
    imageUrls: [
      "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800",
    ],
    variantCount: 3,
    dimensionsWidth: 152,
    dimensionsHeight: 25,
    dimensionsDepth: 203,
    dimensionsUnit: "cm",
  },
  {
    title: "Oakline Dining Table",
    handle: "oakline-dining-table",
    category: "Furniture > Dining > Tables",
    primaryImageUrl:
      "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800",
    imageUrls: [
      "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800",
    ],
    variantCount: 2,
    dimensionsWidth: 180,
    dimensionsHeight: 76,
    dimensionsDepth: 90,
    dimensionsUnit: "cm",
  },
  {
    title: "Aria Cotton Bedsheet Set",
    handle: "aria-cotton-bedsheet-set",
    category: "Bedding > Sheets",
    primaryImageUrl:
      "https://images.unsplash.com/photo-1522771930-78848d9293e8?w=800",
    imageUrls: [
      "https://images.unsplash.com/photo-1522771930-78848d9293e8?w=800",
    ],
    variantCount: 6,
    dimensionsWidth: null,
    dimensionsHeight: null,
    dimensionsDepth: null,
    dimensionsUnit: null,
  },
  {
    title: "Copper Table Lamp",
    handle: "copper-table-lamp",
    category: "Lighting > Table Lamps",
    primaryImageUrl:
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800",
    imageUrls: [
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800",
    ],
    variantCount: 2,
    dimensionsWidth: null,
    dimensionsHeight: null,
    dimensionsDepth: null,
    dimensionsUnit: null,
  },
];

export async function seedIfEmpty(): Promise<void> {
  const existing = await db.select().from(productsTable).limit(1);
  if (existing.length > 0) {
    logger.info("Seed skipped -- products table already has data.");
    return;
  }

  await db
    .insert(appSettingsTable)
    .values({ id: 1 })
    .onConflictDoNothing();

  for (const sample of SAMPLE_PRODUCTS) {
    const { eligible, reason } = isEligibleProduct(sample.category, sample.title);

    const [product] = await db
      .insert(productsTable)
      .values({
        title: sample.title,
        handle: sample.handle,
        category: sample.category,
        eligible,
        eligibilityReason: reason,
        primaryImageUrl: sample.primaryImageUrl,
        imageUrls: sample.imageUrls,
        variantCount: sample.variantCount,
        dimensionsWidth: sample.dimensionsWidth,
        dimensionsHeight: sample.dimensionsHeight,
        dimensionsDepth: sample.dimensionsDepth,
        dimensionsUnit: sample.dimensionsUnit,
        source: "sample",
      })
      .returning();

    if (eligible) {
      await db.insert(productModelsTable).values({
        productId: product.id,
        status: "ELIGIBLE",
        provider: "mock",
        sourceImageCount: sample.imageUrls.length,
      });
    }
  }

  await db.insert(logEntriesTable).values({
    level: "info",
    source: "seed",
    message: "Seeded sample product catalog for local development.",
  });

  logger.info("Seeded sample products.");
}
