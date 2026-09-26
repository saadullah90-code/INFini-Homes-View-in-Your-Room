// Eligibility rules for the 3D/AR generation pipeline.
//
// Per the project spec, ONLY Furniture and Mattress products are eligible.
// This must stay a pure, deterministic function so `recheck-eligibility`
// always reflects the current rules, not a cached decision.

const ELIGIBLE_CATEGORY_KEYWORDS = [
  "furniture",
  "mattress",
  "mattresses",
  "sofa",
  "couch",
  "chair",
  "dining table",
  "coffee table",
  "side table",
  "end table",
  "console table",
  "bed",
  "bedframe",
  "bed frame",
  "wardrobe",
  "dresser",
  "cabinet",
  "bookshelf",
  "bookcase",
  "ottoman",
  "recliner",
  "nightstand",
  "desk",
  "bench",
  "stool",
];

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
}

// Whole-word/phrase matching -- a plain `.includes()` check would let
// "bed" match inside "Bedding" or "Bedsheet", incorrectly marking bed linens
// as eligible furniture. `\b` word boundaries prevent that.
function matchesKeyword(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "i");
  return pattern.test(haystack);
}

/**
 * Decide whether a product is eligible for 3D/AR generation.
 *
 * Primary signal: the Shopify product category/type. Falls back to keyword
 * matching against the title when the category is missing or ambiguous,
 * since real Shopify catalogs are not always cleanly categorized.
 */
export function isEligibleProduct(
  category: string,
  title: string,
): EligibilityResult {
  const normalizedCategory = category.trim().toLowerCase();
  const normalizedTitle = title.trim().toLowerCase();

  if (!normalizedCategory && !normalizedTitle) {
    return {
      eligible: false,
      reason: "No category or title to evaluate.",
    };
  }

  const categoryMatch = ELIGIBLE_CATEGORY_KEYWORDS.some((keyword) =>
    matchesKeyword(normalizedCategory, keyword),
  );
  if (categoryMatch) {
    return {
      eligible: true,
      reason: `Category "${category}" matches the Furniture/Mattress eligibility list.`,
    };
  }

  const titleMatch = ELIGIBLE_CATEGORY_KEYWORDS.some((keyword) =>
    matchesKeyword(normalizedTitle, keyword),
  );
  if (titleMatch) {
    return {
      eligible: true,
      reason: `Category "${category}" is not explicitly Furniture/Mattress, but the product title matches a Furniture/Mattress keyword.`,
    };
  }

  return {
    eligible: false,
    reason: `Category "${category}" and title do not match Furniture or Mattress -- only these categories are eligible for 3D/AR generation.`,
  };
}
