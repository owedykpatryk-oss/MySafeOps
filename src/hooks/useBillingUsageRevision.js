import { useEffect, useState } from "react";
import { ORG_DATA_CHANGED_EVENT, ORG_CHANGED_EVENT } from "../utils/orgStorage";
import { COUNTRY_WORKSPACE_CHANGED_EVENT } from "../utils/countryWorkspaces";

/** Keep billing counters current after same-tab writes and other-tab updates. */
export function useBillingUsageRevision() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const events = [ORG_DATA_CHANGED_EVENT, ORG_CHANGED_EVENT, COUNTRY_WORKSPACE_CHANGED_EVENT, "storage"];
    events.forEach((event) => window.addEventListener(event, refresh));
    return () => events.forEach((event) => window.removeEventListener(event, refresh));
  }, []);
  return revision;
}
