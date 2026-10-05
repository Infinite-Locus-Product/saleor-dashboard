/**
 * TTXY-6032 — page.route mock of the TenexuBackend CX returns API (VITE_TENEXU_API_URL host).
 * Every request matching `**\/cx/returns**` is answered here; nothing reaches a real backend.
 */
import { type Page, type Request } from "@playwright/test";

export const QUEUE_URL = "returns-exchange/returns";
export const detailUrl = (id: string) => `returns-exchange/returns/${id}`;

export const REASON = "Customer used the product; tags removed per photos";

type Row = Record<string, unknown>;

export const makeRow = (overrides: Row = {}): Row => ({
  id: 1,
  request_id: "REQ-6120",
  saleor_order_id: "T3JkZXI6MQ==",
  saleor_order_number: "5001",
  saleor_fulfillment_id: "F1",
  saleor_return_fulfillment_id: null,
  customer_name: "Asha Rao",
  customer_email: "asha@example.com",
  customer_phone: "+919876543210",
  delivery_address: { postalCode: "560001", city: "Bengaluru", streetAddress1: "1 MG Road" },
  payment_method: "PREPAID",
  order_placed_at: "2026-09-20T10:00:00Z",
  delivery_date: "2026-09-25T10:00:00Z",
  product_name: "Linen Shirt",
  product_sku: "LS-01-M",
  product_size: "M",
  product_colour: "Blue",
  product_variant_id: null,
  product_id: null,
  return_reason: "Size issue",
  customer_images: null,
  cod_refund_email: null,
  cx_status: "RETURN_PENDING",
  last_activity_at: "2026-10-01T10:00:00Z",
  auto_approval_due_at: "2026-10-06T10:00:00Z",
  customer_unreachable: false,
  replacement_order_id: null,
  replacement_order_number: null,
  erp_sync_status: null,
  created_at: "2026-10-01T09:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
  last_activity_by_id: null,
  last_activity_by_name: null,
  sla_tier: "SAFE",
  sla_hours_remaining: 20,
  call_count: 0,
  last_call_outcome: null,
  last_call_user_action: null,
  pincode: "560001",
  rejection_reason: null,
  rejected_by_name: null,
  rejected_at: null,
  ...overrides,
});

export const makeDetail = (overrides: Row = {}): Row => ({
  ...makeRow(),
  call_logs: [],
  audit_trail: [],
  last_user_action: null,
  eligibility: null,
  ...overrides,
});

export const callLog = (n: number, userAction: string | null) => ({
  id: n,
  request_id: "REQ-6120",
  call_number: n,
  cx_agent_id: "VXNlcjo3",
  cx_agent_name: "Ravi Kumar",
  outcome: "Answered",
  user_action: userAction,
  notes: `call ${n}`,
  callback_date: null,
  callback_time: null,
  created_at: `2026-10-0${n}T10:00:00Z`,
});

export interface CxMockOptions {
  /** Rows for GET /cx/returns, or a function of the query string. */
  list?: Row[] | ((qs: URLSearchParams) => { data: Row[]; total?: number });
  /** Detail for GET /cx/returns/:id (may change after reject). */
  detail?: () => Row;
  /** Response for POST /cx/returns/:id/reject. */
  reject?: (body: any) => { status: number; body: unknown };
}

export interface CxMockLog {
  listQueries: URLSearchParams[];
  rejectBodies: any[];
  requests: Request[];
}

export async function mockCxReturnsApi(page: Page, opts: CxMockOptions): Promise<CxMockLog> {
  const log: CxMockLog = { listQueries: [], rejectBodies: [], requests: [] };

  await page.route("**/cx/returns**", async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/cx\/returns/, "");
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    log.requests.push(req);

    if (req.method() === "GET" && (path === "" || path === "/")) {
      log.listQueries.push(url.searchParams);

      const res =
        typeof opts.list === "function"
          ? opts.list(url.searchParams)
          : { data: opts.list ?? [], total: undefined };
      const total = res.total ?? res.data.length;

      return json(200, {
        ok: true,
        data: res.data,
        pagination: { total, page: Number(url.searchParams.get("page") ?? 1), limit: 20 },
      });
    }

    if (req.method() === "GET" && path === "/active-count") {
      return json(200, { ok: true, data: { count: 1 } });
    }

    if (req.method() === "POST" && /\/[^/]+\/reject$/.test(path)) {
      const body = req.postDataJSON();

      log.rejectBodies.push(body);

      const res = opts.reject?.(body) ?? { status: 200, body: { ok: true, data: {} } };

      return json(res.status, res.body);
    }

    if (req.method() === "GET" && /\/[^/]+\/(call-logs|variants)$/.test(path)) {
      return json(200, { ok: true, data: [] });
    }

    if (req.method() === "GET" && /^\/[^/]+$/.test(path) && opts.detail) {
      return json(200, { ok: true, data: opts.detail() });
    }

    return json(404, { ok: false, code: "NOT_FOUND", message: `unmocked ${req.method()} ${path}` });
  });

  return log;
}
