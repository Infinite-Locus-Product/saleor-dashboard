/**
 * Resolves the TenexuBackend base URL.
 *
 * Lives in its own module because jest (SWC → CommonJS) cannot parse
 * `import.meta`; tests mock this module instead of the env access.
 */
export function getTenexuBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_TENEXU_API_URL as string | undefined;

  if (!baseUrl) {
    throw new Error(
      "VITE_TENEXU_API_URL is not set. The CX manual-return module cannot reach the backend without it.",
    );
  }

  return baseUrl;
}
