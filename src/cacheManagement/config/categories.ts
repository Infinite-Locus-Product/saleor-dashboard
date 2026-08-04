import { cacheCategoryMessages } from "@dashboard/cacheManagement/messages";
import { type CacheCategoryConfig } from "@dashboard/cacheManagement/types";

/**
 * Display order of the dashboard sections. PDP/PLP slugs come first because
 * they are the most frequently run operations.
 */
export const cacheCategories: CacheCategoryConfig[] = [
  {
    id: "slugs",
    label: cacheCategoryMessages.slugs,
    description: cacheCategoryMessages.slugsDescription,
  },
  {
    id: "inventory",
    label: cacheCategoryMessages.inventory,
    description: cacheCategoryMessages.inventoryDescription,
  },
  {
    id: "generic",
    label: cacheCategoryMessages.generic,
    description: cacheCategoryMessages.genericDescription,
  },
  {
    id: "navbar",
    label: cacheCategoryMessages.navbar,
    description: cacheCategoryMessages.navbarDescription,
  },
  {
    id: "testimonial",
    label: cacheCategoryMessages.testimonial,
    description: cacheCategoryMessages.testimonialDescription,
  },
  {
    id: "thankYou",
    label: cacheCategoryMessages.thankYou,
    description: cacheCategoryMessages.thankYouDescription,
  },
  {
    id: "rating",
    label: cacheCategoryMessages.rating,
    description: cacheCategoryMessages.ratingDescription,
  },
  {
    id: "exchangeReasons",
    label: cacheCategoryMessages.exchangeReasons,
    description: cacheCategoryMessages.exchangeReasonsDescription,
  },
  {
    id: "taggbox",
    label: cacheCategoryMessages.taggbox,
    description: cacheCategoryMessages.taggboxDescription,
  },
];
