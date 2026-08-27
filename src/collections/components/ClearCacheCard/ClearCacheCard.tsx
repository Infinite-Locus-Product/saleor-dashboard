import { clearCollectionCache } from "@dashboard/collections/api/clearCacheApi";
import { DashboardCard } from "@dashboard/components/Card";
import { useNotifier } from "@dashboard/hooks/useNotifier";
import { Button, Text } from "@saleor/macaw-ui-next";
import { useState } from "react";
import { useIntl } from "react-intl";

interface ClearCacheCardProps {
  collectionId?: string;
}

export const ClearCacheCard = ({ collectionId }: ClearCacheCardProps) => {
  const intl = useIntl();
  const notify = useNotifier();
  const [loading, setLoading] = useState(false);

  const handleClearCache = async () => {
    if (!collectionId) {
      return;
    }

    setLoading(true);

    try {
      await clearCollectionCache({ collectionId });

      notify({
        status: "success",
        text: intl.formatMessage({
          id: "G8lXTE",
          defaultMessage: "Cache cleared for this collection",
        }),
      });
    } catch (error) {
      notify({
        status: "error",
        text: intl.formatMessage({
          id: "KdXSjE",
          defaultMessage: "Failed to clear cache",
        }),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardCard>
      <DashboardCard.Header>
        <DashboardCard.Title>
          {intl.formatMessage({
            id: "HhBgTr",
            defaultMessage: "Cache",
            description: "clear cache card title",
          })}
        </DashboardCard.Title>
      </DashboardCard.Header>
      <DashboardCard.Content>
        <Text display="block" marginBottom={3} color="default2">
          {intl.formatMessage({
            id: "V0PsYT",
            defaultMessage: "Clear the cached products for this collection.",
          })}
        </Text>
        <Button
          variant="primary"
          onClick={handleClearCache}
          disabled={loading || !collectionId}
          data-test-id="clear-collection-cache-button"
        >
          {intl.formatMessage({
            id: "NeNJH+",
            defaultMessage: "Clear cache",
            description: "clear collection cache button",
          })}
        </Button>
      </DashboardCard.Content>
    </DashboardCard>
  );
};
