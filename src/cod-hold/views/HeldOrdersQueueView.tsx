import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Button, Input, Skeleton, Text } from "@saleor/macaw-ui-next";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchHeldOrders } from "../api/codHoldApi";
import { CxStatusChip } from "../components/CxStatusChip";
import { SLABadge } from "../components/SLABadge";
import { StatusChip } from "../components/StatusChip";
import {
  type CodHoldOrder,
  type CodHoldSortDir,
  type CodHoldSortField,
  type CodHoldStatus,
} from "../types";
import { codHoldOrderDetailPath } from "../urls";

const STATUSES: { value: CodHoldStatus; label: string }[] = [
  { value: "HELD", label: "Held" },
  { value: "RELEASED", label: "Released" },
  { value: "CONVERTED_PREPAID", label: "Converted to Prepaid" },
  { value: "CUSTOMER_CANCELLED", label: "Customer Cancelled" },
];

const LIMIT = 25;

interface Filters {
  status: CodHoldStatus | "";
  assignedAgentEmail: string;
  pincode: string;
  from: string;
  to: string;
  orderNumber: string;
  phone: string;
  minValue: string;
  maxValue: string;
}

const EMPTY_FILTERS: Filters = {
  status: "",
  assignedAgentEmail: "",
  pincode: "",
  from: "",
  to: "",
  orderNumber: "",
  phone: "",
  minValue: "",
  maxValue: "",
};

function hasActiveFilters(f: Filters) {
  return Object.values(f).some(v => v !== "");
}

// Only columns with an unambiguous, single underlying field are made
// sortable here. "Matched On" combines matchedPincode/matchedPhone into one
// derived cell and isn't wired to a clickable header, even though the
// backend's sortBy whitelist includes "matchedPhone" — there's no dedicated
// Phone column today to attach that sort to (open question for product:
// worth a dedicated Phone column before wiring that sort affordance).
type SortableField = Extract<CodHoldSortField, "orderNumber" | "orderValue" | "heldAt" | "status">;

interface SortState {
  field: SortableField;
  dir: CodHoldSortDir;
}

function formatOrderValue(value: number | null, currency: string | null): string {
  if (value === null || value === undefined) return "—";

  return currency ? `${currency} ${value.toLocaleString()}` : value.toLocaleString();
}

// Cursor pagination (LLD.md §9 — the queue never does a full-table-scan count),
// so pagination here is a forward-only "Load more" rather than page/total —
// deliberately different from returns-exchange/views/ReturnsQueueView.tsx's
// page-based Previous/Next, since this backend doesn't compute a total count.
export const HeldOrdersQueueView = () => {
  const navigate = useNavigator();
  const [orders, setOrders] = useState<CodHoldOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState | null>(null);

  const toggleSort = (field: SortableField) => {
    setSort(prev => {
      if (!prev || prev.field !== field) return { field, dir: "asc" };

      if (prev.dir === "asc") return { field, dir: "desc" };

      return null;
    });
  };

  const breachedCount = orders.filter(o => o.status === "HELD" && o.slaTier === "BREACHED").length;

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  // Guards against out-of-order responses: a fetch started by an older
  // keystroke can resolve after a newer one and overwrite its results. Each
  // call captures its own id; only the most recent one is allowed to commit.
  const latestRequestId = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequestId.current;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchHeldOrders({
        status: filters.status || undefined,
        assignedAgentEmail: filters.assignedAgentEmail || undefined,
        pincode: filters.pincode || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        orderNumber: filters.orderNumber || undefined,
        phone: filters.phone || undefined,
        minValue: filters.minValue !== "" ? Number(filters.minValue) : undefined,
        maxValue: filters.maxValue !== "" ? Number(filters.maxValue) : undefined,
        sortBy: sort?.field,
        sortDir: sort?.dir,
        limit: LIMIT,
      });

      if (requestId !== latestRequestId.current) return;

      setOrders(result.orders);
      setNextCursor(result.nextCursor);
    } catch (err: any) {
      if (requestId !== latestRequestId.current) return;

      setError(err.message);
    } finally {
      if (requestId === latestRequestId.current) setLoading(false);
    }
  }, [filters, sort]);

  // Debounced so the 4 free-text/number filters (Order Number, Phone, Min/Max
  // Value) don't fire a request on every keystroke — same debounce also
  // covers the pre-existing filters and sort changes, which is harmless.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      load();
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [load]);

  const loadMore = async () => {
    if (!nextCursor) return;

    setLoadingMore(true);

    try {
      const result = await fetchHeldOrders({
        status: filters.status || undefined,
        assignedAgentEmail: filters.assignedAgentEmail || undefined,
        pincode: filters.pincode || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        orderNumber: filters.orderNumber || undefined,
        phone: filters.phone || undefined,
        minValue: filters.minValue !== "" ? Number(filters.minValue) : undefined,
        maxValue: filters.maxValue !== "" ? Number(filters.maxValue) : undefined,
        sortBy: sort?.field,
        sortDir: sort?.dir,
        cursor: nextCursor,
        limit: LIMIT,
      });

      setOrders(prev => [...prev, ...result.orders]);
      setNextCursor(result.nextCursor);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Box padding={6}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={6}>
        <Box>
          <Text size={8} fontWeight="bold">
            COD Hold Queue
          </Text>
          <Text size={3} color="default2" display="block">
            {orders.length} order{orders.length === 1 ? "" : "s"} loaded
          </Text>
        </Box>
        <Button variant="secondary" onClick={load} size="small">
          <RefreshCw size={14} />
          Refresh
        </Button>
      </Box>

      {/* Breached SLA banner */}
      {breachedCount > 0 && (
        <Box
          backgroundColor="critical1"
          borderRadius={3}
          padding={4}
          marginBottom={4}
          display="flex"
          alignItems="center"
          gap={3}
        >
          <AlertTriangle size={16} color="#ef4444" />
          <Text size={3} color="critical1" fontWeight="bold">
            {breachedCount} order{breachedCount > 1 ? "s" : ""} past SLA — action required
          </Text>
        </Box>
      )}

      {/* Filters */}
      <Box marginBottom={5}>
        <Box display="flex" gap={2} flexWrap="wrap" marginBottom={3}>
          {STATUSES.map(s => {
            const active = filters.status === s.value;

            return (
              <Box
                key={s.value}
                as="button"
                onClick={() => setFilter("status", active ? "" : s.value)}
                borderWidth={1}
                borderStyle="solid"
                borderColor={active ? "accent1" : "default1"}
                borderRadius={3}
                paddingX={3}
                paddingY={1}
                style={{
                  cursor: "pointer",
                  background: active ? "var(--color-accent1, #6366f1)" : "transparent",
                  color: active ? "#fff" : "inherit",
                  fontSize: "12px",
                  fontWeight: active ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                {s.label}
              </Box>
            );
          })}
        </Box>

        <Box display="flex" gap={3} flexWrap="wrap" alignItems="flex-end">
          <Box __minWidth="160px" __flexGrow="1">
            <Text size={2} color="default2" display="block" marginBottom={1}>
              Assigned Agent
            </Text>
            <Input
              label="agent@example.com"
              value={filters.assignedAgentEmail}
              onChange={e => setFilter("assignedAgentEmail", e.target.value)}
              size="small"
            />
          </Box>

          <Box __minWidth="140px">
            <Text size={2} color="default2" display="block" marginBottom={1}>
              Pincode
            </Text>
            <Input
              label="110001"
              value={filters.pincode}
              onChange={e => setFilter("pincode", e.target.value)}
              size="small"
            />
          </Box>

          <Box __minWidth="130px">
            <Text size={2} color="default2" display="block" marginBottom={1}>
              From
            </Text>
            <Input
              type="date"
              value={filters.from}
              onChange={e => setFilter("from", e.target.value)}
              size="small"
            />
          </Box>
          <Box __minWidth="130px">
            <Text size={2} color="default2" display="block" marginBottom={1}>
              To
            </Text>
            <Input
              type="date"
              value={filters.to}
              onChange={e => setFilter("to", e.target.value)}
              size="small"
            />
          </Box>

          <Box __minWidth="140px">
            <Text size={2} color="default2" display="block" marginBottom={1}>
              Order Number
            </Text>
            <Input
              label="12345"
              value={filters.orderNumber}
              onChange={e => setFilter("orderNumber", e.target.value)}
              size="small"
            />
          </Box>

          <Box __minWidth="140px">
            <Text size={2} color="default2" display="block" marginBottom={1}>
              Phone
            </Text>
            <Input
              label="9876543210"
              value={filters.phone}
              onChange={e => setFilter("phone", e.target.value)}
              size="small"
            />
          </Box>

          <Box __minWidth="110px">
            <Text size={2} color="default2" display="block" marginBottom={1}>
              Min Value
            </Text>
            <Input
              type="number"
              label="0"
              value={filters.minValue}
              onChange={e => setFilter("minValue", e.target.value)}
              size="small"
            />
          </Box>
          <Box __minWidth="110px">
            <Text size={2} color="default2" display="block" marginBottom={1}>
              Max Value
            </Text>
            <Input
              type="number"
              label="10000"
              value={filters.maxValue}
              onChange={e => setFilter("maxValue", e.target.value)}
              size="small"
            />
          </Box>

          {hasActiveFilters(filters) && (
            <Box style={{ paddingTop: "20px" }}>
              <Button variant="secondary" size="small" onClick={clearFilters}>
                <X size={13} />
                Clear all
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Table */}
      {loading ? (
        <Box display="flex" flexDirection="column" gap={2}>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} __height={48} />
          ))}
        </Box>
      ) : error ? (
        <Box padding={8} textAlign="center">
          <Text color="critical1">{error}</Text>
        </Box>
      ) : orders.length === 0 ? (
        <Box padding={8} textAlign="center">
          <Text color="default2">No held orders found</Text>
        </Box>
      ) : (
        <>
          <Box as="table" width="100%" style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
            <Box as="thead">
              <Box as="tr" borderBottomWidth={1} borderColor="default1" borderStyle="solid">
                {(
                  [
                    { label: "Order #", width: "10%", sortField: "orderNumber" },
                    { label: "Matched On", width: "14%" },
                    { label: "Assigned Agent", width: "14%" },
                    { label: "Held At", width: "12%", sortField: "heldAt" },
                    { label: "SLA", width: "10%" },
                    { label: "Order Value", width: "12%", sortField: "orderValue" },
                    { label: "CX Status", width: "14%" },
                    { label: "Status", width: "14%", sortField: "status" },
                  ] as { label: string; width: string; sortField?: SortableField }[]
                ).map(col => {
                  const isSorted = col.sortField && sort?.field === col.sortField;
                  const SortIcon = !isSorted
                    ? ArrowUpDown
                    : sort?.dir === "asc"
                      ? ArrowUp
                      : ArrowDown;

                  return (
                    <Box
                      key={col.label}
                      as="th"
                      paddingX={3}
                      paddingY={3}
                      textAlign="left"
                      style={{
                        width: col.width,
                        cursor: col.sortField ? "pointer" : "default",
                      }}
                      onClick={col.sortField ? () => toggleSort(col.sortField!) : undefined}
                    >
                      <Box display="flex" alignItems="center" gap={1}>
                        <Text size={2} color="default2" fontWeight="bold">
                          {col.label}
                        </Text>
                        {col.sortField && <SortIcon size={12} />}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
            <Box as="tbody">
              {orders.map(order => (
                <Box
                  key={order.id}
                  as="tr"
                  borderBottomWidth={1}
                  borderColor="default1"
                  borderStyle="solid"
                  onClick={() => navigate(codHoldOrderDetailPath(order.id))}
                  style={{ cursor: "pointer" }}
                >
                  <Box as="td" paddingX={3} paddingY={3}>
                    <Text size={3} fontWeight="bold">
                      #{order.orderNumber}
                    </Text>
                  </Box>

                  <Box as="td" paddingX={3} paddingY={3}>
                    <Text size={3} color="default2">
                      {order.matchedPincode ? `Pincode ${order.matchedPincode}` : ""}
                      {order.matchedPincode && order.matchedPhone ? " · " : ""}
                      {order.matchedPhone ? `Phone ${order.matchedPhone}` : ""}
                      {!order.matchedPincode && !order.matchedPhone ? "—" : ""}
                    </Text>
                  </Box>

                  <Box as="td" paddingX={3} paddingY={3}>
                    <Text size={3}>{order.assignedAgentEmail || "Unassigned"}</Text>
                  </Box>

                  <Box as="td" paddingX={3} paddingY={3}>
                    <Text size={2} color="default2">
                      {new Date(order.heldAt).toLocaleString()}
                    </Text>
                  </Box>

                  <Box as="td" paddingX={3} paddingY={3}>
                    {order.slaTier ? (
                      <SLABadge tier={order.slaTier} />
                    ) : (
                      <Text size={3} color="default2">
                        —
                      </Text>
                    )}
                  </Box>

                  <Box as="td" paddingX={3} paddingY={3}>
                    <Text size={3}>
                      {formatOrderValue(order.orderValue, order.orderValueCurrency)}
                    </Text>
                  </Box>

                  <Box as="td" paddingX={3} paddingY={3}>
                    <CxStatusChip status={order.internalCxStatus} />
                  </Box>

                  <Box as="td" paddingX={3} paddingY={3}>
                    <StatusChip status={order.status} />
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          {nextCursor && (
            <Box display="flex" justifyContent="center" marginTop={4}>
              <Button variant="secondary" size="small" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};
