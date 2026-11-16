// Campaign section routes (TTXY-4841). REST-backed like src/cohorts/urls.ts.
export const campaignsSection = "/campaigns";

export const campaignListPath = campaignsSection;
export const campaignPath = (id: string | number) => `${campaignsSection}/${id}`;

export const campaignListUrl = () => campaignListPath;
export const campaignUrl = (id: string | number) => campaignPath(id);
