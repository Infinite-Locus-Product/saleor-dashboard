/**
 * TTXY-4841 — page.route stubs for the TenexuBackend cohort API. Saleor itself
 * (auth, routing, GraphQL) stays real; only `/cohorts/*` REST calls are
 * answered here, matched on path so any VITE_TENEXU_API_URL works. Every
 * request is recorded so specs can assert on bodies and headers.
 */
import { type Page, type Request, type Route } from "@playwright/test";

export const TENEXU_API_URL_MISSING_REASON =
  "VITE_TENEXU_API_URL is not set: the dashboard throws before any TenexuBackend request, so the stubs are never reached";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition, X-Refreshed-Auth-Token",
};

export const fulfillJson = (route: Route, data: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: true, data, error: "" }),
  });

export const fulfillError = (route: Route, status: number, body: Record<string, unknown>) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: false, ...body }),
  });

export const fulfillCsv = (route: Route, csv: string, filename: string) =>
  route.fulfill({
    status: 200,
    contentType: "text/csv",
    headers: { ...CORS_HEADERS, "Content-Disposition": `attachment; filename="${filename}"` },
    body: csv,
  });

export interface RecordedCall {
  method: string;
  path: string;
  search: string;
  body: unknown;
  headers: Record<string, string>;
}

type Handler = (route: Route, request: Request, url: URL) => Promise<void> | void;

export interface TenexuStub {
  calls: RecordedCall[];
  /** Calls whose method and path match. */
  find: (method: string, path: string | RegExp) => RecordedCall[];
}

/**
 * Routes `/cohorts...` XHR/fetch calls to the first matching handler (keyed by
 * "METHOD path-regex"). CORS preflights are answered directly; anything else
 * falls through, so the dashboard's own page loads are untouched.
 */
export const stubTenexu = async (
  page: Page,
  handlers: Array<[method: string, path: RegExp, handler: Handler]>,
): Promise<TenexuStub> => {
  const calls: RecordedCall[] = [];

  await page.route(
    url => /\/cohorts(\/|$)/.test(url.pathname),
    async (route, request) => {
      // Dashboard page loads (e.g. /cohorts/add) are documents and pass through.
      if (!["fetch", "xhr", "preflight", "other"].includes(request.resourceType())) {
        return route.fallback();
      }

      if (request.method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }

      const url = new URL(request.url());
      const match = handlers.find(
        ([method, path]) => method === request.method() && path.test(url.pathname),
      );

      if (!match) return route.fallback();

      let body: unknown = null;

      try {
        body = request.postDataJSON();
      } catch {
        body = request.postData();
      }

      calls.push({
        method: request.method(),
        path: url.pathname,
        search: url.search,
        body,
        headers: await request.allHeaders(),
      });

      return match[2](route, request, url);
    },
  );

  return {
    calls,
    find: (method, path) =>
      calls.filter(
        call =>
          call.method === method &&
          (typeof path === "string" ? call.path.endsWith(path) : path.test(call.path)),
      ),
  };
};
