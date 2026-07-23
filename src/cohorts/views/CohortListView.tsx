/**
 * Cohort list (TTXY-4705) — search, type/status filter, pagination.
 *
 * Hand-rolled table rather than the canvas Datagrid: this section is REST-backed
 * and the Datagrid needs column adapters + ListSettings plumbing it can't reuse.
 * Same call made by src/returns-exchange/views/ManualExchangeListView.tsx.
 */
import { TopNav } from "@dashboard/components/AppLayout";
import { DashboardCard } from "@dashboard/components/Card";
import { ListPageLayout } from "@dashboard/components/Layouts";
import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Button, Input, Text } from "@saleor/macaw-ui-next";
import React from "react";
import { useIntl } from "react-intl";

import { fetchCohorts } from "../api/cohortsApi";
import { cohortMessages } from "../messages";
import { type Cohort, type CohortListParams } from "../types";
import { cohortAddUrl, cohortUrl } from "../urls";

const PAGE_SIZE = 20;

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString() : "—";

export const CohortListView: React.FC = () => {
  const intl = useIntl();
  const navigate = useNavigator();

  const [rows, setRows] = React.useState<Cohort[]>([]);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<CohortListParams["type"]>(undefined);
  const [statusFilter, setStatusFilter] = React.useState<boolean | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Debounce the search box so typing doesn't hammer the backend.
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 300);

    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchCohorts({
      limit: PAGE_SIZE,
      offset,
      q: debouncedSearch || undefined,
      type: typeFilter,
      status: statusFilter,
    })
      .then(res => {
        if (cancelled) return;

        setRows(res.items ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(err => {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : intl.formatMessage(cohortMessages.loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [offset, debouncedSearch, typeFilter, statusFilter, intl]);

  const columns = [
    cohortMessages.colName,
    cohortMessages.colType,
    cohortMessages.colStatus,
    cohortMessages.colMembers,
    cohortMessages.colLastSynced,
    cohortMessages.colCreated,
  ];

  return (
    <ListPageLayout>
      <TopNav title={intl.formatMessage(cohortMessages.sectionTitle)}>
        <Button
          variant="primary"
          onClick={() => navigate(cohortAddUrl())}
          data-test-id="create-cohort"
        >
          {intl.formatMessage(cohortMessages.createCohort)}
        </Button>
      </TopNav>

      <Box paddingX={6} paddingY={4}>
        <DashboardCard>
          <DashboardCard.Content>
            <Box display="flex" gap={4} alignItems="center" paddingY={4} flexWrap="wrap">
              <Input
                label={intl.formatMessage(cohortMessages.searchLabel)}
                placeholder={intl.formatMessage(cohortMessages.searchPlaceholder)}
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-test-id="cohort-search"
              />
              <select
                aria-label={intl.formatMessage(cohortMessages.colType)}
                value={typeFilter ?? ""}
                onChange={e => {
                  setTypeFilter((e.target.value || undefined) as CohortListParams["type"]);
                  setOffset(0);
                }}
              >
                <option value="">{intl.formatMessage(cohortMessages.allTypes)}</option>
                <option value="static">{intl.formatMessage(cohortMessages.typeStatic)}</option>
                <option value="dynamic">{intl.formatMessage(cohortMessages.typeDynamic)}</option>
              </select>
              <select
                aria-label={intl.formatMessage(cohortMessages.colStatus)}
                value={statusFilter === undefined ? "" : String(statusFilter)}
                onChange={e => {
                  const v = e.target.value;

                  setStatusFilter(v === "" ? undefined : v === "true");
                  setOffset(0);
                }}
              >
                <option value="">{intl.formatMessage(cohortMessages.allStatuses)}</option>
                <option value="true">{intl.formatMessage(cohortMessages.statusActive)}</option>
                <option value="false">{intl.formatMessage(cohortMessages.statusInactive)}</option>
              </select>
            </Box>

            {error && (
              <Box paddingY={4}>
                <Text color="critical1">{error}</Text>
              </Box>
            )}

            {loading ? (
              <Box paddingY={6}>
                <Text>{intl.formatMessage(cohortMessages.loading)}</Text>
              </Box>
            ) : rows.length === 0 ? (
              <Box paddingY={6} data-test-id="cohort-list-empty">
                <Text>{intl.formatMessage(cohortMessages.empty)}</Text>
              </Box>
            ) : (
              <Box as="table" width="100%" data-test-id="cohort-list-table">
                <Box as="thead">
                  <Box as="tr" textAlign="left">
                    {columns.map(col => (
                      <Box as="th" key={col.description} paddingY={3}>
                        <Text size={2} color="default2">
                          {intl.formatMessage(col)}
                        </Text>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box as="tbody">
                  {rows.map(cohort => (
                    <Box
                      as="tr"
                      key={cohort.id}
                      cursor="pointer"
                      onClick={() => navigate(cohortUrl(cohort.id))}
                      data-test-id={`cohort-row-${cohort.id}`}
                    >
                      <Box as="td" paddingY={3}>
                        <Text fontWeight="medium">{cohort.cohort_name}</Text>
                      </Box>
                      <Box as="td">
                        <Text>{cohort.type}</Text>
                      </Box>
                      <Box as="td">
                        <Text color={cohort.status ? "success1" : "default2"}>
                          {intl.formatMessage(
                            cohort.status
                              ? cohortMessages.statusActive
                              : cohortMessages.statusInactive,
                          )}
                        </Text>
                      </Box>
                      <Box as="td">
                        <Text>{cohort.member_count}</Text>
                      </Box>
                      <Box as="td">
                        <Text>{formatDate(cohort.last_synced_at)}</Text>
                      </Box>
                      <Box as="td">
                        <Text>{formatDate(cohort.created_date)}</Text>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            <Box display="flex" justifyContent="space-between" alignItems="center" paddingY={4}>
              <Text size={2} color="default2">
                {intl.formatMessage(cohortMessages.countLabel, { count: total })}
              </Text>
              <Box display="flex" gap={2}>
                <Button
                  variant="secondary"
                  disabled={offset === 0 || loading}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  {intl.formatMessage(cohortMessages.previous)}
                </Button>
                <Button
                  variant="secondary"
                  disabled={offset + PAGE_SIZE >= total || loading}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  {intl.formatMessage(cohortMessages.next)}
                </Button>
              </Box>
            </Box>
          </DashboardCard.Content>
        </DashboardCard>
      </Box>
    </ListPageLayout>
  );
};
