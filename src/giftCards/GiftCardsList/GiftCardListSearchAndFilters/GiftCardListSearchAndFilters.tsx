// @ts-strict-ignore
import { ListFilters } from "@dashboard/components/AppLayout/ListFilters";
import DeleteFilterTabDialog from "@dashboard/components/DeleteFilterTabDialog";
import SaveFilterTabDialog from "@dashboard/components/SaveFilterTabDialog";
import { Box } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

import { GiftCardListBulkActions } from "../GiftCardListBulkActions";
import { useGiftCardListDialogs } from "../providers/GiftCardListDialogsProvider";
import { useGiftCardList } from "../providers/GiftCardListProvider";
import { GiftCardListActionParamsEnum } from "../types";
import { giftCardListSearchAndFiltersMessages as messages } from "./messages";

const GiftCardListSearchAndFilters = () => {
  const intl = useIntl();

  const {
    params,
    handleSearchChange,
    onPresetSave,
    onPresetDelete,
    getPresetNameToDelete,
    selectedRowIds,
  } = useGiftCardList();
  const { onClose } = useGiftCardListDialogs();

  return (
    <>
      <ListFilters
        type="expression-filter"
        initialSearch={params?.query || ""}
        onSearchChange={handleSearchChange}
        searchPlaceholder={intl.formatMessage(messages.searchPlaceholder)}
        actions={
          <Box display="flex" gap={4}>
            {selectedRowIds.length > 0 && (
              // Gift vouchers are never deleted, so their history is kept.
              <GiftCardListBulkActions />
            )}
          </Box>
        }
      />

      <SaveFilterTabDialog
        open={params.action === GiftCardListActionParamsEnum.SAVE_SEARCH}
        confirmButtonState="default"
        onClose={onClose}
        onSubmit={onPresetSave}
      />

      <DeleteFilterTabDialog
        open={params.action === GiftCardListActionParamsEnum.DELETE_SEARCH}
        confirmButtonState="default"
        onClose={onClose}
        onSubmit={onPresetDelete}
        tabName={getPresetNameToDelete()}
      />
    </>
  );
};

export default GiftCardListSearchAndFilters;
