import { TopNav } from "@dashboard/components/AppLayout/TopNav";
import { DashboardCard } from "@dashboard/components/Card";
import { Placeholder } from "@dashboard/components/Placeholder";
import { ResponsiveTable } from "@dashboard/components/ResponsiveTable";
import TableRowLink from "@dashboard/components/TableRowLink";
import { useGiftCardBatchesQuery } from "@dashboard/graphql";
import { renderCollection } from "@dashboard/misc";
import { TableBody, TableCell, TableHead } from "@material-ui/core";
import { Box, Input, Skeleton } from "@saleor/macaw-ui-next";
import { useState } from "react";
import { useIntl } from "react-intl";

import { giftCardBatchUrl, giftCardsListPath } from "../urls";
import { giftCardBatchesMessages as messages } from "./messages";

// A batch is a gift card tag; its row opens the gift cards list filtered to that tag.
export const GiftCardBatchesPage = (): JSX.Element => {
  const intl = useIntl();
  const [search, setSearch] = useState("");
  const { data } = useGiftCardBatchesQuery({ variables: { search } });
  const batches = data?.giftCardTags?.edges.map(edge => edge.node);

  return (
    <>
      <TopNav href={giftCardsListPath} title={intl.formatMessage(messages.title)} />
      <DashboardCard>
        <DashboardCard.Content>
          <Box paddingY={4}>
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={intl.formatMessage(messages.searchPlaceholder)}
              width="100%"
            />
          </Box>
          {batches?.length === 0 ? (
            <Placeholder>{intl.formatMessage(messages.noBatches)}</Placeholder>
          ) : (
            <ResponsiveTable>
              <TableHead>
                <TableRowLink>
                  <TableCell>{intl.formatMessage(messages.batchTag)}</TableCell>
                  <TableCell align="right">
                    {intl.formatMessage(messages.vouchersCreated)}
                  </TableCell>
                  <TableCell align="right">{intl.formatMessage(messages.totalIssued)}</TableCell>
                  <TableCell align="right">{intl.formatMessage(messages.redeemed)}</TableCell>
                </TableRowLink>
              </TableHead>
              <TableBody>
                {renderCollection(batches, batch => (
                  <TableRowLink
                    hover={!!batch}
                    href={batch && giftCardBatchUrl(batch.name)}
                    key={batch ? batch.id : "skeleton"}
                  >
                    <TableCell>{batch?.name ?? <Skeleton />}</TableCell>
                    <TableCell align="right">{batch ? batch.stats.count : <Skeleton />}</TableCell>
                    <TableCell align="right">
                      {batch ? intl.formatNumber(batch.stats.issuedAmount) : <Skeleton />}
                    </TableCell>
                    <TableCell align="right">
                      {batch ? (
                        intl.formatNumber(batch.stats.issuedAmount - batch.stats.balanceAmount)
                      ) : (
                        <Skeleton />
                      )}
                    </TableCell>
                  </TableRowLink>
                ))}
              </TableBody>
            </ResponsiveTable>
          )}
        </DashboardCard.Content>
      </DashboardCard>
    </>
  );
};
