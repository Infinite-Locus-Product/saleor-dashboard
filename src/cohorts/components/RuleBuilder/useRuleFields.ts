// TTXY-4841 — loads the rule field catalog (GET /cohorts/rule-fields) once it is needed.
import { fetchRuleFields } from "@dashboard/cohorts/api/cohortsApi";
import { type CohortErrorView, describeCohortError } from "@dashboard/cohorts/errors";
import { type RuleFieldDefinition } from "@dashboard/cohorts/types";
import { useEffect, useState } from "react";

export interface RuleFieldsState {
  fields: RuleFieldDefinition[];
  loading: boolean;
  error: CohortErrorView | null;
  /** True once the catalog loaded and has at least one field. */
  ready: boolean;
}

/** Nothing is requested until `enabled` (e.g. the Dynamic type is chosen). */
export const useRuleFields = (enabled: boolean): RuleFieldsState => {
  const [fields, setFields] = useState<RuleFieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CohortErrorView | null>(null);
  const [loaded, setLoaded] = useState(false);

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
  }, [enabled, loaded]);

  return { fields, loading, error, ready: loaded && fields.length > 0 };
};
