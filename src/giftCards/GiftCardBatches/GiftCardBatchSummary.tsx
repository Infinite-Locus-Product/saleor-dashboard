import { useApolloClient } from "@apollo/client";
import { DashboardCard } from "@dashboard/components/Card";
import { useConditionalFilterContext } from "@dashboard/components/ConditionalFilter";
import { createGiftCardQueryVariables } from "@dashboard/components/ConditionalFilter/queryVariables";
import { Date } from "@dashboard/components/Date/Date";
import Money from "@dashboard/components/Money";
import {
  GiftCardBatchCodesDocument,
  type GiftCardBatchCodesQuery,
  type GiftCardBatchCodesQueryVariables,
  useGiftCardBatchSummaryQuery,
} from "@dashboard/graphql";
import { useNotifier } from "@dashboard/hooks/useNotifier";
import commonErrorMessages from "@dashboard/utils/errors/common";
import { Box, Button, Skeleton, Text } from "@saleor/macaw-ui-next";
import { useState } from "react";
import { useIntl } from "react-intl";

import { giftCardBatchesMessages as messages } from "./messages";

// Gift voucher codes are the batch's 6-letter prefix + 6 random characters.
const PREFIX_LENGTH = 6;

// Shown above the gift cards list when it is filtered to exactly one batch (tag).
export const GiftCardBatchSummary = (): JSX.Element | null => {
  const { valueProvider } = useConditionalFilterContext();
  const tags = createGiftCardQueryVariables(valueProvider.value).tags ?? [];
  const tag = tags.length === 1 ? tags[0] : null;

  if (!tag) {
    return null;
  }

  return <GiftCardBatchSummaryCard tag={tag} />;
};

const GiftCardBatchSummaryCard = ({ tag }: { tag: string }): JSX.Element => {
  const intl = useIntl();
  const client = useApolloClient();
  const notify = useNotifier();
  const [downloading, setDownloading] = useState(false);
  const { data } = useGiftCardBatchSummaryQuery({ variables: { tag } });

  // Fetches every code of the batch (100 per page) and saves them as a CSV file.
  const downloadCodes = async (): Promise<void> => {
    setDownloading(true);

    try {
      const codes: string[] = [];
      let after: string | null = null;
      let hasNextPage = true;

      while (hasNextPage) {
        const { data: page }: { data: GiftCardBatchCodesQuery } = await client.query<
          GiftCardBatchCodesQuery,
          GiftCardBatchCodesQueryVariables
        >({
          query: GiftCardBatchCodesDocument,
          variables: { tag, after },
          fetchPolicy: "network-only",
        });

        codes.push(...(page.giftCards?.edges.map(edge => edge.node.code) ?? []));
        hasNextPage = !!page.giftCards?.pageInfo.hasNextPage;
        after = page.giftCards?.pageInfo.endCursor ?? null;
      }

      const link = document.createElement("a");
      const url = URL.createObjectURL(
        new Blob([["code", ...codes].join("\n")], { type: "text/csv" }),
      );

      link.href = url;
      link.download = `${tag}.csv`;
      link.click();
      // Revoked a moment later: revoking right after the click can cancel the download (Firefox).
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      notify({ status: "error", text: intl.formatMessage(commonErrorMessages.unknownError) });
    } finally {
      setDownloading(false);
    }
  };
  // The tag search matches partially, so pick the exact batch (tags are stored lowercased).
  const stats = data?.giftCardTags?.edges.find(edge => edge.node.name === tag.toLowerCase())?.node
    .stats;
  const firstCard = data?.giftCards?.edges[0]?.node;

  if (!data) {
    return <Skeleton />;
  }

  const rows: Array<[string, React.ReactNode]> = [
    [intl.formatMessage(messages.codePrefix), firstCard?.code.slice(0, PREFIX_LENGTH)],
    [
      intl.formatMessage(messages.valueOfEach),
      firstCard && <Money money={firstCard.initialBalance} />,
    ],
    [intl.formatMessage(messages.created), firstCard && <Date date={firstCard.created} plain />],
    [intl.formatMessage(messages.expiry), firstCard?.expiryDate],
    [intl.formatMessage(messages.vouchersCreated), stats?.count],
    [intl.formatMessage(messages.totalIssued), stats && intl.formatNumber(stats.issuedAmount)],
    [intl.formatMessage(messages.redeemed), stats && intl.formatNumber(stats.redeemedAmount)],
    [
      intl.formatMessage(messages.outstanding),
      stats && intl.formatNumber(stats.activeBalanceAmount),
    ],
    [
      intl.formatMessage(messages.expiredUnused),
      stats && intl.formatNumber(stats.expiredBalanceAmount),
    ],
  ];

  return (
    <DashboardCard>
      <DashboardCard.Header>
        <DashboardCard.Title>
          {intl.formatMessage(messages.summaryTitle, { tag })}
        </DashboardCard.Title>
        <DashboardCard.Toolbar>
          <Button variant="secondary" onClick={downloadCodes} disabled={downloading}>
            {intl.formatMessage(messages.downloadCodes)}
          </Button>
        </DashboardCard.Toolbar>
      </DashboardCard.Header>
      <DashboardCard.Content>
        <Box display="grid" __gridTemplateColumns="repeat(3, 1fr)" gap={4}>
          {rows.map(([label, value]) => (
            <Box key={label}>
              <Text size={2} color="default2">
                {label}
              </Text>
              <Text display="block">{value ?? "-"}</Text>
            </Box>
          ))}
        </Box>
      </DashboardCard.Content>
    </DashboardCard>
  );
};
