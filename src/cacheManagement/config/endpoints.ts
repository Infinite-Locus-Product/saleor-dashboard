import {
  cacheConfirmationMessages,
  cacheEndpointMessages,
  cacheFieldMessages,
  cacheManagementMessages,
} from "@dashboard/cacheManagement/messages";
import { type CacheEndpointConfig } from "@dashboard/cacheManagement/types";

/**
 * Cache prefixes the backend is known to namespace. The generic /clear-cache
 * route accepts any string, but the dashboard deliberately exposes only these —
 * a typo in a free-text prefix would silently clear nothing, or the wrong thing.
 */
export const allowedCacheKeyPrefixes = [
  { value: "cache:freebie", label: cacheFieldMessages.prefixFreebie },
  { value: "taggbox:", label: cacheFieldMessages.prefixTaggbox },
  { value: "preorder", label: cacheFieldMessages.prefixPreorder },
  { value: "edd-config", label: cacheFieldMessages.prefixEddConfig },
];

/**
 * Every cache operation the dashboard exposes, mirroring the TenxYou Postman
 * collection. This array is the single source of truth: the sections, cards,
 * forms and validation are all derived from it, so adding an endpoint is a
 * one-object change with no new JSX.
 */
export const cacheEndpoints: CacheEndpointConfig[] = [
  // ---------------------------------------------------------------- slugs ---
  {
    id: "pdp-slugs",
    category: "slugs",
    title: cacheEndpointMessages.pdpSlugs,
    description: cacheEndpointMessages.pdpSlugsDescription,
    method: "GET",
    path: "/saleor/pdp-slugs",
    actionLabel: cacheManagementMessages.generate,
  },
  {
    id: "plp-slugs",
    category: "slugs",
    title: cacheEndpointMessages.plpSlugs,
    description: cacheEndpointMessages.plpSlugsDescription,
    method: "GET",
    path: "/saleor/plp-slugs",
    actionLabel: cacheManagementMessages.generate,
  },
  {
    id: "generate-slug-variant-map",
    category: "slugs",
    title: cacheEndpointMessages.slugVariantMap,
    description: cacheEndpointMessages.slugVariantMapDescription,
    method: "GET",
    path: "/saleor/generate-slug-variant-map",
    actionLabel: cacheManagementMessages.generate,
  },

  // ------------------------------------------------------------ inventory ---
  {
    id: "inventory-full-seed",
    category: "inventory",
    title: cacheEndpointMessages.inventoryFullSeed,
    description: cacheEndpointMessages.inventoryFullSeedDescription,
    method: "POST",
    path: "/saleor/inventory-stock-cache-init",
    requiresAdmin: true,
    destructive: true,
    actionLabel: cacheManagementMessages.seed,
    confirmation: {
      title: cacheConfirmationMessages.inventoryFullSeedTitle,
      description: cacheConfirmationMessages.inventoryFullSeedDescription,
    },
  },
  {
    id: "inventory-targeted-seed",
    category: "inventory",
    title: cacheEndpointMessages.inventoryTargetedSeed,
    description: cacheEndpointMessages.inventoryTargetedSeedDescription,
    method: "POST",
    path: "/saleor/inventory-stock-cache-init",
    requiresAdmin: true,
    actionLabel: cacheManagementMessages.seed,
    fields: [
      {
        type: "idList",
        name: "variantIds",
        label: cacheFieldMessages.variantIds,
        helpText: cacheFieldMessages.variantIdsHelp,
        required: true,
        placeholder: "UHJvZHVjdFZhcmlhbnQ6MTIz",
      },
    ],
  },

  // -------------------------------------------------------------- generic ---
  {
    id: "clear-cache-freebie",
    category: "generic",
    title: cacheEndpointMessages.genericFreebie,
    description: cacheEndpointMessages.genericFreebieDescription,
    method: "POST",
    path: "/saleor/clear-cache",
    destructive: true,
    staticBody: { cache_key_prefix: "cache:freebie" },
    confirmation: {
      title: cacheConfirmationMessages.genericPrefixTitle,
      description: cacheConfirmationMessages.genericPrefixDescription,
    },
  },
  {
    id: "clear-cache-taggbox",
    category: "generic",
    title: cacheEndpointMessages.genericTaggbox,
    description: cacheEndpointMessages.genericTaggboxDescription,
    method: "POST",
    path: "/saleor/clear-cache",
    destructive: true,
    staticBody: { cache_key_prefix: "taggbox:" },
    confirmation: {
      title: cacheConfirmationMessages.genericPrefixTitle,
      description: cacheConfirmationMessages.genericPrefixDescription,
    },
  },
  {
    id: "clear-cache-preorder",
    category: "generic",
    title: cacheEndpointMessages.genericPreorder,
    description: cacheEndpointMessages.genericPreorderDescription,
    method: "POST",
    path: "/saleor/clear-cache",
    destructive: true,
    staticBody: { cache_key_prefix: "preorder" },
    confirmation: {
      title: cacheConfirmationMessages.genericPrefixTitle,
      description: cacheConfirmationMessages.genericPrefixDescription,
    },
  },
  {
    id: "clear-cache-edd-config",
    category: "generic",
    title: cacheEndpointMessages.genericEddConfig,
    description: cacheEndpointMessages.genericEddConfigDescription,
    method: "POST",
    path: "/saleor/clear-cache",
    destructive: true,
    staticBody: { cache_key_prefix: "edd-config" },
    confirmation: {
      title: cacheConfirmationMessages.genericPrefixTitle,
      description: cacheConfirmationMessages.genericPrefixDescription,
    },
  },
  {
    id: "clear-cache-by-prefix",
    category: "generic",
    title: cacheEndpointMessages.genericByPrefix,
    description: cacheEndpointMessages.genericByPrefixDescription,
    method: "POST",
    path: "/saleor/clear-cache",
    destructive: true,
    fields: [
      {
        type: "select",
        name: "cache_key_prefix",
        label: cacheFieldMessages.cacheKeyPrefix,
        required: true,
        options: allowedCacheKeyPrefixes,
      },
    ],
    confirmation: {
      title: cacheConfirmationMessages.genericPrefixTitle,
      description: cacheConfirmationMessages.genericPrefixDescription,
    },
  },

  // --------------------------------------------------------------- navbar ---
  {
    id: "clear-navbar-cache",
    category: "navbar",
    title: cacheEndpointMessages.navbarClear,
    description: cacheEndpointMessages.navbarClearDescription,
    method: "POST",
    path: "/saleor/clear-navbar-cache",
  },

  // ---------------------------------------------------------- testimonial ---
  {
    id: "clear-all-testimonial-cache",
    category: "testimonial",
    title: cacheEndpointMessages.testimonialClearAll,
    description: cacheEndpointMessages.testimonialClearAllDescription,
    method: "POST",
    path: "/saleor/clear-all-testimonial-cache",
    destructive: true,
    confirmation: {
      title: cacheConfirmationMessages.testimonialAllTitle,
      description: cacheConfirmationMessages.testimonialAllDescription,
    },
  },
  {
    id: "clear-testimonial-cache",
    category: "testimonial",
    title: cacheEndpointMessages.testimonialClearSpecific,
    description: cacheEndpointMessages.testimonialClearSpecificDescription,
    method: "POST",
    path: "/saleor/clear-testimonial-cache",
    fieldTarget: "query",
    fields: [
      {
        type: "text",
        name: "productId",
        label: cacheFieldMessages.productId,
        helpText: cacheFieldMessages.productIdHelp,
        required: true,
        placeholder: "UHJvZHVjdDoxMjM=",
      },
    ],
  },

  // ------------------------------------------------------------- thankYou ---
  {
    id: "clear-thankyou-cache-all",
    category: "thankYou",
    title: cacheEndpointMessages.thankYouClearAll,
    description: cacheEndpointMessages.thankYouClearAllDescription,
    method: "POST",
    path: "/saleor/clear-thankyou-cache",
    destructive: true,
    confirmation: {
      title: cacheConfirmationMessages.thankYouAllTitle,
      description: cacheConfirmationMessages.thankYouAllDescription,
    },
  },
  {
    id: "clear-thankyou-cache-order",
    category: "thankYou",
    title: cacheEndpointMessages.thankYouClearOrder,
    description: cacheEndpointMessages.thankYouClearOrderDescription,
    method: "POST",
    path: "/saleor/clear-thankyou-cache",
    staticBody: { cache_key_prefix: "order" },
  },
  {
    id: "clear-thankyou-cache-youmaylike",
    category: "thankYou",
    title: cacheEndpointMessages.thankYouClearYouMayLike,
    description: cacheEndpointMessages.thankYouClearYouMayLikeDescription,
    method: "POST",
    path: "/saleor/clear-thankyou-cache",
    staticBody: { cache_key_prefix: "youmaylike" },
  },

  // --------------------------------------------------------------- rating ---
  {
    id: "clear-rating-cache-reference-data",
    category: "rating",
    title: cacheEndpointMessages.ratingReferenceData,
    description: cacheEndpointMessages.ratingReferenceDataDescription,
    method: "POST",
    path: "/saleor/clear-rating-cache",
    staticBody: { scope: "reference_data" },
  },
  {
    id: "clear-rating-cache-user-rating",
    category: "rating",
    title: cacheEndpointMessages.ratingUserRating,
    description: cacheEndpointMessages.ratingUserRatingDescription,
    method: "POST",
    path: "/saleor/clear-rating-cache",
    staticBody: { scope: "user_rating" },
    fields: [
      {
        type: "idList",
        name: "order_ids",
        label: cacheFieldMessages.orderIds,
        helpText: cacheFieldMessages.orderIdsHelp,
        required: true,
        placeholder: "T3JkZXI6MTIz",
      },
    ],
  },
  {
    id: "clear-rating-cache-order-status",
    category: "rating",
    title: cacheEndpointMessages.ratingOrderStatus,
    description: cacheEndpointMessages.ratingOrderStatusDescription,
    method: "POST",
    path: "/saleor/clear-rating-cache",
    staticBody: { scope: "order_status" },
    fields: [
      {
        type: "idList",
        name: "order_ids",
        label: cacheFieldMessages.orderIds,
        helpText: cacheFieldMessages.orderIdsHelp,
        required: true,
        placeholder: "T3JkZXI6MTIz",
      },
    ],
  },
  {
    id: "clear-rating-cache-all",
    category: "rating",
    title: cacheEndpointMessages.ratingAll,
    description: cacheEndpointMessages.ratingAllDescription,
    method: "POST",
    path: "/saleor/clear-rating-cache",
    destructive: true,
    staticBody: { scope: "all" },
    confirmation: {
      title: cacheConfirmationMessages.ratingAllTitle,
      description: cacheConfirmationMessages.ratingAllDescription,
    },
  },

  // ------------------------------------------------------ exchangeReasons ---
  {
    id: "clear-exchange-reasons-cache",
    category: "exchangeReasons",
    title: cacheEndpointMessages.exchangeReasonsClear,
    description: cacheEndpointMessages.exchangeReasonsClearDescription,
    method: "POST",
    path: "/saleor/clear-exchange-reasons-cache",
  },

  // -------------------------------------------------------------- taggbox ---
  {
    id: "tagbox-data-delete",
    category: "taggbox",
    title: cacheEndpointMessages.taggboxDelete,
    description: cacheEndpointMessages.taggboxDeleteDescription,
    method: "DELETE",
    path: "/saleor/tagbox-data",
    fieldTarget: "query",
    fields: [
      {
        type: "text",
        name: "galleryId",
        label: cacheFieldMessages.galleryId,
        required: true,
      },
      {
        type: "text",
        name: "feedId",
        label: cacheFieldMessages.feedId,
        required: true,
      },
      {
        type: "text",
        name: "postId",
        label: cacheFieldMessages.postId,
        required: true,
      },
    ],
  },
];

export const getCacheEndpointById = (id: string): CacheEndpointConfig | undefined =>
  cacheEndpoints.find(endpoint => endpoint.id === id);
