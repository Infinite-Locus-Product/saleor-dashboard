/**
 * Funnel table rows for the campaign page (TTXY-4841, LLD §4.5, HLD §5.6).
 *
 * `null` (or a stage the backend flags as untracked) means "not tracked or not
 * applicable" and is never shown as 0 (L10). Conversion is a stage's count over
 * the previous *tracked* stage of the same group, so an untracked stage in the
 * middle (e.g. delivered) does not break the chain.
 */
import {
  type CampaignFunnel,
  FUNNEL_STAGES,
  type FunnelGroup,
  type FunnelStage,
} from "@dashboard/cohorts/types";

export interface FunnelCell {
  count: number | null;
  conversion: number | null;
}

export interface FunnelRow {
  stage: FunnelStage;
  messaged: FunnelCell;
  holdout: FunnelCell;
}

const groupCells = (
  group: FunnelGroup | undefined,
  tracked: CampaignFunnel["tracked"],
): FunnelCell[] => {
  let previous: number | null = null;

  return FUNNEL_STAGES.map(stage => {
    const raw = group?.stages?.[stage];
    const count = tracked?.[stage] === false || typeof raw !== "number" ? null : raw;

    if (count === null) return { count: null, conversion: null };

    const conversion = previous !== null && previous > 0 ? count / previous : null;

    previous = count;

    return { count, conversion };
  });
};

export const buildFunnelRows = (funnel: CampaignFunnel): FunnelRow[] => {
  const messaged = groupCells(funnel.groups?.messaged, funnel.tracked);
  const holdout = groupCells(funnel.groups?.holdout, funnel.tracked);

  return FUNNEL_STAGES.map((stage, index) => ({
    stage,
    messaged: messaged[index],
    holdout: holdout[index],
  }));
};
