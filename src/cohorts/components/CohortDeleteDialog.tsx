// TTXY-6199 — delete confirmation that knows which coupons use the cohort.
// A cohort used by any coupon cannot be deleted (PRD Epic 9), so Confirm stays
// disabled until the lookup has come back empty.
import ActionDialog from "@dashboard/components/ActionDialog";
import { Box, Text } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

import { type CohortErrorView } from "../errors";
import { cohortMessages } from "../messages";
import { type CohortLinkedCoupon } from "../types";
import { CohortErrorText } from "./CohortErrorText";

export interface CohortDeleteDialogProps {
  open: boolean;
  cohortName: string;
  memberCount: number;
  /** null while the lookup is in flight (or after it failed). */
  coupons: CohortLinkedCoupon[] | null;
  lookupError: CohortErrorView | null;
  deleteError: CohortErrorView | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const CohortDeleteDialog = ({
  open,
  cohortName,
  memberCount,
  coupons,
  lookupError,
  deleteError,
  deleting,
  onClose,
  onConfirm,
}: CohortDeleteDialogProps) => {
  const intl = useIntl();
  const blocked = !!coupons && coupons.length > 0;
  const canDelete = !!coupons && coupons.length === 0 && !lookupError;

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={intl.formatMessage(cohortMessages.deleteCohort)}
      variant="delete"
      disabled={!canDelete || deleting}
      confirmButtonState={deleting ? "loading" : "default"}
      // Without this, ConfirmButton ignores `disabled` after a failed delete.
      confirmButtonNoTransition
    >
      {/* polite live region: loading, results and errors are announced as they change */}
      <Box data-test-id="cohort-delete-dialog" display="grid" gap={2} aria-live="polite">
        {lookupError && <CohortErrorText error={lookupError} />}

        {!coupons && !lookupError && (
          <Text data-test-id="cohort-delete-loading">
            {intl.formatMessage(cohortMessages.deleteCouponsLoading)}
          </Text>
        )}

        {blocked && (
          <Box data-test-id="cohort-delete-blocked" display="grid" gap={2}>
            <Text>
              {intl.formatMessage(cohortMessages.deleteBlocked, {
                name: cohortName,
                count: coupons.length,
              })}
            </Text>
            <Box as="ul" maxHeight={52} overflowY="auto">
              {coupons.map(coupon => (
                <Box as="li" key={coupon.voucherId}>
                  <Text size={2}>{coupon.voucherCode || coupon.voucherId}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {canDelete && (
          <Text data-test-id="cohort-delete-confirm-text">
            {intl.formatMessage(cohortMessages.deleteConfirm, {
              name: cohortName,
              count: memberCount,
            })}
          </Text>
        )}

        {deleteError && <CohortErrorText error={deleteError} testId="cohort-delete-error" />}
      </Box>
    </ActionDialog>
  );
};
