// TTXY-4699 PR #5 (C1, C2, C3, C5, C7, C8, C9, C11) — view-level behaviour of the cohort
// detail page with the REST client mocked: Sync now / CSV upload must not wipe
// unsaved edits, the delete dialog never offers a stale Confirm, and backend
// failures are shown as mapped copy.
import Wrapper from "@test/wrapper";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ApiError } from "../api/apiError";
import {
  deleteCohort,
  fetchCohort,
  fetchCohortCoupons,
  syncCohort,
  updateCohort,
  uploadCohortCsv,
} from "../api/cohortsApi";
import { cohortMessages } from "../messages";
import {
  type Cohort,
  type CohortIngestSummary,
  type CohortLinkedCoupon,
  type CohortSyncResult,
} from "../types";
import { CohortDetailsView } from "./CohortDetailsView";

jest.mock("../api/cohortsApi", () => ({
  deleteCohort: jest.fn(),
  fetchCohort: jest.fn(),
  fetchCohortCoupons: jest.fn(),
  syncCohort: jest.fn(),
  updateCohort: jest.fn(),
  uploadCohortCsv: jest.fn(),
}));

const mockNavigate = jest.fn();

jest.mock("@dashboard/hooks/useNavigator", () => ({
  __esModule: true,
  default: () => mockNavigate,
}));

jest.mock("@dashboard/components/AppLayout", () => ({
  TopNav: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

jest.mock("@dashboard/components/Savebar", () => {
  const Root = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

  return {
    Savebar: Object.assign(Root, {
      Spacer: () => null,
      CancelButton: ({ onClick }: { onClick: () => void }) => (
        <button type="button" onClick={onClick}>
          Cancel
        </button>
      ),
      ConfirmButton: ({
        form,
        disabled,
        noTransition,
      }: {
        form: string;
        disabled: boolean;
        noTransition?: boolean;
      }) => (
        <button
          type="submit"
          form={form}
          disabled={disabled}
          data-no-transition={noTransition ? "true" : "false"}
          data-test-id="cohort-save"
        >
          Save
        </button>
      ),
    }),
  };
});

const fetchCohortMock = fetchCohort as jest.MockedFunction<typeof fetchCohort>;
const fetchCouponsMock = fetchCohortCoupons as jest.MockedFunction<typeof fetchCohortCoupons>;
const syncCohortMock = syncCohort as jest.MockedFunction<typeof syncCohort>;
const deleteCohortMock = deleteCohort as jest.MockedFunction<typeof deleteCohort>;
const updateCohortMock = updateCohort as jest.MockedFunction<typeof updateCohort>;
const uploadCsvMock = uploadCohortCsv as jest.MockedFunction<typeof uploadCohortCsv>;

const cohortFixture = (over: Partial<Cohort> = {}): Cohort => ({
  id: 7,
  cohort_code: "C7",
  cohort_name: "include821",
  description: "old description",
  type: "static",
  status: true,
  created_date: "2026-10-01T00:00:00Z",
  end_date: null,
  message_batch_size: 100,
  sync_frequency_hours: 1,
  member_count: 12,
  last_synced_at: null,
  last_sync_status: null,
  last_sync_attempt_at: null,
  last_sync_error: null,
  ...over,
});

const syncResult: CohortSyncResult = {
  cohortId: 7,
  cohortName: "include821",
  added: 3,
  skipped: 1,
  notFound: 0,
  errors: 0,
};

const linkedCoupons: CohortLinkedCoupon[] = [
  { voucherId: "V1", voucherCode: "FLAT100", startTime: null, endTime: null },
];

/** A promise the test resolves by hand, to observe in-flight UI. */
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const renderView = async () => {
  render(
    <Wrapper>
      <CohortDetailsView id="7" />
    </Wrapper>,
  );
  await screen.findByTestId("cohort-sync-now");
};

const syncButton = () => screen.getByTestId("cohort-sync-now");
const descriptionInput = (): HTMLInputElement =>
  screen.getByDisplayValue(/description|edited/) as HTMLInputElement;
const confirmButton = () => screen.getByTestId("submit");
const detailsForm = () => document.querySelector("form#cohort-details-form") as HTMLFormElement;
const csvFile = () => new File(["phone\n9990000001\n"], "cohort.csv", { type: "text/csv" });

describe("CohortDetailsView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Sync now", () => {
    it("C1 — keeps an unsaved description edit and refreshes the last-sync display", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValueOnce(cohortFixture()).mockResolvedValueOnce(
        cohortFixture({
          last_synced_at: "2026-10-22T05:30:00Z",
          last_sync_status: "success",
          last_sync_attempt_at: "2026-10-22T05:30:00Z",
        }),
      );
      syncCohortMock.mockResolvedValue(syncResult);
      await renderView();
      expect(screen.getByText(cohortMessages.neverSynced.defaultMessage)).toBeInTheDocument();
      fireEvent.change(descriptionInput(), { target: { value: "edited but not saved" } });

      // Act
      fireEvent.click(syncButton());

      // Assert
      expect(await screen.findByTestId("cohort-sync-result")).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByText(cohortMessages.neverSynced.defaultMessage)).toBeNull(),
      );
      // C12 — the time goes through the IST message (react-intl is mocked in jest)
      expect(screen.getByText(cohortMessages.istDateTime.defaultMessage)).toBeInTheDocument();
      expect(descriptionInput().value).toBe("edited but not saved");
    });

    it("C1 — is disabled while a sync is in flight", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());

      const pending = deferred<CohortSyncResult>();

      syncCohortMock.mockReturnValue(pending.promise);
      await renderView();

      // Act
      fireEvent.click(syncButton());

      // Assert
      await waitFor(() => expect(syncButton()).toBeDisabled());
      pending.resolve(syncResult);
      await waitFor(() => expect(syncButton()).toBeEnabled());
      expect(syncCohortMock).toHaveBeenCalledTimes(1);
    });

    it("C1 — is disabled while a save is in flight", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());

      const pending = deferred<Cohort>();

      updateCohortMock.mockReturnValue(pending.promise);
      await renderView();

      // Act
      fireEvent.click(screen.getByTestId("cohort-save"));

      // Assert
      await waitFor(() => expect(syncButton()).toBeDisabled());
      pending.resolve(cohortFixture({ description: "saved" }));
      await waitFor(() => expect(syncButton()).toBeEnabled());
    });

    it("C3 — a 409 shows the 'must be active and not past its end date' message", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());
      syncCohortMock.mockRejectedValue(
        new ApiError({ status: 409, serverMessage: "Cohort 7 is not active" }),
      );
      await renderView();

      // Act
      fireEvent.click(syncButton());

      // Assert
      const error = await screen.findByTestId("cohort-sync-error");

      expect(error).toHaveTextContent(cohortMessages.syncNotAllowed.defaultMessage);
      expect(error).not.toHaveTextContent("Cohort 7 is not active");
    });

    it("C6 — sync result and error are rendered inside a polite live region", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());
      syncCohortMock.mockResolvedValue(syncResult);
      await renderView();

      // Act
      fireEvent.click(syncButton());

      // Assert
      const result = await screen.findByTestId("cohort-sync-result");

      expect(result.closest('[aria-live="polite"]')).not.toBeNull();
    });

    it("C7d — warns when the refresh after a sync fails instead of swallowing it", async () => {
      // Arrange
      fetchCohortMock
        .mockResolvedValueOnce(cohortFixture())
        .mockRejectedValueOnce(new ApiError({ status: 0, serverMessage: null }));
      syncCohortMock.mockResolvedValue(syncResult);
      await renderView();

      // Act
      fireEvent.click(syncButton());

      // Assert
      expect(await screen.findByTestId("cohort-refresh-warning")).toHaveTextContent(
        cohortMessages.refreshWarning.defaultMessage,
      );
    });

    it("C7a — an active cohort past its end date shows the expired hint", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(
        cohortFixture({ status: true, end_date: "2020-01-01T00:00:00Z" }),
      );

      // Act
      await renderView();

      // Assert
      expect(syncButton()).toBeDisabled();
      expect(screen.getByText(cohortMessages.syncExpiredHelp.defaultMessage)).toBeInTheDocument();
      expect(screen.queryByText(cohortMessages.syncInactiveHelp.defaultMessage)).toBeNull();
    });

    it("an inactive cohort keeps the 'activate to sync' hint", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture({ status: false }));

      // Act
      await renderView();

      // Assert
      expect(syncButton()).toBeDisabled();
      expect(screen.getByText(cohortMessages.syncInactiveHelp.defaultMessage)).toBeInTheDocument();
    });
  });

  describe("Save", () => {
    it("C8 — the Save button opts out of the ConfirmButton transition", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());

      // Act
      await renderView();

      // Assert — without noTransition, ConfirmButton ignores `disabled` after a save
      expect(screen.getByTestId("cohort-save")).toHaveAttribute("data-no-transition", "true");
    });

    it("C8 — a second submit while a save is in flight is ignored", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());

      const pending = deferred<Cohort>();

      updateCohortMock.mockReturnValue(pending.promise);
      await renderView();

      // Act
      fireEvent.submit(detailsForm());
      fireEvent.submit(detailsForm());

      // Assert
      pending.resolve(cohortFixture({ description: "saved" }));
      await waitFor(() => expect(screen.getByTestId("cohort-save")).toBeEnabled());
      expect(updateCohortMock).toHaveBeenCalledTimes(1);
    });

    it("C9 — a refresh that started after a save started is applied after the save lands", async () => {
      // Arrange — empty cohort; the save is slow, a CSV upload lands meanwhile
      const refresh = deferred<Cohort>();

      fetchCohortMock
        .mockResolvedValueOnce(cohortFixture({ member_count: 0 }))
        .mockReturnValueOnce(refresh.promise);

      const save = deferred<Cohort>();

      updateCohortMock.mockReturnValue(save.promise);
      uploadCsvMock.mockResolvedValue({ total: 40, valid: 40, invalid: 0, sample: [] });
      await renderView();
      expect(screen.getByText(cohortMessages.nameRenameHelp.defaultMessage)).toBeInTheDocument();

      // Act — save starts, then the upload + its refresh start
      fireEvent.submit(detailsForm());
      fireEvent.change(screen.getByTestId("cohort-csv-input"), { target: { files: [csvFile()] } });
      await waitFor(() => expect(fetchCohortMock).toHaveBeenCalledTimes(2));
      save.resolve(cohortFixture({ member_count: 0, description: "saved" }));
      await waitFor(() => expect(screen.getByTestId("cohort-save")).toBeEnabled());
      refresh.resolve(cohortFixture({ member_count: 40, description: "saved" }));

      // Assert — the newer member_count wins (name is now locked)
      expect(
        await screen.findByText(cohortMessages.nameLockedHelp.defaultMessage),
      ).toBeInTheDocument();
    });

    it("C9 — a refresh that started before a save is dropped once the save starts", async () => {
      // Arrange — the refresh is slow and carries an older inactive status
      const refresh = deferred<Cohort>();

      fetchCohortMock.mockResolvedValueOnce(cohortFixture()).mockReturnValueOnce(refresh.promise);
      uploadCsvMock.mockResolvedValue({ total: 1, valid: 1, invalid: 0, sample: [] });
      updateCohortMock.mockResolvedValue(cohortFixture({ description: "saved", status: true }));
      await renderView();
      fireEvent.change(screen.getByTestId("cohort-csv-input"), { target: { files: [csvFile()] } });
      await waitFor(() => expect(fetchCohortMock).toHaveBeenCalledTimes(2));

      // Act — save starts and lands, then the stale refresh resolves
      fireEvent.submit(detailsForm());
      await waitFor(() => expect(updateCohortMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByTestId("cohort-save")).toBeEnabled());
      refresh.resolve(cohortFixture({ status: false }));
      await screen.findByTestId("cohort-csv-summary");

      // Assert — the saved (active) record is kept
      await waitFor(() => expect(syncButton()).toBeEnabled());
      expect(screen.queryByText(cohortMessages.syncInactiveHelp.defaultMessage)).toBeNull();
    });
  });

  describe("CSV upload", () => {
    it("C1 — refreshes the member count without wiping an unsaved edit", async () => {
      // Arrange
      fetchCohortMock
        .mockResolvedValueOnce(cohortFixture())
        .mockResolvedValueOnce(cohortFixture({ member_count: 40 }));

      const summary: CohortIngestSummary = { total: 28, valid: 28, invalid: 0, sample: [] };

      uploadCsvMock.mockResolvedValue(summary);
      await renderView();
      fireEvent.change(descriptionInput(), { target: { value: "edited but not saved" } });

      // Act
      fireEvent.change(screen.getByTestId("cohort-csv-input"), { target: { files: [csvFile()] } });

      // Assert
      expect(await screen.findByTestId("cohort-csv-summary")).toBeInTheDocument();
      await waitFor(() => expect(fetchCohortMock).toHaveBeenCalledTimes(2));
      expect(descriptionInput().value).toBe("edited but not saved");
    });
  });

  describe("delete dialog", () => {
    const openDialog = () => fireEvent.click(screen.getByTestId("cohort-delete"));

    it("C5 — shows loading with Confirm disabled, then lists linked coupons (still disabled)", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());

      const lookup = deferred<CohortLinkedCoupon[]>();

      fetchCouponsMock.mockReturnValue(lookup.promise);
      await renderView();

      // Act
      openDialog();

      // Assert — loading
      expect(await screen.findByTestId("cohort-delete-loading")).toBeInTheDocument();
      expect(confirmButton()).toBeDisabled();

      // Act
      lookup.resolve(linkedCoupons);

      // Assert — blocked
      expect(await screen.findByText("FLAT100")).toBeInTheDocument();
      expect(confirmButton()).toBeDisabled();
    });

    it("C5 — an unused cohort enables Confirm and deletes, then navigates to the list", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());
      fetchCouponsMock.mockResolvedValue([]);
      deleteCohortMock.mockResolvedValue({ deleted: true, id: 7 });
      await renderView();
      openDialog();
      await screen.findByTestId("cohort-delete-confirm-text");

      // Act
      fireEvent.click(confirmButton());

      // Assert
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/cohorts/list"));
      expect(deleteCohortMock).toHaveBeenCalledWith("7");
    });

    it("C5 — a failed coupon lookup shows the mapped error and keeps Confirm disabled", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());
      fetchCouponsMock.mockRejectedValue(new ApiError({ status: 0, serverMessage: null }));
      await renderView();

      // Act
      openDialog();

      // Assert
      expect(
        await screen.findByText(cohortMessages.networkError.defaultMessage),
      ).toBeInTheDocument();
      expect(confirmButton()).toBeDisabled();
    });

    it("C2 — reopening never shows a stale enabled Confirm before the new lookup returns", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());
      fetchCouponsMock.mockResolvedValueOnce([]);
      await renderView();
      openDialog();
      await screen.findByTestId("cohort-delete-confirm-text");
      expect(confirmButton()).toBeEnabled();
      fireEvent.click(screen.getByTestId("back"));
      await waitFor(() => expect(screen.queryByTestId("cohort-delete-dialog")).toBeNull());

      const second = deferred<CohortLinkedCoupon[]>();

      fetchCouponsMock.mockReturnValueOnce(second.promise);

      // Act
      openDialog();

      // Assert — first render after reopen is the loading state
      expect(screen.getByTestId("cohort-delete-loading")).toBeInTheDocument();
      expect(confirmButton()).toBeDisabled();
      second.resolve(linkedCoupons);
      expect(await screen.findByText("FLAT100")).toBeInTheDocument();
      expect(confirmButton()).toBeDisabled();
    });

    it("C2/C3 — a delete 409 shows the mapped message and re-runs the coupon lookup", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());
      fetchCouponsMock.mockResolvedValueOnce([]);
      deleteCohortMock.mockRejectedValue(
        new ApiError({ status: 409, serverMessage: "Cohort is used by 1 coupon(s): FLAT100" }),
      );

      const relookup = deferred<CohortLinkedCoupon[]>();

      fetchCouponsMock.mockReturnValueOnce(relookup.promise);
      await renderView();
      openDialog();
      await screen.findByTestId("cohort-delete-confirm-text");

      // Act
      fireEvent.click(confirmButton());

      // Assert — mapped message, Confirm disabled while the lookup re-runs
      const error = await screen.findByTestId("cohort-delete-error");

      expect(error).toHaveTextContent(cohortMessages.deleteUsedByCoupons.defaultMessage);
      await waitFor(() => expect(fetchCouponsMock).toHaveBeenCalledTimes(2));
      expect(confirmButton()).toBeDisabled();

      // Act
      relookup.resolve(linkedCoupons);

      // Assert — the coupon now shows and Confirm stays disabled
      expect(await screen.findByText("FLAT100")).toBeInTheDocument();
      expect(confirmButton()).toBeDisabled();
    });

    it("C11 — a delete 409 error is cleared when the re-run lookup comes back empty", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());
      fetchCouponsMock.mockResolvedValueOnce([]);
      deleteCohortMock.mockRejectedValue(
        new ApiError({ status: 409, serverMessage: "Cohort is used by 1 coupon(s): FLAT100" }),
      );

      const relookup = deferred<CohortLinkedCoupon[]>();

      fetchCouponsMock.mockReturnValueOnce(relookup.promise);
      await renderView();
      openDialog();
      await screen.findByTestId("cohort-delete-confirm-text");
      fireEvent.click(confirmButton());
      await screen.findByTestId("cohort-delete-error");

      // Act — the coupon was unlinked in the meantime
      relookup.resolve([]);

      // Assert
      await waitFor(() => expect(screen.queryByTestId("cohort-delete-error")).toBeNull());
      expect(confirmButton()).toBeEnabled();
    });

    it("C11 — a delete network error is kept when the re-run lookup comes back empty", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());
      fetchCouponsMock.mockResolvedValue([]);
      deleteCohortMock.mockRejectedValueOnce(new ApiError({ status: 0, serverMessage: null }));
      await renderView();
      openDialog();
      await screen.findByTestId("cohort-delete-confirm-text");

      // Act
      fireEvent.click(confirmButton());

      // Assert
      await waitFor(() => expect(fetchCouponsMock).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(confirmButton()).toBeEnabled());
      expect(screen.getByTestId("cohort-delete-error")).toHaveTextContent(
        cohortMessages.networkError.defaultMessage,
      );
    });

    it("C3 — a delete 502 explains nothing was deleted and allows a retry once the lookup is empty", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture());
      fetchCouponsMock.mockResolvedValue([]);
      deleteCohortMock.mockRejectedValueOnce(
        new ApiError({ status: 502, serverMessage: "untag failed for 3 members" }),
      );
      await renderView();
      openDialog();
      await screen.findByTestId("cohort-delete-confirm-text");

      // Act
      fireEvent.click(confirmButton());

      // Assert
      expect(await screen.findByTestId("cohort-delete-error")).toHaveTextContent(
        cohortMessages.deleteUntagFailed.defaultMessage,
      );
      await waitFor(() => expect(fetchCouponsMock).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(confirmButton()).toBeEnabled());
      // C11 — only a 409 is cleared by an empty lookup; the 502 explanation stays
      expect(screen.getByTestId("cohort-delete-error")).toHaveTextContent(
        cohortMessages.deleteUntagFailed.defaultMessage,
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // PR #5 C17 — an expired cohort can only be reactivated with a new future
  // end_date, so the end date is shown and editable.
  describe("end date", () => {
    const endDateInput = (): HTMLInputElement =>
      screen.getByTestId("cohort-end-date") as HTMLInputElement;

    it("renders the current end date as its IST day, with the formatted value", async () => {
      // Arrange — 20:00 UTC Dec 31 is Jan 1 in IST
      fetchCohortMock.mockResolvedValue(cohortFixture({ end_date: "2099-12-31T20:00:00Z" }));

      // Act
      await renderView();

      // Assert
      expect(endDateInput().value).toBe("2100-01-01");
      expect(endDateInput()).toHaveAttribute("type", "date");
      expect(screen.getByTestId("cohort-end-date-current")).toBeInTheDocument();
    });

    it("says there is no end date when none is set", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture({ end_date: null }));

      // Act
      await renderView();

      // Assert
      expect(endDateInput().value).toBe("");
      expect(screen.getByText(cohortMessages.endDateNone.defaultMessage)).toBeInTheDocument();
    });

    it("sends an edited end date in the Save PATCH", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture({ end_date: "2099-06-30T18:29:59.999Z" }));
      updateCohortMock.mockResolvedValue(cohortFixture({ end_date: "2099-07-31T18:29:59.999Z" }));
      await renderView();

      // Act
      fireEvent.change(endDateInput(), { target: { value: "2099-07-31" } });
      fireEvent.submit(detailsForm());

      // Assert
      await waitFor(() => expect(updateCohortMock).toHaveBeenCalledTimes(1));
      expect(updateCohortMock).toHaveBeenCalledWith(
        "7",
        expect.objectContaining({ end_date: "2099-07-31" }),
      );
    });

    it("clearing the end date sends null", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture({ end_date: "2099-06-30T18:29:59.999Z" }));
      updateCohortMock.mockResolvedValue(cohortFixture({ end_date: null }));
      await renderView();

      // Act
      fireEvent.change(endDateInput(), { target: { value: "" } });
      fireEvent.submit(detailsForm());

      // Assert
      await waitFor(() => expect(updateCohortMock).toHaveBeenCalledTimes(1));
      expect(updateCohortMock.mock.calls[0][1]).toHaveProperty("end_date", null);
    });

    it("leaves end_date out of the PATCH when it was not changed", async () => {
      // Arrange — re-sending a past date would be rejected (400) by the backend,
      // which would block every other edit of an expired cohort.
      fetchCohortMock.mockResolvedValue(
        cohortFixture({ status: false, end_date: "2020-01-01T00:00:00Z" }),
      );
      updateCohortMock.mockResolvedValue(cohortFixture({ description: "edited" }));
      await renderView();

      // Act
      fireEvent.change(descriptionInput(), { target: { value: "edited" } });
      fireEvent.submit(detailsForm());

      // Assert
      await waitFor(() => expect(updateCohortMock).toHaveBeenCalledTimes(1));
      expect(updateCohortMock.mock.calls[0][1]).not.toHaveProperty("end_date");
    });

    it("shows the reactivation hint for a cohort past its end date", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(
        cohortFixture({ status: false, end_date: "2020-01-01T00:00:00Z" }),
      );

      // Act
      await renderView();

      // Assert
      expect(
        screen.getByText(cohortMessages.endDateExpiredHint.defaultMessage),
      ).toBeInTheDocument();
    });

    it("does not show the reactivation hint for a future end date", async () => {
      // Arrange
      fetchCohortMock.mockResolvedValue(cohortFixture({ end_date: "2099-12-31T18:29:59.999Z" }));

      // Act
      await renderView();

      // Assert
      expect(screen.queryByText(cohortMessages.endDateExpiredHint.defaultMessage)).toBeNull();
    });
  });
});
