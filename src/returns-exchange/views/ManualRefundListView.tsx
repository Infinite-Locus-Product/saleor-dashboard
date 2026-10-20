import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Button, Input, Select, Skeleton, Text } from "@saleor/macaw-ui-next";
import { Plus, RefreshCw } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { fetchManualRefunds } from "../api/manualRefundApi";
import { getErrorMessage } from "../api/manualReturnApiError";
import { ManualRefundStatusChip } from "../components/ManualRefundStatusChip";
import { type ManualRefundListItem } from "../types";
import { manualRefundDetailPath, manualRefundNewPath } from "../urls";
import {
  formatDate,
  formatTime,
  optionValue,
  type SelectOption,
} from "../utils/manualReturnStatus";

const LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

const COLUMNS = [
  "Refund ID",
  "Order ID",
  "Customer",
  "Delivery note",
  "Agent",
  "Raised on",
  "Refund status",
];

const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: "", label: "All statuses" },
  { value: "REFUND_INITIATED", label: "Refund Initiated" },
  { value: "REFUND_IN_PROCESS", label: "Refund Processing" },
  { value: "REFUND_COMPLETED", label: "Refund Completed" },
  { value: "REFUND_FAILED", label: "Refund Failed" },
];

interface ListQuery {
  page: number;
  search: string;
  status: string;
}

const Cell = ({ children }: { children: ReactNode }) => (
  <Box as="td" paddingX={3} paddingY={3}>
    {children}
  </Box>
);

export const ManualRefundListView = () => {
  const navigate = useNavigator();
  const [records, setRecords] = useState<ManualRefundListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Raw search text; `query.search` only follows it after the debounce.
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState<ListQuery>({ page: 1, search: "", status: "" });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const handle = setTimeout(() => {
      const nextSearch = search.trim();

      setQuery(prev =>
        prev.search === nextSearch ? prev : { ...prev, search: nextSearch, page: 1 },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchManualRefunds(query.page, LIMIT, {
          search: query.search || undefined,
          status: query.status || undefined,
        });

        if (cancelled) return;

        setRecords(result.data);
        setTotal(result.pagination.total);
      } catch (err: unknown) {
        if (!cancelled) setError(getErrorMessage(err, "Request failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [query, reloadToken]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const hasFilters = Boolean(query.search || query.status);

  return (
    <Box padding={6}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={3}
        marginBottom={4}
      >
        <Box>
          <Text as="h1" size={8} fontWeight="bold">
            Manual Refunds
          </Text>
          <Text size={3} color="default2" display="block">
            Refunds raised by CX agents against a return delivery note
          </Text>
        </Box>
        <Button
          variant="primary"
          size="small"
          onClick={() => navigate(manualRefundNewPath)}
          data-test-id="mrf-new-button"
        >
          <Plus size={14} aria-hidden="true" />
          Create Manual Refund
        </Button>
      </Box>

      <Box display="flex" gap={3} marginBottom={5} flexWrap="wrap" alignItems="flex-end">
        <Box __flexGrow="1" __minWidth="220px">
          <Input
            aria-label="Search manual refunds"
            placeholder="Search by Refund ID or Order ID…"
            value={search}
            onChange={event => setSearch(event.target.value)}
            size="small"
            data-test-id="mrf-search-input"
          />
        </Box>
        <Box __minWidth="200px" data-test-id="mrf-status-filter">
          <Select
            label="Refund status"
            size="small"
            value={STATUS_FILTER_OPTIONS.find(o => o.value === query.status) ?? null}
            options={STATUS_FILTER_OPTIONS}
            onChange={option => {
              const status = optionValue(option);

              setQuery(prev => (prev.status === status ? prev : { ...prev, status, page: 1 }));
            }}
          />
        </Box>
      </Box>

      {loading ? (
        <Box display="flex" flexDirection="column" gap={2} aria-busy="true">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} __height={56} />
          ))}
        </Box>
      ) : error ? (
        <Box padding={8} textAlign="center" role="alert" data-test-id="mrf-list-error">
          <Text as="p" color="critical1" fontWeight="bold" display="block">
            Couldn&apos;t load manual refunds
          </Text>
          <Text as="p" size={3} color="default2" display="block" marginBottom={3}>
            {error}
          </Text>
          <Button variant="secondary" size="small" onClick={() => setReloadToken(t => t + 1)}>
            <RefreshCw size={14} aria-hidden="true" />
            Retry
          </Button>
        </Box>
      ) : records.length === 0 ? (
        <Box padding={8} textAlign="center" data-test-id="mrf-list-empty">
          <Text color="default2">
            {hasFilters ? "No manual refunds match your filters" : "No manual refunds yet"}
          </Text>
        </Box>
      ) : (
        <>
          <Box overflowX="auto">
            <Box as="table" width="100%" style={{ borderCollapse: "collapse" }}>
              <Box as="thead">
                <Box as="tr" borderBottomWidth={1} borderColor="default1" borderStyle="solid">
                  {COLUMNS.map(col => (
                    <Box key={col} as="th" paddingX={3} paddingY={3} textAlign="left">
                      <Text size={2} color="default2" fontWeight="bold">
                        {col}
                      </Text>
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box as="tbody">
                {records.map(mrf => (
                  <Box
                    as="tr"
                    key={mrf.mrf_id}
                    data-test-id="mrf-row"
                    borderBottomWidth={1}
                    borderColor="default1"
                    borderStyle="solid"
                    onClick={() => navigate(manualRefundDetailPath(mrf.mrf_id))}
                    style={{ cursor: "pointer" }}
                  >
                    <Cell>
                      <Text size={3} fontWeight="bold">
                        {mrf.mrf_id}
                      </Text>
                    </Cell>
                    <Cell>
                      <Text size={3}>{`#${mrf.order_number}`}</Text>
                    </Cell>
                    <Cell>
                      <Text size={3}>{mrf.customer_name || "—"}</Text>
                    </Cell>
                    <Cell>
                      <Text size={3} fontWeight="bold" display="block">
                        {mrf.dn_label}
                      </Text>
                      {mrf.items.map((item, i) => (
                        <Text key={i} size={2} color="default2" display="block">
                          {item.name}
                        </Text>
                      ))}
                    </Cell>
                    <Cell>
                      <Text size={3}>{mrf.raised_by_name}</Text>
                    </Cell>
                    <Cell>
                      <Text size={2} color="default2" display="block">
                        {formatDate(mrf.created_at)}
                      </Text>
                      <Text size={2} color="default2" display="block">
                        {formatTime(mrf.created_at)}
                      </Text>
                    </Cell>
                    <Cell>
                      <ManualRefundStatusChip
                        status={mrf.refund_status}
                        needsAttention={mrf.needs_attention}
                      />
                    </Cell>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={3}
            marginTop={4}
          >
            <Text size={3} color="default2">
              {`${total} manual refund${total !== 1 ? "s" : ""}`}
            </Text>
            <Box display="flex" alignItems="center" gap={3}>
              <Text size={3} color="default2">
                {`Page ${query.page} of ${totalPages}`}
              </Text>
              <Button
                variant="secondary"
                size="small"
                disabled={query.page <= 1}
                onClick={() => setQuery(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="small"
                disabled={query.page >= totalPages}
                onClick={() => setQuery(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};
