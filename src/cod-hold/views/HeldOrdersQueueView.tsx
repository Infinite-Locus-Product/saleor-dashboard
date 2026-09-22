import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Button, Input, Skeleton, Text } from "@saleor/macaw-ui-next";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { fetchHeldOrders } from "../api/codHoldApi";
import { SLABadge } from "../components/SLABadge";
import { StatusChip } from "../components/StatusChip";
import { type CodHoldOrder, type CodHoldStatus } from "../types";
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
}

const EMPTY_FILTERS: Filters = {
  status: "",
  assignedAgentEmail: "",
  pincode: "",
  from: "",
  to: "",
};

function hasActiveFilters(f: Filters) {
  return Object.values(f).some(v => v !== "");
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

  const breachedCount = orders.filter(o => o.status === "HELD" && o.slaTier === "BREACHED").length;

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchHeldOrders({
        status: filters.status || undefined,
        assignedAgentEmail: filters.assignedAgentEmail || undefined,
        pincode: filters.pincode || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        limit: LIMIT,
      });

      setOrders(result.orders);
      setNextCursor(result.nextCursor);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
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
                {[
                  { label: "Order #", width: "12%" },
                  { label: "Matched On", width: "18%" },
                  { label: "Assigned Agent", width: "20%" },
                  { label: "Held At", width: "15%" },
                  { label: "SLA", width: "15%" },
                  { label: "Status", width: "20%" },
                ].map(col => (
                  <Box
                    key={col.label}
                    as="th"
                    paddingX={3}
                    paddingY={3}
                    textAlign="left"
                    style={{ width: col.width }}
                  >
                    <Text size={2} color="default2" fontWeight="bold">
                      {col.label}
                    </Text>
                  </Box>
                ))}
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
