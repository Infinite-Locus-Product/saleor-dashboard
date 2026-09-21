import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { fetchManualReturns } from "../api/manualReturnApi";
import { makeListItem } from "../manualReturnFixtures";
import { type ManualReturnListItem } from "../types";
import { ManualReturnListView } from "./ManualReturnListView";

const mockNavigate = jest.fn();

jest.mock("@dashboard/hooks/useNavigator", () => ({
  __esModule: true,
  default: () => mockNavigate,
}));
jest.mock("../api/manualReturnApi", () => ({
  fetchManualReturns: jest.fn(),
}));

const fetchMock = fetchManualReturns as jest.Mock;

const pageOf = (data: ManualReturnListItem[], total = data.length) => ({
  data,
  pagination: { total, page: 1, limit: 20 },
});

const newest: ManualReturnListItem = makeListItem({
  mr_id: "MR-0043",
  saleor_order_number: "1002",
  customer_name: "Vikram Shah",
  customer_email: "vikram@example.com",
  customer_phone: "+919812345678",
  lines: [
    { ...makeListItem().lines[0], productName: "Denim Jacket", size: "L", quantity: 1 },
    { ...makeListItem().lines[0], productName: "Cotton Tee", size: "S", quantity: 2 },
  ],
  created_at: "2026-09-15T08:05:00Z",
  return_status: "REFUND_FAILED",
  return_status_label: "Refund Failed",
  erp_sync_status: "FAILED",
  is_override: true,
});
const older: ManualReturnListItem = makeListItem();

/** Flushes chained promise callbacks without relying on (possibly faked) timers. */
const flushPromises = () =>
  act(async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  });

const chooseOption = async (wrapperTestId: string, label: string) => {
  const user = userEvent.setup();

  await act(async () => {
    await user.click(within(screen.getByTestId(wrapperTestId)).getByRole("combobox"));
  });

  const option = screen.getAllByTestId("select-option").find(o => o.textContent === label);

  if (!option) {
    throw new Error(`Option "${label}" not found`);
  }

  await act(async () => {
    await user.click(option);
  });
};

describe("ManualReturnListView", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows a loading skeleton while fetching", () => {
    // Arrange
    fetchMock.mockReturnValue(new Promise(() => undefined));

    // Act
    render(<ManualReturnListView />);

    // Assert
    expect(screen.getByText("Manual Returns")).toBeInTheDocument();
    expect(screen.getByTestId("mr-list-loading")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(1, 20, {
      search: undefined,
      status: undefined,
      erpSyncStatus: undefined,
    });
  });

  it("FE-LIST01 renders the columns in order and rows as returned by the API", async () => {
    // Arrange
    fetchMock.mockResolvedValue(pageOf([newest, older]));

    // Act
    render(<ManualReturnListView />);

    // Assert
    const rows = await screen.findAllByTestId("mr-row");

    expect(screen.getAllByRole("columnheader").map(th => th.textContent)).toEqual([
      "MR ID",
      "Customer",
      "Order ID",
      "Item(s)",
      "Agent",
      "Created",
      "Status",
    ]);
    expect(rows.map(row => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "MR-0043",
      "MR-0042",
    ]);

    const cells = within(rows[0]).getAllByRole("cell");

    expect(within(cells[1]).getByText("Vikram Shah")).toBeInTheDocument();
    expect(within(cells[1]).getByText("+919812345678")).toBeInTheDocument();
    expect(within(cells[1]).getByText("vikram@example.com")).toBeInTheDocument();
    expect(cells[2]).toHaveTextContent("#1002");
    expect(within(cells[3]).getByText("Denim Jacket · L · Qty 1")).toBeInTheDocument();
    expect(within(cells[3]).getByText("Cotton Tee · S · Qty 2")).toBeInTheDocument();
    expect(cells[4]).toHaveTextContent("Ravi Kumar");
    expect(within(cells[5]).getByTestId("mr-created-date")).toHaveTextContent(/2026/);
    expect(within(cells[5]).getByTestId("mr-created-time")).toHaveTextContent(/\d{1,2}:\d{2}/);
  });

  it("FE-LIST02 shows the storefront status label with an ERP sync secondary line", async () => {
    // Arrange
    fetchMock.mockResolvedValue(
      pageOf([
        newest,
        older,
        makeListItem({
          mr_id: "MR-0041",
          return_status: "REFUND_IN_PROCESS",
          return_status_label: "",
          erp_sync_status: "SUCCESS",
        }),
      ]),
    );

    // Act
    render(<ManualReturnListView />);

    // Assert
    const rows = await screen.findAllByTestId("mr-row");
    const statusCell = (index: number) => within(rows[index]).getAllByRole("cell")[6];

    expect(within(statusCell(0)).getByText("Refund Failed")).toBeInTheDocument();
    expect(within(statusCell(0)).getByText("ERP: Failed")).toBeInTheDocument();
    expect(within(statusCell(0)).getByText("Override")).toBeInTheDocument();
    expect(within(statusCell(1)).getByText("Return Picked Up")).toBeInTheDocument();
    expect(within(statusCell(1)).getByText("ERP: Pending")).toBeInTheDocument();
    expect(within(statusCell(1)).queryByText("Override")).not.toBeInTheDocument();
    expect(within(statusCell(2)).getByText("Refund Processing")).toBeInTheDocument();
    expect(within(statusCell(2)).getByText("ERP: Synced")).toBeInTheDocument();
  });

  it("FE-LIST03 shows 'No manual returns yet' when there are none and no filters", async () => {
    // Arrange
    fetchMock.mockResolvedValue(pageOf([]));

    // Act
    render(<ManualReturnListView />);

    // Assert
    expect(await screen.findByText("No manual returns yet")).toBeInTheDocument();
    expect(screen.queryByText("No manual returns match your filters")).not.toBeInTheDocument();
  });

  it("FE-LIST04 shows a distinct zero-results state when a filter matches nothing", async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce(pageOf([older])).mockResolvedValueOnce(pageOf([]));
    render(<ManualReturnListView />);
    await screen.findAllByTestId("mr-row");

    // Act
    await chooseOption("mr-status-filter", "Refund Failed");

    // Assert
    expect(await screen.findByText("No manual returns match your filters")).toBeInTheDocument();
    expect(screen.queryByText("No manual returns yet")).not.toBeInTheDocument();
  });

  it("FE-LIST04 shows the zero-results state for a search with no matches", async () => {
    // Arrange — fake timers: a debounce timer firing inside RTL's waitFor act scope is not flushed
    jest.useFakeTimers();
    fetchMock.mockResolvedValueOnce(pageOf([older])).mockResolvedValueOnce(pageOf([]));
    render(<ManualReturnListView />);
    await flushPromises();
    expect(screen.getAllByTestId("mr-row")).toHaveLength(1);

    // Act
    fireEvent.change(screen.getByLabelText("Search manual returns"), {
      target: { value: "nobody" },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await flushPromises();

    // Assert
    expect(fetchMock).toHaveBeenLastCalledWith(1, 20, {
      search: "nobody",
      status: undefined,
      erpSyncStatus: undefined,
    });
    expect(screen.getByText("No manual returns match your filters")).toBeInTheDocument();
    expect(screen.queryByText("No manual returns yet")).not.toBeInTheDocument();
  });

  it("FE-LIST05 shows an error state with retry on load failure", async () => {
    // Arrange
    fetchMock
      .mockRejectedValueOnce(new Error("Request failed: 502"))
      .mockResolvedValueOnce(pageOf([older]));
    render(<ManualReturnListView />);

    // Assert
    const alert = await screen.findByRole("alert");

    expect(within(alert).getByText("Couldn't load manual returns")).toBeInTheDocument();
    expect(within(alert).getByText("Request failed: 502")).toBeInTheDocument();

    // Act
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    // Assert
    expect(await screen.findAllByTestId("mr-row")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("FE-LIST06 debounces search by 300ms and resets to page 1", async () => {
    // Arrange
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(pageOf([older], 45));
    render(<ManualReturnListView />);
    await flushPromises();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await flushPromises();
    expect(fetchMock).toHaveBeenLastCalledWith(2, 20, expect.anything());

    const callsBeforeTyping = fetchMock.mock.calls.length;

    // Act
    fireEvent.change(screen.getByPlaceholderText("Search by MR ID, order, customer…"), {
      target: { value: "Asha" },
    });
    await act(async () => {
      jest.advanceTimersByTime(299);
    });

    // Assert
    expect(
      fetchMock.mock.calls.slice(callsBeforeTyping).some(call => call[2]?.search === "Asha"),
    ).toBe(false);

    // Act
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    // Assert
    const searchCalls = fetchMock.mock.calls.filter(call => call[2]?.search === "Asha");

    expect(searchCalls).toHaveLength(1);
    expect(searchCalls[0]).toEqual([
      1,
      20,
      { search: "Asha", status: undefined, erpSyncStatus: undefined },
    ]);
  });

  it("FE-LIST06 status and ERP sync filters reset to page 1", async () => {
    // Arrange
    fetchMock.mockResolvedValue(pageOf([older], 45));
    render(<ManualReturnListView />);
    await screen.findAllByTestId("mr-row");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(2, 20, expect.anything()));

    // Act
    await chooseOption("mr-status-filter", "Refund Failed");

    // Assert
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(1, 20, {
        search: undefined,
        status: "REFUND_FAILED",
        erpSyncStatus: undefined,
      }),
    );

    // Arrange
    await screen.findAllByTestId("mr-row");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(2, 20, expect.anything()));

    // Act
    await chooseOption("mr-erp-filter", "ERP: Failed");

    // Assert
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(1, 20, {
        search: undefined,
        status: "REFUND_FAILED",
        erpSyncStatus: "FAILED",
      }),
    );
  });

  it("FE-LIST07 '+ New Manual Return' and row click navigate", async () => {
    // Arrange
    fetchMock.mockResolvedValue(pageOf([newest, older]));
    render(<ManualReturnListView />);

    const rows = await screen.findAllByTestId("mr-row");

    // Act
    fireEvent.click(screen.getByRole("button", { name: /New Manual Return/ }));
    fireEvent.click(within(rows[1]).getAllByRole("cell")[3]);
    fireEvent.keyDown(rows[0], { key: "Enter" });

    // Assert
    expect(mockNavigate).toHaveBeenNthCalledWith(1, "/returns-exchange/manual-returns/new");
    expect(mockNavigate).toHaveBeenNthCalledWith(2, "/returns-exchange/manual-returns/MR-0042");
    expect(mockNavigate).toHaveBeenNthCalledWith(3, "/returns-exchange/manual-returns/MR-0043");
  });
});
