// Campaigns section entry point (TTXY-4841): lazy-loaded from src/index.tsx.
import { Route } from "@dashboard/components/Router";
import { WindowTitle } from "@dashboard/components/WindowTitle";
import { sectionNames } from "@dashboard/intl";
import { useIntl } from "react-intl";
import { Switch } from "react-router-dom";

import { campaignListPath, campaignPath } from "./urls";
import { CampaignDetailsView } from "./views/CampaignDetailsView";
import { CampaignListView } from "./views/CampaignListView";

const CampaignsSection = () => {
  const intl = useIntl();

  return (
    <>
      <WindowTitle title={intl.formatMessage(sectionNames.campaigns)} />
      <Switch>
        <Route
          exact
          path={campaignPath(":id")}
          render={({ match }) => <CampaignDetailsView id={match.params.id!} />}
        />
        <Route path={campaignListPath} component={CampaignListView} />
      </Switch>
    </>
  );
};

export default CampaignsSection;
