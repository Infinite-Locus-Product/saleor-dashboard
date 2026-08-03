import { executeCacheRequest, getCacheApiBaseUrl } from "@dashboard/cacheManagement/api/cacheApi";
import {
  type CacheEndpointConfig,
  type CacheExecutionResult,
  type CacheFieldValues,
  type CacheValidationErrors,
} from "@dashboard/cacheManagement/types";
import { buildCacheRequest } from "@dashboard/cacheManagement/utils/buildRequest";
import {
  getInitialFieldValues,
  hasValidationErrors,
  validateCacheFields,
} from "@dashboard/cacheManagement/utils/validation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UseCacheActionProps {
  endpoint: CacheEndpointConfig;
  onExecuted?: (result: CacheExecutionResult) => void;
}

export interface UseCacheActionResult {
  values: CacheFieldValues;
  setValue: (name: string, value: string) => void;
  errors: CacheValidationErrors;
  loading: boolean;
  result: CacheExecutionResult | null;
  configError: boolean;
  execute: () => Promise<void>;
}

/** Runs a single endpoint and holds its loading state, errors and response. */
export const useCacheAction = ({
  endpoint,
  onExecuted,
}: UseCacheActionProps): UseCacheActionResult => {
  const initialValues = useMemo(() => getInitialFieldValues(endpoint), [endpoint]);
  const [values, setValues] = useState<CacheFieldValues>(initialValues);
  const [errors, setErrors] = useState<CacheValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CacheExecutionResult | null>(null);

  const baseUrl = getCacheApiBaseUrl();
  const abortRef = useRef<AbortController | null>(null);
  // Guards against a state update after the card unmounts mid-request.
  const mountedRef = useRef(true);
  // Second guard against double submits: `loading` alone can lag behind two
  // clicks dispatched within the same React batch.
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const setValue = useCallback((name: string, value: string) => {
    setValues(current => ({ ...current, [name]: value }));
    setErrors(current => {
      if (!(name in current)) return current;

      const next = { ...current };

      delete next[name];

      return next;
    });
  }, []);

  const execute = useCallback(async () => {
    if (inFlightRef.current || !baseUrl) return;

    const validationErrors = validateCacheFields({ endpoint, values });

    if (hasValidationErrors(validationErrors)) {
      setErrors(validationErrors);

      return;
    }

    const request = buildCacheRequest({ endpoint, values, baseUrl });

    inFlightRef.current = true;
    abortRef.current?.abort();

    const controller = new AbortController();

    abortRef.current = controller;

    setErrors({});
    setLoading(true);

    const executionResult = await executeCacheRequest({
      request,
      requiresAdmin: endpoint.requiresAdmin,
      signal: controller.signal,
    });

    inFlightRef.current = false;

    if (!mountedRef.current) return;

    setLoading(false);
    setResult(executionResult);
    onExecuted?.(executionResult);
  }, [baseUrl, endpoint, onExecuted, values]);

  return {
    values,
    setValue,
    errors,
    loading,
    result,
    configError: !baseUrl,
    execute,
  };
};
