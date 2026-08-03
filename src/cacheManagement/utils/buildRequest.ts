import {
  type CacheEndpointConfig,
  type CacheFieldValues,
  type CacheRequestDescriptor,
} from "@dashboard/cacheManagement/types";

/** Splits an idList textarea into trimmed, non-empty ids. */
export const parseIdList = (raw: string): string[] =>
  raw
    .split(/[\n,]/)
    .map(value => value.trim())
    .filter(Boolean);

const joinUrl = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

/**
 * Turns an endpoint config plus raw form values into a concrete request.
 *
 * Fields land either in the JSON body or the query string depending on
 * `fieldTarget`; `staticBody` is always merged into the body first so a card
 * like "clear rating cache for orders" can pin `scope` while the user only
 * supplies `order_ids`.
 */
export const buildCacheRequest = ({
  endpoint,
  values,
  baseUrl,
}: {
  endpoint: CacheEndpointConfig;
  values: CacheFieldValues;
  baseUrl: string;
}): CacheRequestDescriptor => {
  const url = new URL(joinUrl(baseUrl, endpoint.path));
  const body: Record<string, unknown> = { ...endpoint.staticBody };
  const target = endpoint.fieldTarget ?? "body";

  for (const field of endpoint.fields ?? []) {
    const raw = values[field.name] ?? "";

    if (field.type === "idList") {
      const ids = parseIdList(raw);

      if (ids.length === 0) continue;

      if (target === "query") {
        url.searchParams.set(field.name, ids.join(","));
      } else {
        body[field.name] = ids;
      }

      continue;
    }

    const trimmed = raw.trim();

    if (!trimmed) continue;

    if (target === "query") {
      url.searchParams.set(field.name, trimmed);
    } else {
      body[field.name] = trimmed;
    }
  }

  // GET and DELETE never carry a body; POST only carries one when non-empty,
  // because several endpoints expect a bare request with no Content-Type.
  const supportsBody = endpoint.method === "POST";
  const hasBody = supportsBody && Object.keys(body).length > 0;

  return {
    url: url.toString(),
    method: endpoint.method,
    body: hasBody ? body : undefined,
  };
};
