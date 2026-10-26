import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Button, Input, Select, Skeleton, Text } from "@saleor/macaw-ui-next";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { type KeyboardEvent, useEffect, useState } from "react";

import { fetchManualReturns } from "../api/manualReturnApi";
import { getErrorMessage } from "../api/manualReturnApiError";
import { ManualReturnStatusChip } from "../components/ManualReturnStatusChip";
import { type ManualReturnListItem } from "../types";
import { manualReturnDetailPath, manualReturnNewPath } from "../urls";
import {
  ERP_SYNC_FILTER_OPTIONS,
  erpSyncLabel,
  formatDate,
  formatTime,
  optionValue,
  RETURN_STATUS_FILTER_OPTIONS,
  returnStatusLabel,
} from "../utils/manualReturnStatus";

const LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

const COLUMNS = ["MR ID", "Customer", "Order ID", "Item(s)", "Agent", "Created", "Status"];

interface ListQuery {
  page: number;
  search: string;
  status: string;
  erpSyncStatus: string;
}

const INITIAL_QUERY: ListQuery = { page: 1, search: "", status: "", erpSyncStatus: "" };

interface ManualReturnRowProps {
  mr: ManualReturnListItem;
  onOpen: (mrId: string) => void;
}

const ManualReturnRow = ({ mr, onOpen }: ManualReturnRowProps) => {
  const erpFailed = mr.erp_sync_status === "FAILED";
  const statusLabel = mr.return_status_label || returnStatusLabel(mr.return_status);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(mr.mr_id);
    }
  };

  return (
    <Box
      as="tr"
      data-test-id="mr-row"
      tabIndex={0}
      borderBottomWidth={1}
      borderColor="default1"
      borderStyle="solid"
      onClick={() => onOpen(mr.mr_id)}
      onKeyDown={handleKeyDown}
      style={{ cursor: "pointer" }}
    >
      <Box as="td" paddingX={3} paddingY={3}>
        <Text size={3} fontWeight="bold">
          {mr.mr_id}
        </Text>
      </Box>

      <Box as="td" paddingX={3} paddingY={3}>
        <Text size={3} display="block">
          {mr.customer_name || "—"}
        </Text>
        {mr.customer_phone && (
          <Text size={2} color="default2" display="block">
            {mr.customer_phone}
          </Text>
        )}
        {mr.customer_email && (
          <Text size={2} color="default2" display="block">
            {mr.customer_email}
          </Text>
        )}
      </Box>

      <Box as="td" paddingX={3} paddingY={3}>
        <Text size={3} fontWeight="bold">
          {`#${mr.saleor_order_number}`}
        </Text>
      </Box>

      <Box as="td" paddingX={3} paddingY={3}>
        {mr.lines.map(line => (
          <Text key={line.fulfillmentLineId} size={3} display="block">
            {[line.productName, line.size, `Qty ${line.quantity}`].filter(Boolean).join(" · ")}
          </Text>
        ))}
      </Box>

      <Box as="td" paddingX={3} paddingY={3}>
        <Text size={3}>{mr.cx_agent_name}</Text>
      </Box>

      <Box as="td" paddingX={3} paddingY={3}>
        <Text size={2} color="default2" display="block" data-test-id="mr-created-date">
          {formatDate(mr.created_at)}
        </Text>
        <Text size={2} color="default2" display="block" data-test-id="mr-created-time">
          {formatTime(mr.created_at)}
        </Text>
      </Box>

      <Box as="td" paddingX={3} paddingY={3}>
        <ManualReturnStatusChip status={mr.return_status} label={statusLabel} />
        <Box display="flex" alignItems="center" gap={1} marginTop={1}>
          {erpFailed && <AlertTriangle size={12} color="#b91c1c" aria-hidden="true" />}
          <Text size={2} color={erpFailed ? "critical1" : "default2"}>
            {`ERP: ${erpSyncLabel(mr.erp_sync_status)}`}
          </Text>
        </Box>
        {mr.is_override && (
          <Text size={2} color="default2" display="block" marginTop={1}>
            Override
          </Text>
        )}
      </Box>
    </Box>
  );
};

export const ManualReturnListView = () => {
  const navigate = useNavigator();
  const [records, setRecords] = useState<ManualReturnListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Raw search text; `query.search` only follows it after the debounce.
  const [search, setSearch] = useState("");
  // Page and filters live in one state object so a filter change and its page
  // reset produce a single fetch.
  const [query, setQuery] = useState<ListQuery>(INITIAL_QUERY);
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
        const result = await fetchManualReturns(query.page, LIMIT, {
          search: query.search || undefined,
          status: query.status || undefined,
          erpSyncStatus: query.erpSyncStatus || undefined,
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
  const hasFilters = Boolean(query.search || query.status || query.erpSyncStatus);
  const openDetail = (mrId: string) => navigate(manualReturnDetailPath(mrId));

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
            Manual Returns
          </Text>
          <Text size={3} color="default2" display="block">
            Returns raised by CX agents on behalf of customers
          </Text>
        </Box>
        <Button
          variant="primary"
          size="small"
          onClick={() => navigate(manualReturnNewPath)}
          data-test-id="mr-new-button"
        >
          <Plus size={14} aria-hidden="true" />
          New Manual Return
        </Button>
      </Box>

      <Box display="flex" gap={3} marginBottom={5} flexWrap="wrap" alignItems="flex-end">
        <Box __flexGrow="1" __minWidth="220px">
          <Input
            aria-label="Search manual returns"
            placeholder="Search by MR ID, order, customer…"
            value={search}
            onChange={event => setSearch(event.target.value)}
            size="small"
            data-test-id="mr-search-input"
          />
        </Box>
        <Box __minWidth="200px" data-test-id="mr-status-filter">
          <Select
            label="Status"
            size="small"
            value={RETURN_STATUS_FILTER_OPTIONS.find(o => o.value === query.status) ?? null}
            options={RETURN_STATUS_FILTER_OPTIONS}
            onChange={option => {
              const status = optionValue(option);

              setQuery(prev => (prev.status === status ? prev : { ...prev, status, page: 1 }));
            }}
          />
        </Box>
        <Box __minWidth="180px" data-test-id="mr-erp-filter">
          <Select
            label="ERP sync"
            size="small"
            value={ERP_SYNC_FILTER_OPTIONS.find(o => o.value === query.erpSyncStatus) ?? null}
            options={ERP_SYNC_FILTER_OPTIONS}
            onChange={option => {
              const erpSyncStatus = optionValue(option);

              setQuery(prev =>
                prev.erpSyncStatus === erpSyncStatus ? prev : { ...prev, erpSyncStatus, page: 1 },
              );
            }}
          />
        </Box>
      </Box>

      {loading ? (
        <Box
          display="flex"
          flexDirection="column"
          gap={2}
          data-test-id="mr-list-loading"
          aria-busy="true"
        >
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} __height={56} />
          ))}
        </Box>
      ) : error ? (
        <Box padding={8} textAlign="center" role="alert" data-test-id="mr-list-error">
          <Text as="p" color="critical1" fontWeight="bold" display="block">
            Couldn&apos;t load manual returns
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
        <Box padding={8} textAlign="center" data-test-id="mr-list-empty">
          <Text color="default2">
            {hasFilters ? "No manual returns match your filters" : "No manual returns yet"}
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
                {records.map(mr => (
                  <ManualReturnRow key={mr.mr_id} mr={mr} onOpen={openDetail} />
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
              {`${total} manual return${total !== 1 ? "s" : ""}`}
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
