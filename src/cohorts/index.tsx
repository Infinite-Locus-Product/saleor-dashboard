// Cohorts section entry point (TTXY-4705).
import { Route } from "@dashboard/components/Router";
import { WindowTitle } from "@dashboard/components/WindowTitle";
import type React from "react";
import { Switch } from "react-router-dom";

import { cohortAddPath, cohortListPath, cohortPath } from "./urls";
import { CohortCreateView } from "./views/CohortCreateView";
import { CohortDetailsView } from "./views/CohortDetailsView";
import { CohortListView } from "./views/CohortListView";

const CohortsSection: React.FC = () => (
  <>
    <WindowTitle title="Cohorts" />
    <Switch>
      <Route exact path={cohortAddPath} component={CohortCreateView} />
      <Route
        exact
        path={cohortPath(":id")}
        render={({ match }) => <CohortDetailsView id={match.params.id!} />}
      />
      <Route path={cohortListPath} component={CohortListView} />
      <Route path="/cohorts" component={CohortListView} />
    </Switch>
  </>
);

export default CohortsSection;
