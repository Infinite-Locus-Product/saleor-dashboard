import { Route } from "@dashboard/components/Router";
import { Switch } from "react-router-dom";

import { CXAccessGuard } from "./components/CXAccessGuard";
import {
  logCallPath,
  manualExchangeDetailPath,
  manualExchangeListPath,
  manualExchangeNewOrderPath,
  manualExchangeNewPath,
  manualExchangeNewSizePath,
  manualReturnDetailPath,
  manualReturnListPath,
  manualReturnNewPath,
  notificationSettingsPath,
  requestDetailPath,
  returnsQueuePath,
  sizeSelectionPath,
} from "./urls";
import { LogCallView } from "./views/LogCallView";
import { ManualExchangeDetailView } from "./views/ManualExchangeDetailView";
import { ManualExchangeListView } from "./views/ManualExchangeListView";
import { ManualExchangeNewView } from "./views/ManualExchangeNewView";
import { ManualReturnDetailView } from "./views/ManualReturnDetailView";
import { ManualReturnListView } from "./views/ManualReturnListView";
import { ManualReturnNewView } from "./views/ManualReturnNewView";
import { NotificationSettingsView } from "./views/NotificationSettingsView";
import { RequestDetailView } from "./views/RequestDetailView";
import { ReturnsQueueView } from "./views/ReturnsQueueView";
import { SizeSelectionView } from "./views/SizeSelectionView";

const ReturnsExchangeSection = () => (
  <Switch>
    {/* Returns queue */}
    <Route exact path={returnsQueuePath} component={ReturnsQueueView} />

    {/* Log call — must come before requestDetailPath to avoid partial match */}
    <Route
      exact
      path={logCallPath(":requestId")}
      render={({ match }) => <LogCallView requestId={match.params.requestId!} />}
    />

    {/* Size selection / exchange */}
    <Route
      exact
      path={sizeSelectionPath(":requestId")}
      render={({ match }) => <SizeSelectionView requestId={match.params.requestId!} />}
    />

    {/* Request detail */}
    <Route
      exact
      path={requestDetailPath(":requestId")}
      render={({ match }) => <RequestDetailView requestId={match.params.requestId!} />}
    />

    {/* Manual exchange — new (size step) */}
    <Route
      exact
      path={manualExchangeNewSizePath(":orderId", ":variantSku")}
      render={({ match }) => (
        <ManualExchangeNewView
          orderId={match.params.orderId!}
          variantSku={match.params.variantSku!}
        />
      )}
    />

    {/* Manual exchange — new (order lookup / item select) */}
    <Route
      path={manualExchangeNewOrderPath(":orderId")}
      render={({ match }) => <ManualExchangeNewView orderId={match.params.orderId!} />}
    />

    {/* Manual exchange — new (blank) */}
    <Route exact path={manualExchangeNewPath} component={ManualExchangeNewView} />

    {/* Manual exchange — detail */}
    <Route
      exact
      path={manualExchangeDetailPath(":mxId")}
      render={({ match }) => <ManualExchangeDetailView mxId={match.params.mxId!} />}
    />

    {/* Manual exchange list */}
    <Route exact path={manualExchangeListPath} component={ManualExchangeListView} />

    {/* Manual return — new (must come before detail so "new" isn't read as an MR id) */}
    <Route
      exact
      path={manualReturnNewPath}
      render={() => (
        <CXAccessGuard>
          <ManualReturnNewView />
        </CXAccessGuard>
      )}
    />

    {/* Manual return — detail */}
    <Route
      exact
      path={manualReturnDetailPath(":mrId")}
      render={({ match }) => (
        <CXAccessGuard>
          <ManualReturnDetailView mrId={match.params.mrId!} />
        </CXAccessGuard>
      )}
    />

    {/* Manual return list */}
    <Route
      exact
      path={manualReturnListPath}
      render={() => (
        <CXAccessGuard>
          <ManualReturnListView />
        </CXAccessGuard>
      )}
    />

    {/* Notification settings */}
    <Route exact path={notificationSettingsPath} component={NotificationSettingsView} />
  </Switch>
);

export default ReturnsExchangeSection;
