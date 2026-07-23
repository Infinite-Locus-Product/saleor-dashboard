/**
 * Isolates `import.meta.env` access.
 *
 * Two reasons this is its own module:
 *  1. `import.meta` cannot be parsed by Jest's CJS transform, so any file that
 *     touches it directly becomes untestable. Keeping it here lets tests do
 *     `jest.mock("./env")` and never load this file.
 *  2. Resolving lazily means a missing env var fails the first request with a
 *     clear message, instead of throwing at import time and taking down the
 *     whole lazy-loaded chunk.
 */
export const getTenexuBaseUrl = (): string => {
  const baseUrl = import.meta.env.VITE_TENEXU_API_URL;

  if (!baseUrl) {
    throw new Error(
      "VITE_TENEXU_API_URL is not set. The Cohorts module cannot reach the backend without it.",
    );
  }

  return baseUrl;
};
