import { CacheManagementPage } from "@dashboard/cacheManagement/components/CacheManagementPage/CacheManagementPage";
import { cacheManagementMessages } from "@dashboard/cacheManagement/messages";
import { WindowTitle } from "@dashboard/components/WindowTitle";
import { useIntl } from "react-intl";

export const CacheManagementView = () => {
  const intl = useIntl();

  return (
    <>
      <WindowTitle title={intl.formatMessage(cacheManagementMessages.title)} />
      <CacheManagementPage />
    </>
  );
};
