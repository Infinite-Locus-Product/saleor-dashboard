/**
 * "Restrict to cohort(s)" card on the voucher details page (TTXY-4841, L6–L8).
 * Presentational: state and saving live in useVoucherCohortRestriction, and the
 * voucher page saves it together with the voucher form.
 */
import { fetchCohorts } from "@dashboard/cohorts/api/cohortsApi";
import { CohortErrorText } from "@dashboard/cohorts/components/CohortErrorText";
import { DashboardCard } from "@dashboard/components/Card";
import { Multiselect } from "@dashboard/components/Combobox";
import { Box, Button, Input, type Option, Text } from "@saleor/macaw-ui-next";
import { Trash2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";

import { rowErrorMessages, voucherCohortMessages } from "./messages";
import {
  type CohortRestrictionRow,
  MAX_HOLDOUT_PCT,
  MAX_REPEAT_WINDOW_DAYS,
  newRow,
  type RowErrors,
  validateRows,
  type VoucherWindow,
} from "./model";
import { type VoucherCohortRestrictionController } from "./useVoucherCohortRestriction";
import styles from "./VoucherCohortRestrictionCard.module.css";

const SEARCH_PAGE_SIZE = 20;

interface VoucherCohortRestrictionCardProps {
  controller: VoucherCohortRestrictionController;
  /** The voucher's dates as currently in the form (L7 validates against these). */
  voucherWindow: VoucherWindow;
  disabled?: boolean;
  /** Called after the user changes the card, so the page can mark its form as changed. */
  onChange?: () => void;
}

/** Search existing cohorts on GET /cohorts; only results can be picked (no free text). */
const useCohortOptions = () => {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);

  const search = useCallback((query: string) => {
    latest.current += 1;

    const request = latest.current;

    setLoading(true);
    setFailed(false);
    // Only active cohorts can gate a coupon; inactive ones would never let anyone redeem it.
    fetchCohorts({ q: query.trim() || undefined, status: true, limit: SEARCH_PAGE_SIZE })
      .then(result => {
        if (request !== latest.current) return;

        setOptions(
          (result?.items ?? []).map(cohort => ({
            value: String(cohort.id),
            label: cohort.cohort_name,
          })),
        );
      })
      .catch(() => {
        if (request === latest.current) setFailed(true);
      })
      .finally(() => {
        if (request === latest.current) setLoading(false);
      });
  }, []);

  return { options, loading, failed, search };
};

const FieldError = ({ error, testId }: { error?: RowErrors[keyof RowErrors]; testId: string }) => {
  const intl = useIntl();

  if (!error) return null;

  return (
    <Text size={2} color="critical1" data-test-id={testId} role="alert">
      {intl.formatMessage(rowErrorMessages[error])}
    </Text>
  );
};

const CohortRow = ({
  row,
  errors,
  defaultTemplateEvent,
  disabled,
  onChange,
  onRemove,
}: {
  row: CohortRestrictionRow;
  errors: RowErrors;
  defaultTemplateEvent: string | null;
  disabled: boolean;
  onChange: (next: CohortRestrictionRow) => void;
  onRemove: () => void;
}) => {
  const intl = useIntl();
  const set = (patch: Partial<CohortRestrictionRow>) => onChange({ ...row, ...patch });

  return (
    <Box className={styles.row} data-test-id="voucher-cohort-row">
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2}>
        <Text fontWeight="medium">{row.cohortName}</Text>
        <Button
          type="button"
          variant="tertiary"
          icon={<Trash2 size={16} />}
          aria-label={intl.formatMessage(voucherCohortMessages.remove, { name: row.cohortName })}
          title={intl.formatMessage(voucherCohortMessages.remove, { name: row.cohortName })}
          disabled={disabled}
          onClick={onRemove}
          data-test-id="voucher-cohort-remove"
        />
      </Box>
      <Box className={styles.fields}>
        <Box display="grid" gap={1}>
          <Input
            type="datetime-local"
            label={intl.formatMessage(voucherCohortMessages.startLabel)}
            value={row.start}
            error={!!errors.start}
            disabled={disabled}
            helperText={intl.formatMessage(voucherCohortMessages.windowHelp)}
            onChange={event => set({ start: event.target.value })}
            data-test-id="voucher-cohort-start"
          />
          <FieldError error={errors.start} testId="voucher-cohort-start-error" />
        </Box>
        <Box display="grid" gap={1}>
          <Input
            type="datetime-local"
            label={intl.formatMessage(voucherCohortMessages.endLabel)}
            value={row.end}
            error={!!errors.end}
            disabled={disabled}
            helperText={intl.formatMessage(voucherCohortMessages.windowHelp)}
            onChange={event => set({ end: event.target.value })}
            data-test-id="voucher-cohort-end"
          />
          <FieldError error={errors.end} testId="voucher-cohort-end-error" />
        </Box>
        <Box display="grid" gap={1}>
          <Input
            label={intl.formatMessage(voucherCohortMessages.templateLabel)}
            value={row.templateEvent}
            placeholder={defaultTemplateEvent ?? undefined}
            maxLength={64}
            error={!!errors.templateEvent}
            disabled={disabled}
            helperText={
              defaultTemplateEvent
                ? intl.formatMessage(voucherCohortMessages.templateHelpWithDefault, {
                    template: defaultTemplateEvent,
                  })
                : intl.formatMessage(voucherCohortMessages.templateHelp)
            }
            onChange={event => set({ templateEvent: event.target.value })}
            data-test-id="voucher-cohort-template"
          />
          <FieldError error={errors.templateEvent} testId="voucher-cohort-template-error" />
        </Box>
        <Box display="grid" gap={1}>
          <Input
            type="number"
            min={0}
            max={MAX_HOLDOUT_PCT}
            step={1}
            label={intl.formatMessage(voucherCohortMessages.holdoutLabel)}
            value={row.holdoutPct}
            error={!!errors.holdoutPct}
            disabled={disabled}
            helperText={intl.formatMessage(voucherCohortMessages.holdoutHelp)}
            onChange={event => set({ holdoutPct: event.target.value })}
            data-test-id="voucher-cohort-holdout"
          />
          <FieldError error={errors.holdoutPct} testId="voucher-cohort-holdout-error" />
        </Box>
        <Box display="grid" gap={1}>
          <Input
            type="number"
            min={1}
            max={MAX_REPEAT_WINDOW_DAYS}
            step={1}
            label={intl.formatMessage(voucherCohortMessages.repeatLabel)}
            value={row.repeatWindowDays}
            error={!!errors.repeatWindowDays}
            disabled={disabled}
            helperText={intl.formatMessage(voucherCohortMessages.repeatHelp)}
            onChange={event => set({ repeatWindowDays: event.target.value })}
            data-test-id="voucher-cohort-repeat"
          />
          <FieldError error={errors.repeatWindowDays} testId="voucher-cohort-repeat-error" />
        </Box>
      </Box>
    </Box>
  );
};

export const VoucherCohortRestrictionCard = ({
  controller,
  voucherWindow,
  disabled = false,
  onChange,
}: VoucherCohortRestrictionCardProps) => {
  const intl = useIntl();
  const { options, loading, failed, search } = useCohortOptions();
  const { status, rows, setRows } = controller;
  const busy = disabled || controller.saving;
  const errors = useMemo(() => validateRows(rows, voucherWindow), [rows, voucherWindow]);

  const updateRows = (next: CohortRestrictionRow[]) => {
    setRows(next);
    onChange?.();
  };

  const handlePick = (picked: unknown) => {
    const list: Option[] = Array.isArray(picked) ? picked : [];

    updateRows(
      list.map(
        option =>
          rows.find(row => String(row.cohortId) === String(option.value)) ??
          newRow(Number(option.value), String(option.label)),
      ),
    );
  };

  const selected: Option[] = rows.map(row => ({
    value: String(row.cohortId),
    label: row.cohortName,
  }));

  return (
    <DashboardCard data-test-id="voucher-cohort-card">
      <DashboardCard.Header>
        <DashboardCard.Title>{intl.formatMessage(voucherCohortMessages.title)}</DashboardCard.Title>
      </DashboardCard.Header>
      <DashboardCard.Content>
        <Box display="grid" gap={3} paddingBottom={4}>
          <Text size={2} color="default2">
            {intl.formatMessage(voucherCohortMessages.help)}
          </Text>

          {status === "loading" && (
            <Text aria-live="polite">{intl.formatMessage(voucherCohortMessages.loading)}</Text>
          )}

          {status === "unavailable" && controller.loadError && (
            <Box data-test-id="voucher-cohort-unavailable">
              <CohortErrorText error={controller.loadError} />
            </Box>
          )}

          {status === "error" && controller.loadError && (
            <Box display="grid" gap={2} data-test-id="voucher-cohort-load-error">
              <CohortErrorText error={controller.loadError} />
              <Box>
                <Button type="button" variant="secondary" onClick={controller.reload}>
                  {intl.formatMessage(voucherCohortMessages.retry)}
                </Button>
              </Box>
            </Box>
          )}

          {status === "ready" && (
            <>
              <Multiselect
                size="medium"
                label={intl.formatMessage(voucherCohortMessages.pickerLabel)}
                value={selected}
                options={options}
                loading={loading}
                fetchOptions={search}
                alwaysFetchOnFocus
                disabled={busy}
                onChange={event => handlePick(event.target.value)}
                data-test-id="voucher-cohort-picker"
              >
                <Multiselect.NoOptions size={3} padding={1}>
                  {intl.formatMessage(voucherCohortMessages.noOptions)}
                </Multiselect.NoOptions>
              </Multiselect>
              {failed && (
                <Text size={2} color="critical1">
                  {intl.formatMessage(voucherCohortMessages.searchError)}
                </Text>
              )}
              {rows.length === 0 ? (
                <Text size={2} color="default2" data-test-id="voucher-cohort-empty">
                  {intl.formatMessage(voucherCohortMessages.empty)}
                </Text>
              ) : (
                rows.map(row => (
                  <CohortRow
                    key={row.cohortId}
                    row={row}
                    errors={errors[row.cohortId] ?? {}}
                    defaultTemplateEvent={controller.defaultTemplateEvent}
                    disabled={busy}
                    onChange={next =>
                      updateRows(rows.map(item => (item.cohortId === row.cohortId ? next : item)))
                    }
                    onRemove={() => updateRows(rows.filter(item => item.cohortId !== row.cohortId))}
                  />
                ))
              )}
            </>
          )}

          <Box aria-live="polite">
            {controller.saveError && (
              <CohortErrorText error={controller.saveError} testId="voucher-cohort-save-error" />
            )}
          </Box>
        </Box>
      </DashboardCard.Content>
    </DashboardCard>
  );
};
