import { DashboardCard } from "@dashboard/components/Card";
import { useNotifier } from "@dashboard/hooks/useNotifier";
import { rebuildProductVariantCache } from "@dashboard/products/api/rebuildProductCacheApi";
import { Button, Text } from "@saleor/macaw-ui-next";
import { useState } from "react";
import { useIntl } from "react-intl";

interface RebuildCacheCardProps {
  productId?: string;
}

export const RebuildCacheCard = ({ productId }: RebuildCacheCardProps) => {
  const intl = useIntl();
  const notify = useNotifier();
  const [loading, setLoading] = useState(false);

  const handleRebuildCache = async () => {
    if (!productId) {
      return;
    }

    setLoading(true);

    try {
      await rebuildProductVariantCache({ productId });

      notify({
        status: "success",
        text: intl.formatMessage({
          defaultMessage: "Cache rebuilt for this product",
          id: "XPGqvL",
        }),
      });
    } catch (error) {
      notify({
        status: "error",
        text: intl.formatMessage({
          defaultMessage: "Failed to rebuild cache",
          id: "anlSAo",
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
            defaultMessage: "Cache",
            id: "TO2kA6",
            description: "rebuild product cache card title",
          })}
        </DashboardCard.Title>
      </DashboardCard.Header>
      <DashboardCard.Content>
        <Text display="block" marginBottom={3} color="default2">
          {intl.formatMessage({
            defaultMessage: "Rebuild the cached variants for this product.",
            id: "41W+qv",
          })}
        </Text>
        <Button
          variant="primary"
          onClick={handleRebuildCache}
          disabled={loading || !productId}
          data-test-id="rebuild-product-cache-button"
        >
          {intl.formatMessage({
            defaultMessage: "Rebuild cache",
            id: "9ZE+O7",
            description: "rebuild product cache button",
          })}
        </Button>
      </DashboardCard.Content>
    </DashboardCard>
  );
};
