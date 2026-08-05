// Cohort section routes (TTXY-4705).
// Kept deliberately lightweight, mirroring src/returns-exchange/urls.ts — this
// section is backed by the TenexuBackend REST API, not Saleor GraphQL, so it
// does not need the query-param machinery in src/discounts/urls.ts.

export const cohortsSection = "/cohorts";

export const cohortListPath = `${cohortsSection}/list`;
export const cohortAddPath = `${cohortsSection}/add`;
export const cohortPath = (id: string | number) => `${cohortsSection}/list/${id}`;

export const cohortListUrl = () => cohortListPath;
export const cohortAddUrl = () => cohortAddPath;
export const cohortUrl = (id: string | number) => cohortPath(id);
