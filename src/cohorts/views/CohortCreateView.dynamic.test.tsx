// TTXY-4841 — Static/Dynamic choice on create (L1) and rule validation on save (L4).
import Wrapper from "@test/wrapper";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { ApiError } from "../api/apiError";
import { createCohort, fetchRuleFields } from "../api/cohortsApi";
import { type Cohort, type RuleFieldDefinition } from "../types";
import { cohortUrl } from "../urls";
import { CohortCreateView } from "./CohortCreateView";

jest.mock("../api/cohortsApi", () => ({
  createCohort: jest.fn(),
  fetchRuleFields: jest.fn(),
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
const fetchRuleFieldsMock = fetchRuleFields as jest.MockedFunction<typeof fetchRuleFields>;

const fields: RuleFieldDefinition[] = [
  { field: "city", type: "text", operators: ["equals", "includes"] },
  {
    field: "order_count",
    type: "number",
    operators: ["equals", "greater_than", "between"],
  },
];

const created: Cohort = {
  id: 21,
  cohort_code: "C21",
  cohort_name: "Jaipur repeaters",
  description: null,
  type: "dynamic",
  status: false,
  created_date: "2026-11-12T00:00:00Z",
  end_date: null,
  message_batch_size: 100,
  sync_frequency_hours: 1,
  member_count: 0,
  last_synced_at: null,
  last_sync_status: null,
  last_sync_attempt_at: null,
  last_sync_error: null,
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
const form = () => document.querySelector("form#cohort-create-form") as HTMLFormElement;

const chooseDynamic = async () => {
  fireEvent.click(screen.getByTestId("cohort-type-dynamic"));
  await screen.findByTestId("rule-builder");
};

describe("CohortCreateView — dynamic cohorts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchRuleFieldsMock.mockResolvedValue(fields);
  });

  it("L1 — Static is the default: CSV hint shown, no rule builder, no catalog call", () => {
    // Arrange / Act
    renderView();

    // Assert
    expect(screen.getByTestId("cohort-type-static")).toBeChecked();
    expect(screen.getByTestId("cohort-csv-hint")).toBeInTheDocument();
    expect(screen.queryByTestId("rule-builder")).not.toBeInTheDocument();
    expect(fetchRuleFieldsMock).not.toHaveBeenCalled();
  });

  it("L1 — choosing Dynamic hides the CSV hint and shows the rule builder from /rule-fields", async () => {
    // Arrange
    renderView();

    // Act
    await chooseDynamic();

    // Assert
    expect(screen.queryByTestId("cohort-csv-hint")).not.toBeInTheDocument();
    expect(fetchRuleFieldsMock).toHaveBeenCalledTimes(1);
  });

  it("L1 — saving a dynamic cohort sends type dynamic and the rule tree", async () => {
    // Arrange
    createCohortMock.mockResolvedValue(created);
    renderView();
    fireEvent.change(nameInput(), { target: { value: "Jaipur repeaters" } });
    await chooseDynamic();
    fireEvent.click(screen.getByTestId("rule-add-condition"));
    fireEvent.change(screen.getByTestId("rule-value"), { target: { value: "jaipur" } });

    // Act
    fireEvent.submit(form());

    // Assert
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(cohortUrl(21)));
    expect(createCohortMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cohort_name: "Jaipur repeaters",
        type: "dynamic",
        rules: {
          logic: "AND",
          conditions: [{ field: "city", operator: "equals", value: "jaipur" }],
        },
      }),
    );
  });

  it("L1 — saving a static cohort never sends rules", async () => {
    // Arrange
    createCohortMock.mockResolvedValue({ ...created, type: "static" });
    renderView();
    fireEvent.change(nameInput(), { target: { value: "VIP" } });

    // Act
    fireEvent.submit(form());

    // Assert
    await waitFor(() => expect(createCohortMock).toHaveBeenCalledTimes(1));
    expect(createCohortMock.mock.calls[0][0]).toEqual(expect.objectContaining({ type: "static" }));
    expect(createCohortMock.mock.calls[0][0]).not.toHaveProperty("rules");
  });

  it("L4 — saving with no rules shows 'Add at least one rule' and sends nothing", async () => {
    // Arrange
    renderView();
    fireEvent.change(nameInput(), { target: { value: "Empty" } });
    await chooseDynamic();

    // Act
    fireEvent.submit(form());

    // Assert
    expect(await screen.findByText("Add at least one rule")).toBeInTheDocument();
    expect(createCohortMock).not.toHaveBeenCalled();
  });

  it("L3 — a numeric condition with text blocks the save with 'Enter a number'", async () => {
    // Arrange
    renderView();
    fireEvent.change(nameInput(), { target: { value: "Numbers" } });
    await chooseDynamic();
    fireEvent.click(screen.getByTestId("rule-add-condition"));
    fireEvent.change(screen.getByTestId("rule-field"), { target: { value: "order_count" } });
    fireEvent.change(screen.getByTestId("rule-value"), { target: { value: "two" } });

    // Act
    fireEvent.submit(form());

    // Assert
    expect(await screen.findByText("Enter a number")).toBeInTheDocument();
    expect(createCohortMock).not.toHaveBeenCalled();
  });

  it("L4 — server invalid_rule details appear on the matching condition", async () => {
    // Arrange
    createCohortMock.mockRejectedValue(
      new ApiError({
        status: 400,
        serverMessage: "Rule is invalid",
        code: "invalid_rule",
        details: [{ path: "conditions[1].value", message: "City not recognised" }],
      }),
    );
    renderView();
    fireEvent.change(nameInput(), { target: { value: "Cities" } });
    await chooseDynamic();
    fireEvent.click(screen.getByTestId("rule-add-condition"));
    fireEvent.click(screen.getByTestId("rule-add-condition"));

    const [first, second] = screen.getAllByTestId("rule-condition");

    fireEvent.change(within(first).getByTestId("rule-value"), { target: { value: "pune" } });
    fireEvent.change(within(second).getByTestId("rule-value"), { target: { value: "atlantis" } });

    // Act
    fireEvent.submit(form());

    // Assert
    expect(await within(second).findByText("City not recognised")).toBeInTheDocument();
    expect(within(first).queryByTestId("rule-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("cohort-create-error")).toBeInTheDocument();
  });

  it("L1 — dynamic_disabled is explained instead of a generic failure", async () => {
    // Arrange
    createCohortMock.mockRejectedValue(
      new ApiError({ status: 400, serverMessage: "disabled", code: "dynamic_disabled" }),
    );
    renderView();
    fireEvent.change(nameInput(), { target: { value: "Later" } });
    await chooseDynamic();
    fireEvent.click(screen.getByTestId("rule-add-condition"));
    fireEvent.change(screen.getByTestId("rule-value"), { target: { value: "pune" } });

    // Act
    fireEvent.submit(form());

    // Assert
    expect(await screen.findByTestId("cohort-create-error")).toHaveTextContent(
      "Dynamic cohorts are not enabled yet",
    );
  });

  it("L3 — a failed /rule-fields load is shown and blocks a dynamic save", async () => {
    // Arrange
    fetchRuleFieldsMock.mockRejectedValue(new ApiError({ status: 500, serverMessage: null }));
    renderView();
    fireEvent.change(nameInput(), { target: { value: "No catalog" } });

    // Act
    fireEvent.click(screen.getByTestId("cohort-type-dynamic"));

    // Assert
    expect(await screen.findByTestId("rule-fields-error")).toBeInTheDocument();
    expect(screen.getByTestId("button-bar-confirm")).toBeDisabled();
  });

  it("C6 — Retry reloads the rule-field catalog after a failed load", async () => {
    // Arrange
    fetchRuleFieldsMock.mockRejectedValueOnce(new ApiError({ status: 500, serverMessage: null }));
    renderView();
    fireEvent.click(screen.getByTestId("cohort-type-dynamic"));
    await screen.findByTestId("rule-fields-error");

    // Act
    fireEvent.click(screen.getByTestId("rule-fields-retry"));

    // Assert
    expect(await screen.findByTestId("rule-add-condition")).toBeInTheDocument();
    expect(screen.queryByTestId("rule-fields-error")).not.toBeInTheDocument();
    expect(fetchRuleFieldsMock).toHaveBeenCalledTimes(2);
  });
});
