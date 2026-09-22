import { Route } from "@dashboard/components/Router";
import { Switch } from "react-router-dom";

import { codHoldOrderDetailPath, codHoldQueuePath, codHoldSettingsPath } from "./urls";
import { HeldOrdersQueueView } from "./views/HeldOrdersQueueView";
import { OrderDetailView } from "./views/OrderDetailView";
import { SettingsView } from "./views/SettingsView";

const CodHoldSection = () => (
  <Switch>
    <Route exact path={codHoldQueuePath} component={HeldOrdersQueueView} />

    <Route
      exact
      path={codHoldOrderDetailPath(":holdId")}
      render={({ match }) => <OrderDetailView holdId={match.params.holdId!} />}
    />

    <Route exact path={codHoldSettingsPath} component={SettingsView} />
  </Switch>
);

export default CodHoldSection;
