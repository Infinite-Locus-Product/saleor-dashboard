import { CacheActionCard } from "@dashboard/cacheManagement/components/CacheActionCard/CacheActionCard";
import { cacheCategories } from "@dashboard/cacheManagement/config/categories";
import { cacheEndpoints } from "@dashboard/cacheManagement/config/endpoints";
import { cacheManagementMessages } from "@dashboard/cacheManagement/messages";
import { TopNav } from "@dashboard/components/AppLayout";
import { DetailPageLayout } from "@dashboard/components/Layouts";
import { Box, Text } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

import styles from "./CacheManagementPage.module.css";

export const CacheManagementPage = () => {
  const intl = useIntl();

  return (
    <DetailPageLayout gridTemplateColumns={1} withSavebar={false}>
      <TopNav
        title={intl.formatMessage(cacheManagementMessages.title)}
        subtitle={intl.formatMessage(cacheManagementMessages.subtitle)}
      />
      <DetailPageLayout.Content>
        <Box display="flex" flexDirection="column" gap={6} paddingBottom={10}>
          {cacheCategories.map(category => {
            const endpoints = cacheEndpoints.filter(endpoint => endpoint.category === category.id);

            return (
              <Box key={category.id} display="flex" flexDirection="column" gap={3}>
                <Box display="flex" flexDirection="column" gap={1}>
                  <Text size={5} fontWeight="medium">
                    {intl.formatMessage(category.label)}
                  </Text>
                  <Text size={2} color="default2">
                    {intl.formatMessage(category.description)}
                  </Text>
                </Box>
                <Box className={styles.grid}>
                  {endpoints.map(endpoint => (
                    <CacheActionCard key={endpoint.id} endpoint={endpoint} />
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      </DetailPageLayout.Content>
    </DetailPageLayout>
  );
};
