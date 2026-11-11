/**
 * Campaign list (TTXY-4841, L9) — GET /cohorts/campaigns, paginated, with a
 * status filter. Hand-rolled table like the cohort list (REST-backed section).
 */
import { fetchCampaigns } from "@dashboard/cohorts/api/cohortsApi";
import { CohortErrorText } from "@dashboard/cohorts/components/CohortErrorText";
import { type CohortErrorView, describeCohortError } from "@dashboard/cohorts/errors";
import { formatIstDateTime } from "@dashboard/cohorts/lastSynced";
import { type CampaignStatus, type CampaignSummary } from "@dashboard/cohorts/types";
import { TopNav } from "@dashboard/components/AppLayout";
import { DashboardCard } from "@dashboard/components/Card";
import { ListPageLayout } from "@dashboard/components/Layouts";
import { Box, Button, Text } from "@saleor/macaw-ui-next";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

import { campaignMessages, campaignStatusMessages } from "../messages";
import { campaignUrl } from "../urls";
import styles from "./CampaignListView.module.css";

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<CampaignStatus, "success1" | "critical1" | "default2"> = {
  open: "success1",
  blocked: "critical1",
  closed: "default2",
};

export const CampaignListView = () => {
  const intl = useIntl();
  const [rows, setRows] = useState<CampaignSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CampaignStatus | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<CohortErrorView | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    fetchCampaigns({ page, pageSize: PAGE_SIZE, status })
      .then(result => {
        if (cancelled) return;

        setRows(result?.items ?? []);
        setTotal(result?.total ?? 0);
      })
      .catch(err => {
        if (!cancelled) setError(describeCohortError("campaigns", err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, status]);

  const windowText = (campaign: CampaignSummary) =>
    `${formatIstDateTime(intl, campaign.start_time)} – ${
      campaign.end_time
        ? formatIstDateTime(intl, campaign.end_time)
        : intl.formatMessage(campaignMessages.openEnded)
    }`;

  const columns = [
    campaignMessages.colCampaign,
    campaignMessages.colVoucher,
    campaignMessages.colCohort,
    campaignMessages.colWindow,
    campaignMessages.colStatus,
    campaignMessages.colRecipients,
    campaignMessages.colSent,
    campaignMessages.colHoldout,
  ];

  return (
    <ListPageLayout>
      <TopNav title={intl.formatMessage(campaignMessages.listTitle)} />

      <Box paddingX={6} paddingY={4}>
        <DashboardCard>
          <DashboardCard.Content>
            <Box display="flex" gap={4} alignItems="center" paddingY={4}>
              <select
                className={styles.select}
                aria-label={intl.formatMessage(campaignMessages.statusFilterLabel)}
                value={status ?? ""}
                onChange={event => {
                  setStatus((event.target.value || undefined) as CampaignStatus | undefined);
                  setPage(1);
                }}
                data-test-id="campaigns-status-filter"
              >
                <option value="">{intl.formatMessage(campaignMessages.allStatuses)}</option>
                {(Object.keys(campaignStatusMessages) as CampaignStatus[]).map(option => (
                  <option key={option} value={option}>
                    {intl.formatMessage(campaignStatusMessages[option])}
                  </option>
                ))}
              </select>
            </Box>

            {error && (
              <Box paddingY={4}>
                <CohortErrorText error={error} testId="campaigns-error" />
              </Box>
            )}

            {loading ? (
              <Box paddingY={6}>
                <Text aria-live="polite">{intl.formatMessage(campaignMessages.loading)}</Text>
              </Box>
            ) : rows.length === 0 && !error ? (
              <Box paddingY={6} data-test-id="campaigns-empty">
                <Text>{intl.formatMessage(campaignMessages.empty)}</Text>
              </Box>
            ) : rows.length > 0 ? (
              <Box className={styles.scroll}>
                <table className={styles.table} data-test-id="campaigns-table">
                  <thead>
                    <tr>
                      {columns.map(column => (
                        <th key={column.description as string} scope="col">
                          <Text size={2} color="default2">
                            {intl.formatMessage(column)}
                          </Text>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(campaign => (
                      <tr key={campaign.id} data-test-id={`campaign-row-${campaign.id}`}>
                        <td>
                          <Link
                            to={campaignUrl(campaign.id)}
                            data-test-id={`campaign-link-${campaign.id}`}
                          >
                            <Text fontWeight="medium">
                              {intl.formatMessage(campaignMessages.campaignNumber, {
                                id: campaign.id,
                              })}
                            </Text>
                          </Link>
                        </td>
                        <td>
                          <Text>{campaign.voucher_code}</Text>
                        </td>
                        <td>
                          <Text>{campaign.cohort_name}</Text>
                        </td>
                        <td>
                          <Text size={2}>{windowText(campaign)}</Text>
                        </td>
                        <td>
                          <Box display="grid">
                            <Text color={STATUS_COLORS[campaign.status] ?? "default2"}>
                              {campaignStatusMessages[campaign.status]
                                ? intl.formatMessage(campaignStatusMessages[campaign.status])
                                : campaign.status}
                            </Text>
                            {campaign.blocked_reason && (
                              <Text size={2} color="default2">
                                {campaign.blocked_reason}
                              </Text>
                            )}
                          </Box>
                        </td>
                        <td className={styles.number}>
                          <Text>{String(intl.formatNumber(campaign.recipients))}</Text>
                        </td>
                        <td className={styles.number}>
                          <Text>{String(intl.formatNumber(campaign.sent))}</Text>
                        </td>
                        <td className={styles.number}>
                          <Text>{String(intl.formatNumber(campaign.holdout))}</Text>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            ) : null}

            <Box display="flex" justifyContent="space-between" alignItems="center" paddingY={4}>
              <Text size={2} color="default2">
                {intl.formatMessage(campaignMessages.countLabel, { count: total })}
              </Text>
              <Box display="flex" gap={2}>
                <Button
                  variant="secondary"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(current => Math.max(1, current - 1))}
                  data-test-id="campaigns-previous"
                >
                  {intl.formatMessage(campaignMessages.previous)}
                </Button>
                <Button
                  variant="secondary"
                  disabled={page * PAGE_SIZE >= total || loading}
                  onClick={() => setPage(current => current + 1)}
                  data-test-id="campaigns-next"
                >
                  {intl.formatMessage(campaignMessages.next)}
                </Button>
              </Box>
            </Box>
          </DashboardCard.Content>
        </DashboardCard>
      </Box>
    </ListPageLayout>
  );
};
