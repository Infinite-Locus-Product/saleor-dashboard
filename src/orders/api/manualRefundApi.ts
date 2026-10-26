/**
 * Thin client for the TenXyou backend's manual-refund endpoint.
 * Mirrors src/orders/api/bulkOrderApi.ts (base url resolution).
 *
 * Used by ops to (re)trigger a manual refund for a fulfillment straight from
 * the order's "Fulfillment Metadata" dialog.
 */

const BASE_URL = import.meta.env.VITE_TENEXU_API_URL as string | undefined;

export interface ManualRefundPayload {
  orderId: string;
  fulfillmentId: string;
  orderNumber: string;
  amount: number;
  reason: string;
  refundedBy: string;
}

export interface ManualRefundResponse {
  [key: string]: unknown;
}

export async function triggerManualRefund(
  payload: ManualRefundPayload,
): Promise<ManualRefundResponse> {
  if (!BASE_URL) {
    throw new Error(
      "VITE_TENEXU_API_URL is not set. The manual-refund module cannot reach the backend without it.",
    );
  }

  const res = await fetch(`${BASE_URL}/refund/manual-refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.error || json?.message || `Request failed: ${res.status}`);
  }

  return json as ManualRefundResponse;
}
