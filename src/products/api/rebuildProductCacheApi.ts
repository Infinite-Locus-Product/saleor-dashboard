/**
 * Thin client for the TenXyou backend's rebuild-product-variant-cache endpoint.
 * The /saleor/* routes authenticate via the backend's own server-level Saleor
 * token, so no auth headers are sent from the dashboard.
 */

const BASE_URL = import.meta.env.VITE_TENEXU_API_URL as string | undefined;

export async function rebuildProductVariantCache(params: {
  productId: string;
  channel?: string;
}): Promise<void> {
  if (!BASE_URL) {
    throw new Error(
      "VITE_TENEXU_API_URL is not set. The rebuild-cache action cannot reach the backend without it.",
    );
  }

  const res = await fetch(`${BASE_URL}/saleor/rebuild-product-variant-cache`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      first: 10,
      productId: params.productId,
      channel: params.channel ?? "txy",
    }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.error || `Request failed: ${res.status}`);
  }
}
