// TTXY-4699 PR #5 C8 — Create must never submit twice, nor submit an emptied
// name after a failed create. The real Savebar ConfirmButton is used (only the
// portal root is stubbed), since its loading -> default cycle is the root cause.
import Wrapper from "@test/wrapper";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ApiError } from "../api/apiError";
import { createCohort } from "../api/cohortsApi";
import { type Cohort } from "../types";
import { cohortUrl } from "../urls";
import { CohortCreateView } from "./CohortCreateView";

jest.mock("../api/cohortsApi", () => ({
  createCohort: jest.fn(),
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
  const actions = jest.requireActual("@dashboard/components/Savebar/SavebarActionButtons");
  const Root = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

  return {
    Savebar: Object.assign(Root, {
      Spacer: () => null,
      CancelButton: actions.CancelButton,
      ConfirmButton: actions.ConfirmButton,
    }),
  };
});

const createCohortMock = createCohort as jest.MockedFunction<typeof createCohort>;

const createdCohort: Cohort = {
  id: 11,
  cohort_code: "C11",
  cohort_name: "VIP",
  description: null,
  type: "static",
  status: false,
  created_date: "2026-10-22T00:00:00Z",
  end_date: null,
  message_batch_size: 100,
  sync_frequency_hours: 1,
  member_count: 0,
  last_synced_at: null,
  last_sync_status: null,
  last_sync_attempt_at: null,
  last_sync_error: null,
};

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

const renderView = () =>
  render(
    <Wrapper>
      <CohortCreateView />
    </Wrapper>,
  );

const nameInput = (): HTMLInputElement =>
  (screen.getByTestId("cohort-name").querySelector("input") ??
    screen.getByTestId("cohort-name")) as HTMLInputElement;
const createButton = () => screen.getByTestId("button-bar-confirm");
const createForm = () => document.querySelector("form#cohort-create-form") as HTMLFormElement;

describe("CohortCreateView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("C8 — a second submit while a create is in flight is ignored", async () => {
    // Arrange
    const pending = deferred<Cohort>();

    createCohortMock.mockReturnValue(pending.promise);
    renderView();
    fireEvent.change(nameInput(), { target: { value: "VIP" } });

    // Act
    fireEvent.submit(createForm());
    fireEvent.submit(createForm());

    // Assert
    pending.resolve(createdCohort);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(cohortUrl(11)));
    expect(createCohortMock).toHaveBeenCalledTimes(1);
  });

  it("C8 — Create with an emptied name after a failed create is blocked", async () => {
    // Arrange — the first create fails (duplicate name)
    createCohortMock.mockRejectedValueOnce(
      new ApiError({ status: 409, serverMessage: "Cohort name already exists" }),
    );
    renderView();
    fireEvent.change(nameInput(), { target: { value: "VIP" } });
    fireEvent.click(createButton());
    expect(await screen.findByTestId("cohort-create-error")).toBeInTheDocument();
    await waitFor(() => expect(createCohortMock).toHaveBeenCalledTimes(1));

    // Act — the name is cleared to blanks and Create is pressed again
    fireEvent.change(nameInput(), { target: { value: "   " } });
    fireEvent.click(createButton());
    fireEvent.submit(createForm());

    // Assert
    expect(createButton()).toBeDisabled();
    expect(createCohortMock).toHaveBeenCalledTimes(1);
  });
});
