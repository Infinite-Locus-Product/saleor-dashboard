/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly VITE_DISABLE_STRICT_MODE?: string;
  readonly VITE_TENEXU_API_URL?: string;
  readonly VITE_SALEOR_PRODUCT_PASSWORD?: string;
  /**
   * Optional shared admin key for cache routes flagged [Admin] in the Postman
   * collection. When unset, those routes fall back to the signed-in staff
   * user's Saleor bearer token.
   */
  readonly VITE_TENEXU_ADMIN_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
