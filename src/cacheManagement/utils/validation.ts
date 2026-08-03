import {
  type CacheEndpointConfig,
  type CacheFieldValues,
  type CacheValidationErrors,
} from "@dashboard/cacheManagement/types";

import { parseIdList } from "./buildRequest";

/**
 * Validates raw form values against an endpoint's field schema.
 *
 * Returns error codes rather than strings so the caller resolves them through
 * react-intl at render time.
 */
export const validateCacheFields = ({
  endpoint,
  values,
}: {
  endpoint: CacheEndpointConfig;
  values: CacheFieldValues;
}): CacheValidationErrors => {
  const errors: CacheValidationErrors = {};

  for (const field of endpoint.fields ?? []) {
    if (!field.required) continue;

    const raw = values[field.name] ?? "";

    if (field.type === "idList") {
      if (parseIdList(raw).length === 0) {
        errors[field.name] = "emptyList";
      }

      continue;
    }

    if (!raw.trim()) {
      errors[field.name] = "required";
    }
  }

  return errors;
};

export const hasValidationErrors = (errors: CacheValidationErrors): boolean =>
  Object.keys(errors).length > 0;

/** Blank starting values so inputs stay controlled from first render. */
export const getInitialFieldValues = (endpoint: CacheEndpointConfig): CacheFieldValues =>
  Object.fromEntries((endpoint.fields ?? []).map(field => [field.name, ""]));
