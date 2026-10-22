// TTXY-4699 PR #5 C3 — turn a thrown cohort API failure into translated copy.
// Known backend outcomes get their own message; everything else falls back to
// the action's generic message, with the server text kept only as detail.
import { type MessageDescriptor } from "react-intl";

import { isApiError, NETWORK_ERROR_STATUS } from "./api/apiError";
import { cohortMessages } from "./messages";

export type CohortAction =
  | "list"
  | "load"
  | "create"
  | "update"
  | "upload"
  | "sync"
  | "coupons"
  | "delete";

export interface CohortErrorView {
  message: MessageDescriptor;
  /** Secondary text (usually the server's own message); null when the message says it all. */
  detail: string | null;
}

const fallbackMessages: Record<CohortAction, MessageDescriptor> = {
  list: cohortMessages.loadError,
  load: cohortMessages.loadCohortError,
  create: cohortMessages.createError,
  update: cohortMessages.updateError,
  upload: cohortMessages.csvError,
  sync: cohortMessages.syncError,
  coupons: cohortMessages.deleteCouponsError,
  delete: cohortMessages.deleteError,
};

const mappedMessage = (action: CohortAction, status: number): MessageDescriptor | null => {
  if (status === NETWORK_ERROR_STATUS) return cohortMessages.networkError;

  // C16 — signed in with MANAGE_DISCOUNTS but not in the cohort permission group.
  if (status === 403) return cohortMessages.noCohortAccess;

  // C16 — the whole cohort API answers 404 while COHORT_COUPONS_ENABLED is off.
  if (action === "list" && status === 404) return cohortMessages.cohortsNotEnabled;

  if (action === "load" && status === 404) return cohortMessages.notFound;

  if (action === "sync" && status === 409) return cohortMessages.syncNotAllowed;

  // The dialog already lists the coupons, so the server's list is not repeated.
  if (action === "delete" && status === 409) return cohortMessages.deleteUsedByCoupons;

  if (action === "delete" && status === 502) return cohortMessages.deleteUntagFailed;

  return null;
};

export const describeCohortError = (action: CohortAction, error: unknown): CohortErrorView => {
  if (isApiError(error)) {
    const mapped = mappedMessage(action, error.status);

    if (mapped) return { message: mapped, detail: null };

    return { message: fallbackMessages[action], detail: error.serverMessage };
  }

  return {
    message: fallbackMessages[action],
    detail: error instanceof Error && error.message ? error.message : null,
  };
};
