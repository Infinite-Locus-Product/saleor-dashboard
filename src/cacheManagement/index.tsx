import { cacheManagementPath } from "@dashboard/cacheManagement/urls";
import { CacheManagementView } from "@dashboard/cacheManagement/views/CacheManagementView";
import { Route } from "@dashboard/components/Router";
import { Switch } from "react-router-dom";

const CacheManagementSection = () => (
  <Switch>
    <Route exact path={cacheManagementPath} component={CacheManagementView} />
  </Switch>
);

export default CacheManagementSection;
