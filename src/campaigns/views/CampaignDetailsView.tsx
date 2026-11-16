/**
 * Campaign funnel page (TTXY-4841, L9, L10): summary, messaged vs holdout
 * funnel with conversion per stage, result metrics and a CSV export that goes
 * through the cohort API client (same auth headers as every other call).
 */
import { downloadCampaignFunnelCsv, fetchCampaignFunnel } from "@dashboard/cohorts/api/cohortsApi";
import { CohortErrorText } from "@dashboard/cohorts/components/CohortErrorText";
import { type CohortErrorView, describeCohortError } from "@dashboard/cohorts/errors";
import { formatIstDateTime } from "@dashboard/cohorts/lastSynced";
import { type CampaignFunnel, type FunnelMetrics } from "@dashboard/cohorts/types";
import { TopNav } from "@dashboard/components/AppLayout";
import { DashboardCard } from "@dashboard/components/Card";
import { DetailPageLayout } from "@dashboard/components/Layouts";
import { Box, Button, Text } from "@saleor/macaw-ui-next";
import { Download } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { type MessageDescriptor, useIntl } from "react-intl";

import { CampaignFunnelTable } from "../components/CampaignFunnelTable";
import { formatGmv, formatLift, formatRate } from "../format";
import { buildFunnelRows } from "../funnel";
import { campaignMessages, campaignStatusMessages } from "../messages";
import { campaignListUrl } from "../urls";
import styles from "./CampaignDetailsView.module.css";

interface CampaignDetailsViewProps {
  id: string;
}

type MetricKey = keyof FunnelMetrics;

const METRICS: Array<{ key: MetricKey; label: MessageDescriptor }> = [
  { key: "purchase_lift", label: campaignMessages.purchaseLift },
  { key: "repeat_lift", label: campaignMessages.repeatLift },
  { key: "reactivation_rate", label: campaignMessages.reactivationRate },
  { key: "redemption_rate", label: campaignMessages.redemptionRate },
  { key: "incremental_gmv", label: campaignMessages.incrementalGmv },
];

/** Saves a Blob under `filename` via a temporary object URL. */
const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after the click has been handled (Firefox needs the URL a moment longer).
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <DashboardCard>
    <DashboardCard.Header>
      <DashboardCard.Title>{title}</DashboardCard.Title>
    </DashboardCard.Header>
    <DashboardCard.Content>
      <Box display="grid" gap={3} paddingBottom={4}>
        {children}
      </Box>
    </DashboardCard.Content>
  </DashboardCard>
);

export const CampaignDetailsView = ({ id }: CampaignDetailsViewProps) => {
  const intl = useIntl();
  const [funnel, setFunnel] = useState<CampaignFunnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<CohortErrorView | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<CohortErrorView | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    fetchCampaignFunnel(id)
      .then(result => {
        if (!cancelled) setFunnel(result);
      })
      .catch(err => {
        if (!cancelled) setError(describeCohortError("funnel", err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const rows = useMemo(() => (funnel ? buildFunnelRows(funnel) : []), [funnel]);

  const handleExport = async () => {
    if (exporting) return;

    setExporting(true);
    setExportError(null);

    try {
      const { blob, filename } = await downloadCampaignFunnelCsv(id);

      saveBlob(blob, filename);
    } catch (err) {
      setExportError(describeCohortError("csv", err));
    } finally {
      setExporting(false);
    }
  };

  const title = intl.formatMessage(campaignMessages.campaignNumber, { id });
  const campaign = funnel?.campaign;
  const metricValue = (key: MetricKey, value: number | null) =>
    key === "incremental_gmv"
      ? formatGmv(intl, value)
      : key.endsWith("_lift")
        ? formatLift(intl, value)
        : formatRate(intl, value);

  return (
    <DetailPageLayout gridTemplateColumns={1}>
      <TopNav href={campaignListUrl()} title={title}>
        {funnel && (
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={exporting}
            data-test-id="campaign-export-csv"
          >
            <Download size={16} />
            {intl.formatMessage(
              exporting ? campaignMessages.exporting : campaignMessages.exportCsv,
            )}
          </Button>
        )}
      </TopNav>

      <DetailPageLayout.Content>
        <Box paddingX={6} paddingY={4} display="grid" gap={4}>
          <Box aria-live="polite">
            {exportError && <CohortErrorText error={exportError} testId="campaign-export-error" />}
          </Box>

          {loading && (
            <Text aria-live="polite">{intl.formatMessage(campaignMessages.loading)}</Text>
          )}

          {!loading && error && <CohortErrorText error={error} testId="campaign-error" />}

          {!loading && funnel && campaign && (
            <>
              <Section title={intl.formatMessage(campaignMessages.summaryTitle)}>
                <Box display="grid" gap={1} data-test-id="campaign-summary">
                  <Text>
                    {intl.formatMessage(campaignMessages.colVoucher)}:{" "}
                    <Text fontWeight="medium">{campaign.voucher_code}</Text>
                  </Text>
                  <Text>
                    {intl.formatMessage(campaignMessages.colCohort)}:{" "}
                    <Text fontWeight="medium">{campaign.cohort_name}</Text>
                  </Text>
                  <Text>
                    {intl.formatMessage(campaignMessages.colWindow)}:{" "}
                    {formatIstDateTime(intl, campaign.start_time)} –{" "}
                    {campaign.end_time
                      ? formatIstDateTime(intl, campaign.end_time)
                      : intl.formatMessage(campaignMessages.openEnded)}
                  </Text>
                  <Text>
                    {intl.formatMessage(campaignMessages.colStatus)}:{" "}
                    {campaignStatusMessages[campaign.status]
                      ? intl.formatMessage(campaignStatusMessages[campaign.status])
                      : campaign.status}
                  </Text>
                  {campaign.blocked_reason && (
                    <Text color="critical1">
                      {intl.formatMessage(campaignMessages.blockedReason, {
                        reason: campaign.blocked_reason,
                      })}
                    </Text>
                  )}
                </Box>
              </Section>

              <Section title={intl.formatMessage(campaignMessages.funnelTitle)}>
                <Text size={2} color="default2">
                  {intl.formatMessage(campaignMessages.funnelHelp)}
                </Text>
                <CampaignFunnelTable rows={rows} groups={funnel.groups} />
              </Section>

              <Section title={intl.formatMessage(campaignMessages.metricsTitle)}>
                <dl className={styles.metrics} data-test-id="campaign-metrics">
                  {METRICS.map(({ key, label }) => (
                    <div key={key} className={styles.metric} data-test-id={`metric-${key}`}>
                      <dt>
                        <Text color="default2">{intl.formatMessage(label)}</Text>
                      </dt>
                      <dd>
                        <Text fontWeight="medium">
                          {metricValue(key, funnel.metrics?.[key] ?? null)}
                        </Text>
                      </dd>
                    </div>
                  ))}
                </dl>
              </Section>
            </>
          )}
        </Box>
      </DetailPageLayout.Content>
    </DetailPageLayout>
  );
};
