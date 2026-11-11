// TTXY-4841 — messaged vs holdout funnel with conversion per stage (L9, L10).
import { type CampaignFunnel } from "@dashboard/cohorts/types";
import { Box, Text } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

import { formatConversion, formatGmv, formatStageCount } from "../format";
import { type FunnelCell, type FunnelRow } from "../funnel";
import { campaignMessages, funnelStageMessages } from "../messages";
import styles from "./CampaignFunnelTable.module.css";

interface CampaignFunnelTableProps {
  rows: FunnelRow[];
  groups: CampaignFunnel["groups"];
}

const Cells = ({ cell, group }: { cell: FunnelCell; group: "messaged" | "holdout" }) => {
  const intl = useIntl();

  return (
    <>
      <td className={styles.number} data-test-id={`funnel-${group}-count`}>
        <Text color={cell.count === null ? "default2" : "default1"}>
          {formatStageCount(intl, cell.count)}
        </Text>
      </td>
      <td className={styles.number} data-test-id={`funnel-${group}-conversion`}>
        <Text color="default2">{formatConversion(intl, cell.conversion)}</Text>
      </td>
    </>
  );
};

export const CampaignFunnelTable = ({ rows, groups }: CampaignFunnelTableProps) => {
  const intl = useIntl();
  const headers = [
    campaignMessages.colStage,
    campaignMessages.colMessaged,
    campaignMessages.colMessagedConversion,
    campaignMessages.colHoldoutCount,
    campaignMessages.colHoldoutConversion,
  ];

  return (
    <Box className={styles.scroll}>
      <table className={styles.table} data-test-id="campaign-funnel-table">
        <caption className={styles.caption}>
          {intl.formatMessage(campaignMessages.funnelTitle)}
        </caption>
        <thead>
          <tr>
            {headers.map(header => (
              <th key={header.description as string} scope="col">
                <Text size={2} color="default2">
                  {intl.formatMessage(header)}
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.stage} data-test-id={`funnel-row-${row.stage}`}>
              <th scope="row">
                <Text>{intl.formatMessage(funnelStageMessages[row.stage])}</Text>
              </th>
              <Cells cell={row.messaged} group="messaged" />
              <Cells cell={row.holdout} group="holdout" />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">
              <Text fontWeight="medium">{intl.formatMessage(campaignMessages.groupSize)}</Text>
            </th>
            <td className={styles.number} data-test-id="funnel-group-size-messaged">
              <Text fontWeight="medium">{String(intl.formatNumber(groups.messaged.size))}</Text>
            </td>
            <td />
            <td className={styles.number} data-test-id="funnel-group-size-holdout">
              <Text fontWeight="medium">{String(intl.formatNumber(groups.holdout.size))}</Text>
            </td>
            <td />
          </tr>
          <tr>
            <th scope="row">
              <Text fontWeight="medium">{intl.formatMessage(campaignMessages.groupGmv)}</Text>
            </th>
            <td className={styles.number} data-test-id="funnel-gmv-messaged">
              <Text>{formatGmv(intl, groups.messaged.gmv)}</Text>
            </td>
            <td />
            <td className={styles.number} data-test-id="funnel-gmv-holdout">
              <Text>{formatGmv(intl, groups.holdout.gmv)}</Text>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </Box>
  );
};
