/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly VITE_DISABLE_STRICT_MODE?: string;
  readonly VITE_TENEXU_API_URL?: string;
  readonly VITE_SALEOR_PRODUCT_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
