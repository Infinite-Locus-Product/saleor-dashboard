// TTXY-4841 — the details page of a dynamic cohort shows and edits its rules (L5);
// server rule errors land on the right condition (L4); the type stays read-only.
import Wrapper from "@test/wrapper";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { ApiError } from "../api/apiError";
import { fetchCohort, fetchRuleFields, updateCohort } from "../api/cohortsApi";
import { type Cohort, type RuleFieldDefinition } from "../types";
import { CohortDetailsView } from "./CohortDetailsView";

jest.mock("../api/cohortsApi", () => ({
  deleteCohort: jest.fn(),
  fetchCohort: jest.fn(),
  fetchCohortCoupons: jest.fn(),
  fetchRuleFields: jest.fn(),
  syncCohort: jest.fn(),
  updateCohort: jest.fn(),
  uploadCohortCsv: jest.fn(),
}));

jest.mock("@dashboard/hooks/useNavigator", () => ({
  __esModule: true,
  default: () => jest.fn(),
}));

jest.mock("@dashboard/components/AppLayout", () => ({
  TopNav: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

jest.mock("@dashboard/components/Savebar", () => {
  const Root = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

  return {
    Savebar: Object.assign(Root, {
      Spacer: () => null,
      CancelButton: () => null,
      ConfirmButton: ({ form, disabled }: { form: string; disabled: boolean }) => (
        <button type="submit" form={form} disabled={disabled} data-test-id="cohort-save">
          Save
        </button>
      ),
    }),
  };
});

const fetchCohortMock = fetchCohort as jest.MockedFunction<typeof fetchCohort>;
const fetchRuleFieldsMock = fetchRuleFields as jest.MockedFunction<typeof fetchRuleFields>;
const updateCohortMock = updateCohort as jest.MockedFunction<typeof updateCohort>;

const fields: RuleFieldDefinition[] = [
  { field: "city", type: "text", operators: ["equals", "includes"] },
  { field: "order_count", type: "number", operators: ["equals", "greater_than", "between"] },
];

const dynamicCohort = (over: Partial<Cohort> = {}): Cohort => ({
  id: 7,
  cohort_code: "C7",
  cohort_name: "Jaipur repeaters",
  description: null,
  type: "dynamic",
  status: true,
  created_date: "2026-11-01T00:00:00Z",
  end_date: null,
  message_batch_size: 100,
  sync_frequency_hours: 1,
  member_count: 40,
  last_synced_at: null,
  last_sync_status: null,
  last_sync_attempt_at: null,
  last_sync_error: null,
  rules: {
    logic: "AND",
    conditions: [
      { field: "city", operator: "equals", value: "jaipur" },
      { field: "order_count", operator: "greater_than", value: 2 },
    ],
  },
  ...over,
});

const renderView = async () => {
  render(
    <Wrapper>
      <CohortDetailsView id="7" />
    </Wrapper>,
  );
  await screen.findByTestId("cohort-sync-now");
};

const detailsForm = () => document.querySelector("form#cohort-details-form") as HTMLFormElement;

describe("CohortDetailsView — dynamic cohorts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchRuleFieldsMock.mockResolvedValue(fields);
  });

  it("L5 — shows the saved rules, no CSV card, and the type read-only", async () => {
    // Arrange
    fetchCohortMock.mockResolvedValue(dynamicCohort());

    // Act
    await renderView();

    // Assert
    expect(await screen.findByTestId("rule-builder")).toBeInTheDocument();
    expect(screen.getAllByTestId("rule-condition")).toHaveLength(2);
    expect(screen.getByDisplayValue("jaipur")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();
    expect(screen.queryByTestId("cohort-csv-input")).not.toBeInTheDocument();
    expect(screen.getByTestId("cohort-type-readonly")).toBeDisabled();
  });

  it("L5 — an edited rule is PATCHed with the other fields", async () => {
    // Arrange
    fetchCohortMock.mockResolvedValue(dynamicCohort());
    updateCohortMock.mockImplementation(async (_id, input) =>
      dynamicCohort({ rules: input.rules ?? null }),
    );
    await renderView();
    await screen.findByTestId("rule-builder");

    // Act
    fireEvent.change(screen.getByDisplayValue("2"), { target: { value: "5" } });
    fireEvent.submit(detailsForm());

    // Assert
    await waitFor(() => expect(updateCohortMock).toHaveBeenCalledTimes(1));
    expect(updateCohortMock.mock.calls[0][1].rules).toEqual({
      logic: "AND",
      conditions: [
        { field: "city", operator: "equals", value: "jaipur" },
        { field: "order_count", operator: "greater_than", value: 5 },
      ],
    });
  });

  it("L5 — unchanged rules are not re-sent", async () => {
    // Arrange
    fetchCohortMock.mockResolvedValue(dynamicCohort());
    updateCohortMock.mockResolvedValue(dynamicCohort());
    await renderView();
    await screen.findByTestId("rule-builder");

    // Act
    fireEvent.submit(detailsForm());

    // Assert
    await waitFor(() => expect(updateCohortMock).toHaveBeenCalledTimes(1));
    expect(updateCohortMock.mock.calls[0][1]).not.toHaveProperty("rules");
  });

  it("L4 — removing every rule blocks the save with 'Add at least one rule'", async () => {
    // Arrange
    fetchCohortMock.mockResolvedValue(dynamicCohort());
    await renderView();
    await screen.findByTestId("rule-builder");

    // Act
    screen.getAllByTestId("rule-remove").forEach(button => fireEvent.click(button));
    fireEvent.submit(detailsForm());

    // Assert
    expect(await screen.findByText("Add at least one rule")).toBeInTheDocument();
    expect(updateCohortMock).not.toHaveBeenCalled();
  });

  it("L4 — a server invalid_rule error is shown on the matching condition", async () => {
    // Arrange
    fetchCohortMock.mockResolvedValue(dynamicCohort());
    updateCohortMock.mockRejectedValue(
      new ApiError({
        status: 400,
        serverMessage: "Rule is invalid",
        code: "invalid_rule",
        details: [{ path: "conditions[1].operator", message: "operator not allowed" }],
      }),
    );
    await renderView();
    await screen.findByTestId("rule-builder");
    fireEvent.change(screen.getByDisplayValue("2"), { target: { value: "3" } });

    // Act
    fireEvent.submit(detailsForm());

    // Assert
    const rows = screen.getAllByTestId("rule-condition");

    expect(await within(rows[1]).findByText("operator not allowed")).toBeInTheDocument();
    expect(within(rows[0]).queryByTestId("rule-error")).not.toBeInTheDocument();
  });

  it("L5 — a static cohort has no rule builder and never loads the catalog", async () => {
    // Arrange
    fetchCohortMock.mockResolvedValue(dynamicCohort({ type: "static", rules: null }));

    // Act
    await renderView();

    // Assert
    expect(screen.queryByTestId("rule-builder")).not.toBeInTheDocument();
    expect(fetchRuleFieldsMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("cohort-csv-input")).toBeInTheDocument();
  });
});
