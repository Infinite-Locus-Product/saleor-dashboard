// TTXY-4841 — loads the rule field catalog (GET /cohorts/rule-fields) once it is needed.
// PR #19 C6 — a failed or empty load can be retried without reloading the page.
import { fetchRuleFields } from "@dashboard/cohorts/api/cohortsApi";
import { type CohortErrorView, describeCohortError } from "@dashboard/cohorts/errors";
import { type RuleFieldDefinition } from "@dashboard/cohorts/types";
import { useCallback, useEffect, useState } from "react";

export interface RuleFieldsState {
  fields: RuleFieldDefinition[];
  loading: boolean;
  error: CohortErrorView | null;
  /** True once the catalog loaded and has at least one field. */
  ready: boolean;
  /** Requests the catalog again (after a failed or empty load). */
  retry: () => void;
}

/** Nothing is requested until `enabled` (e.g. the Dynamic type is chosen). */
export const useRuleFields = (enabled: boolean): RuleFieldsState => {
  const [fields, setFields] = useState<RuleFieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CohortErrorView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || loaded) return;

    let cancelled = false;

    setLoading(true);
    setError(null);
    fetchRuleFields()
      .then(catalog => {
        if (cancelled) return;

        const list = Array.isArray(catalog) ? catalog : [];

        setFields(list);
        setLoaded(true);

        // An empty catalog would leave the builder with nothing to pick.
        if (list.length === 0) {
          setError(describeCohortError("ruleFields", new Error("The rule field catalog is empty")));
        }
      })
      .catch(err => {
        if (!cancelled) setError(describeCohortError("ruleFields", err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, loaded, attempt]);

  const retry = useCallback(() => {
    setLoaded(false);
    setAttempt(run => run + 1);
  }, []);

  return { fields, loading, error, ready: loaded && fields.length > 0, retry };
};
