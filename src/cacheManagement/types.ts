import { type MessageDescriptor } from "react-intl";

/**
 * Logical grouping shown as a section in the dashboard. Order of the union has
 * no meaning — display order lives in config/categories.ts.
 */
export type CacheCategoryId =
  | "slugs"
  | "inventory"
  | "generic"
  | "navbar"
  | "testimonial"
  | "thankYou"
  | "rating"
  | "exchangeReasons"
  | "taggbox";

export type CacheHttpMethod = "GET" | "POST" | "DELETE";

/** Where a field's value is placed on the outgoing request. */
export type CacheFieldTarget = "body" | "query";

interface CacheFieldCommon {
  name: string;
  label: MessageDescriptor;
  helpText?: MessageDescriptor;
  required?: boolean;
}

/** Single-line free text, sent verbatim. */
export interface CacheTextField extends CacheFieldCommon {
  type: "text";
  placeholder?: string;
}

/**
 * Multi-line list of ids. The user types one id per line (or comma separated)
 * and the request builder emits a string[].
 */
export interface CacheIdListField extends CacheFieldCommon {
  type: "idList";
  placeholder?: string;
}

/** Fixed set of allowed values — the only way an enum payload can be supplied. */
export interface CacheSelectField extends CacheFieldCommon {
  type: "select";
  options: Array<{ value: string; label: MessageDescriptor }>;
}

export type CacheField = CacheTextField | CacheIdListField | CacheSelectField;

/** Raw form state. Every field is edited as a string; idList splits on submit. */
export type CacheFieldValues = Record<string, string>;

export interface CacheConfirmationConfig {
  title: MessageDescriptor;
  description: MessageDescriptor;
}

/**
 * Declarative description of one cache operation. The registry in
 * config/endpoints.ts is the single source of truth: cards, forms and
 * validation are all derived from these objects, so adding an endpoint never
 * requires new JSX.
 */
export interface CacheEndpointConfig {
  id: string;
  category: CacheCategoryId;
  title: MessageDescriptor;
  description: MessageDescriptor;
  method: CacheHttpMethod;
  /** Path appended to the TenxYou base url, e.g. "/saleor/clear-cache". */
  path: string;
  /** Sends the admin bearer key instead of the staff token. */
  requiresAdmin?: boolean;
  /** Renders a destructive-styled card and forces a confirmation dialog. */
  destructive?: boolean;
  confirmation?: CacheConfirmationConfig;
  fields?: CacheField[];
  /** Defaults to "body". Ignored when there are no fields. */
  fieldTarget?: CacheFieldTarget;
  /** Merged into the JSON body ahead of field values, e.g. { scope: "all" }. */
  staticBody?: Record<string, unknown>;
  /** Overrides the default "Clear cache" button label. */
  actionLabel?: MessageDescriptor;
}

export interface CacheCategoryConfig {
  id: CacheCategoryId;
  label: MessageDescriptor;
  description: MessageDescriptor;
}

/** Shape produced by the request builder and consumed by the fetch layer. */
export interface CacheRequestDescriptor {
  url: string;
  method: CacheHttpMethod;
  body?: Record<string, unknown>;
}

export type CacheExecutionStatus = "success" | "error";

export interface CacheExecutionResult {
  status: CacheExecutionStatus;
  /** HTTP status, or 0 when the request never reached the server. */
  httpStatus: number;
  /** Parsed JSON when available, otherwise the raw text wrapped in an object. */
  response: unknown;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  errorMessage?: string;
}

/** Field name → error code, resolved to a message at render time. */
export type CacheValidationErrors = Record<string, CacheValidationErrorCode>;

export type CacheValidationErrorCode = "required" | "emptyList";
