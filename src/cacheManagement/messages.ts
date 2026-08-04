import { defineMessages } from "react-intl";

export const cacheManagementMessages = defineMessages({
  title: {
    defaultMessage: "Cache management",
    id: "0mkwsE",
    description: "page title",
  },
  subtitle: {
    defaultMessage: "Clear and rebuild TenxYou caches without leaving the dashboard",
    id: "SL5CuV",
    description: "page subtitle",
  },
  missingBaseUrl: {
    defaultMessage:
      "VITE_TENEXU_API_URL is not configured. Cache operations cannot reach the backend.",
    id: "R5MypQ",
    description: "configuration error",
  },
  clearCache: {
    defaultMessage: "Clear cache",
    id: "eGsI0H",
    description: "execute endpoint button",
  },
  generate: {
    defaultMessage: "Generate",
    id: "V6Kme/",
    description: "execute endpoint button",
  },
  seed: {
    defaultMessage: "Seed",
    id: "v3dhRu",
    description: "execute endpoint button",
  },
  adminBadge: {
    defaultMessage: "Admin",
    id: "CkjcRZ",
    description: "badge marking an endpoint that needs the admin key",
  },
  destructiveBadge: {
    defaultMessage: "Destructive",
    id: "SdOhFY",
    description: "badge marking a destructive endpoint",
  },
  responseLabel: {
    defaultMessage: "Response",
    id: "Gquk5H",
    description: "json viewer heading",
  },
  copyResponse: {
    defaultMessage: "Copy response",
    id: "pFBqwI",
    description: "copy button",
  },
  copied: {
    defaultMessage: "Copied to clipboard",
    id: "xof2B4",
    description: "toast after copying",
  },
  durationMs: {
    defaultMessage: "{duration} ms",
    id: "P6Vq9V",
    description: "execution duration",
  },
  statusSuccess: {
    defaultMessage: "Success",
    id: "defBfN",
    description: "execution status badge",
  },
  statusFailed: {
    defaultMessage: "Failed",
    id: "N/G9uY",
    description: "execution status badge",
  },
  executionSucceeded: {
    defaultMessage: "{title} finished in {duration} ms",
    id: "s3jN+U",
    description: "success toast",
  },
  executionFailed: {
    defaultMessage: "{title} failed",
    id: "7u0qyx",
    description: "error toast",
  },
  running: {
    defaultMessage: "Running…",
    id: "jy7hbR",
    description: "loading label on the action button",
  },
  confirmDefaultTitle: {
    defaultMessage: "Confirm cache operation",
    id: "qhkYak",
    description: "fallback confirmation dialog title",
  },
  confirmDefaultDescription: {
    defaultMessage: "This operation affects production caches. Continue?",
    id: "Ury01J",
    description: "fallback confirmation dialog body",
  },
  confirmRun: {
    defaultMessage: "Run operation",
    id: "g59Lr2",
    description: "confirmation dialog confirm button",
  },
});

export const cacheValidationMessages = defineMessages({
  required: {
    defaultMessage: "This field is required",
    id: "8hxjSV",
    description: "validation error",
  },
  emptyList: {
    defaultMessage: "Provide at least one id",
    id: "yzIdUV",
    description: "validation error",
  },
});

export const cacheCategoryMessages = defineMessages({
  slugs: {
    defaultMessage: "PDP / PLP slugs",
    id: "l/EbnT",
    description: "cache category",
  },
  slugsDescription: {
    defaultMessage: "Regenerate slug maps used for static generation. Safe to run any time.",
    id: "G1uoF0",
    description: "cache category description",
  },
  inventory: {
    defaultMessage: "Inventory / stock cache",
    id: "l1AshA",
    description: "cache category",
  },
  inventoryDescription: {
    defaultMessage: "Seed the Redis stock cache from Saleor. Requires the admin key.",
    id: "9gz2ns",
    description: "cache category description",
  },
  generic: {
    defaultMessage: "Generic cache",
    id: "86nF/u",
    description: "cache category",
  },
  genericDescription: {
    defaultMessage: "Clear a cache namespace by its key prefix. Restricted to a known allow-list.",
    id: "8KXpmL",
    description: "cache category description",
  },
  navbar: {
    defaultMessage: "Navbar cache",
    id: "I1OPkD",
    description: "cache category",
  },
  navbarDescription: {
    defaultMessage: "Refresh the storefront navigation menu.",
    id: "p2omjs",
    description: "cache category description",
  },
  testimonial: {
    defaultMessage: "Testimonial cache",
    id: "Al8TJe",
    description: "cache category",
  },
  testimonialDescription: {
    defaultMessage: "Clear cached testimonials globally or for one product.",
    id: "+SKaAn",
    description: "cache category description",
  },
  thankYou: {
    defaultMessage: "Thank you page cache",
    id: "dirkvL",
    description: "cache category",
  },
  thankYouDescription: {
    defaultMessage: "Clear the order confirmation and recommendation caches.",
    id: "ZzLEM6",
    description: "cache category description",
  },
  rating: {
    defaultMessage: "Rating cache",
    id: "9vGytc",
    description: "cache category",
  },
  ratingDescription: {
    defaultMessage: "Clear rating reference data, per-order ratings or order status.",
    id: "TvENAj",
    description: "cache category description",
  },
  exchangeReasons: {
    defaultMessage: "Exchange reasons cache",
    id: "wEmeZA",
    description: "cache category",
  },
  exchangeReasonsDescription: {
    defaultMessage: "Refresh the return and exchange reason list.",
    id: "LILzpd",
    description: "cache category description",
  },
  taggbox: {
    defaultMessage: "Taggbox cache",
    id: "t2H1d1",
    description: "cache category",
  },
  taggboxDescription: {
    defaultMessage: "Remove a single cached Taggbox gallery entry.",
    id: "jZKZRP",
    description: "cache category description",
  },
});

export const cacheEndpointMessages = defineMessages({
  // PDP / PLP slugs
  pdpSlugs: {
    defaultMessage: "Generate PDP slugs",
    id: "JCAoC9",
    description: "endpoint title",
  },
  pdpSlugsDescription: {
    defaultMessage: "Rebuilds the product detail page slug list.",
    id: "tjDEUU",
    description: "endpoint description",
  },
  plpSlugs: {
    defaultMessage: "Generate PLP slugs",
    id: "aTThJR",
    description: "endpoint title",
  },
  plpSlugsDescription: {
    defaultMessage: "Rebuilds the product listing page slug list.",
    id: "YD1L8P",
    description: "endpoint description",
  },
  slugVariantMap: {
    defaultMessage: "Generate slug variant map",
    id: "h0Rqqv",
    description: "endpoint title",
  },
  slugVariantMapDescription: {
    defaultMessage: "Rebuilds the slug to variant mapping used by the storefront.",
    id: "buBb9Z",
    description: "endpoint description",
  },

  // Inventory
  inventoryFullSeed: {
    defaultMessage: "Full seed — all variants",
    id: "yqx+1z",
    description: "endpoint title",
  },
  inventoryFullSeedDescription: {
    defaultMessage:
      "Reseeds the stock cache for every variant in the catalogue. Long running and heavy on the backend.",
    id: "0cFzZ7",
    description: "endpoint description",
  },
  inventoryTargetedSeed: {
    defaultMessage: "Targeted seed — specific variants",
    id: "L8dhK4",
    description: "endpoint title",
  },
  inventoryTargetedSeedDescription: {
    defaultMessage: "Reseeds the stock cache for the variant ids you provide.",
    id: "B5sWs6",
    description: "endpoint description",
  },

  // Generic
  genericFreebie: {
    defaultMessage: "Clear freebie feature flag cache",
    id: "QiIYWm",
    description: "endpoint title",
  },
  genericFreebieDescription: {
    defaultMessage: "Clears the cache:freebie namespace.",
    id: "RKv9pp",
    description: "endpoint description",
  },
  genericTaggbox: {
    defaultMessage: "Clear Taggbox cache",
    id: "eb9qNN",
    description: "endpoint title",
  },
  genericTaggboxDescription: {
    defaultMessage: "Clears the taggbox: namespace.",
    id: "innj1s",
    description: "endpoint description",
  },
  genericPreorder: {
    defaultMessage: "Clear pre-order variants",
    id: "bFwPQv",
    description: "endpoint title",
  },
  genericPreorderDescription: {
    defaultMessage: "Clears the preorder namespace.",
    id: "/eZHjL",
    description: "endpoint description",
  },
  genericEddConfig: {
    defaultMessage: "Clear EDD config (Strapi)",
    id: "HWRSKP",
    description: "endpoint title",
  },
  genericEddConfigDescription: {
    defaultMessage: "Clears the edd-config namespace.",
    id: "UJVDTH",
    description: "endpoint description",
  },
  genericByPrefix: {
    defaultMessage: "Clear by prefix (advanced)",
    id: "nTPxGJ",
    description: "endpoint title",
  },
  genericByPrefixDescription: {
    defaultMessage:
      "Pick one of the approved cache prefixes. Arbitrary prefixes are intentionally not allowed.",
    id: "8Xt3yN",
    description: "endpoint description",
  },

  // Navbar
  navbarClear: {
    defaultMessage: "Clear navbar cache",
    id: "2FhW9X",
    description: "endpoint title",
  },
  navbarClearDescription: {
    defaultMessage: "Drops the cached storefront navigation tree.",
    id: "gKmIEO",
    description: "endpoint description",
  },

  // Testimonial
  testimonialClearAll: {
    defaultMessage: "Clear all testimonial cache",
    id: "z/TalQ",
    description: "endpoint title",
  },
  testimonialClearAllDescription: {
    defaultMessage: "Drops cached testimonials for every product.",
    id: "zp5mbU",
    description: "endpoint description",
  },
  testimonialClearSpecific: {
    defaultMessage: "Clear testimonial cache for a product",
    id: "OHazrP",
    description: "endpoint title",
  },
  testimonialClearSpecificDescription: {
    defaultMessage: "Drops cached testimonials for a single product id.",
    id: "I40Sr0",
    description: "endpoint description",
  },

  // Thank you
  thankYouClearAll: {
    defaultMessage: "Clear all (order + you may like)",
    id: "zUbXWK",
    description: "endpoint title",
  },
  thankYouClearAllDescription: {
    defaultMessage: "Drops both thank-you page caches at once.",
    id: "R43LZa",
    description: "endpoint description",
  },
  thankYouClearOrder: {
    defaultMessage: "Clear only order cache",
    id: "BhrnfM",
    description: "endpoint title",
  },
  thankYouClearOrderDescription: {
    defaultMessage: "Drops the cached order summary shown after checkout.",
    id: "yxrATV",
    description: "endpoint description",
  },
  thankYouClearYouMayLike: {
    defaultMessage: "Clear only you-may-like cache",
    id: "gjYBKt",
    description: "endpoint title",
  },
  thankYouClearYouMayLikeDescription: {
    defaultMessage: "Drops the cached recommendations shown after checkout.",
    id: "kCF3d4",
    description: "endpoint description",
  },

  // Rating
  ratingReferenceData: {
    defaultMessage: "Clear reference data",
    id: "BaiyaK",
    description: "endpoint title",
  },
  ratingReferenceDataDescription: {
    defaultMessage: "Drops cached rating questions and options.",
    id: "zwWiyE",
    description: "endpoint description",
  },
  ratingUserRating: {
    defaultMessage: "Clear ratings for specific orders",
    id: "Aq3irc",
    description: "endpoint title",
  },
  ratingUserRatingDescription: {
    defaultMessage: "Drops cached user ratings for the order ids you provide.",
    id: "lfgOQ+",
    description: "endpoint description",
  },
  ratingOrderStatus: {
    defaultMessage: "Clear order status cache",
    id: "1kaYH5",
    description: "endpoint title",
  },
  ratingOrderStatusDescription: {
    defaultMessage: "Drops the cached rating eligibility status for the given orders.",
    id: "7GMhel",
    description: "endpoint description",
  },
  ratingAll: {
    defaultMessage: "Clear all rating cache (emergency)",
    id: "AYlGuO",
    description: "endpoint title",
  },
  ratingAllDescription: {
    defaultMessage:
      "Drops every rating cache entry. Use only when the rating data is known to be corrupt.",
    id: "EBMDOA",
    description: "endpoint description",
  },

  // Exchange reasons
  exchangeReasonsClear: {
    defaultMessage: "Clear exchange reasons cache",
    id: "x9xxX/",
    description: "endpoint title",
  },
  exchangeReasonsClearDescription: {
    defaultMessage: "Refreshes the return and exchange reason list.",
    id: "vuEGc1",
    description: "endpoint description",
  },

  // Taggbox
  taggboxDelete: {
    defaultMessage: "Clear specific Taggbox entry",
    id: "8BYI1x",
    description: "endpoint title",
  },
  taggboxDeleteDescription: {
    defaultMessage: "Removes one cached gallery post by gallery, feed and post id.",
    id: "0EPMOF",
    description: "endpoint description",
  },
});

export const cacheFieldMessages = defineMessages({
  variantIds: {
    defaultMessage: "Variant IDs",
    id: "yw2c1p",
    description: "form field label",
  },
  variantIdsHelp: {
    defaultMessage: "One base64 variant id per line, or comma separated.",
    id: "AnfNNK",
    description: "form field help text",
  },
  orderIds: {
    defaultMessage: "Order IDs",
    id: "dxH6kR",
    description: "form field label",
  },
  orderIdsHelp: {
    defaultMessage: "One base64 order id per line, or comma separated.",
    id: "J7OcA7",
    description: "form field help text",
  },
  productId: {
    defaultMessage: "Product ID",
    id: "AckTuM",
    description: "form field label",
  },
  productIdHelp: {
    defaultMessage: "Base64 product id, e.g. UHJvZHVjdDoxMjM=",
    id: "mgHCmd",
    description: "form field help text",
  },
  cacheKeyPrefix: {
    defaultMessage: "Cache key prefix",
    id: "Ql2hMH",
    description: "form field label",
  },
  galleryId: {
    defaultMessage: "Gallery ID",
    id: "KajtmQ",
    description: "form field label",
  },
  feedId: {
    defaultMessage: "Feed ID",
    id: "ZmYG9/",
    description: "form field label",
  },
  postId: {
    defaultMessage: "Post ID",
    id: "byC9m/",
    description: "form field label",
  },
  prefixFreebie: {
    defaultMessage: "cache:freebie — freebie feature flag",
    id: "d/ykN7",
    description: "select option",
  },
  prefixTaggbox: {
    defaultMessage: "taggbox: — Taggbox galleries",
    id: "Zn3j/j",
    description: "select option",
  },
  prefixPreorder: {
    defaultMessage: "preorder — pre-order variants",
    id: "FD4P3W",
    description: "select option",
  },
  prefixEddConfig: {
    defaultMessage: "edd-config — EDD config from Strapi",
    id: "wNPW1v",
    description: "select option",
  },
});

export const cacheConfirmationMessages = defineMessages({
  inventoryFullSeedTitle: {
    defaultMessage: "Reseed stock cache for every variant?",
    id: "Rxy+mB",
    description: "confirmation dialog title",
  },
  inventoryFullSeedDescription: {
    defaultMessage:
      "This walks the entire catalogue and can take several minutes, putting sustained load on the backend. Prefer a targeted seed when you know which variants changed.",
    id: "Cdsvt8",
    description: "confirmation dialog body",
  },
  ratingAllTitle: {
    defaultMessage: "Clear every rating cache entry?",
    id: "EyHL6C",
    description: "confirmation dialog title",
  },
  ratingAllDescription: {
    defaultMessage:
      "This is the emergency reset. All rating data will be recomputed on demand, which briefly increases database load. Use a narrower scope if you can.",
    id: "ulauCH",
    description: "confirmation dialog body",
  },
  testimonialAllTitle: {
    defaultMessage: "Clear testimonials for every product?",
    id: "Dh6RJE",
    description: "confirmation dialog title",
  },
  testimonialAllDescription: {
    defaultMessage:
      "Every product page will refetch its testimonials on the next request. Use the per-product action when only one product changed.",
    id: "EWLDok",
    description: "confirmation dialog body",
  },
  thankYouAllTitle: {
    defaultMessage: "Clear both thank-you page caches?",
    id: "kcmYp4",
    description: "confirmation dialog title",
  },
  thankYouAllDescription: {
    defaultMessage:
      "Clears the order summary and the you-may-like recommendations together. You can clear just one of them instead.",
    id: "kYgKNo",
    description: "confirmation dialog body",
  },
  genericPrefixTitle: {
    defaultMessage: "Clear this cache namespace?",
    id: "LrU/1N",
    description: "confirmation dialog title",
  },
  genericPrefixDescription: {
    defaultMessage:
      "Every key under this prefix is dropped. The namespace repopulates lazily as traffic arrives.",
    id: "/I6LhE",
    description: "confirmation dialog body",
  },
});
