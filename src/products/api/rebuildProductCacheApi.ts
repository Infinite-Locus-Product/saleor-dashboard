/**
 * Thin client for the TenXyou backend's rebuild-product-variant-cache endpoint.
 * The backend refuses a repeat inside its per-product cooldown with 429 + a
 * "try again in Ns" message, which is thrown as-is so the card can show it.
 */
import { getTenexuBaseUrl } from "@dashboard/returns-exchange/api/tenexuBaseUrl";

export async function rebuildProductVariantCache(params: {
  productId: string;
  channel?: string;
}): Promise<void> {
  const res = await fetch(`${getTenexuBaseUrl()}/saleor/rebuild-product-variant-cache`, {
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
