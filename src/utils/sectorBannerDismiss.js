import { getOrgId } from "./orgStorage";

const BASE = "mysafeops_sector_banner_dismiss";

function key(type) {
  return `${BASE}_${type}_${getOrgId()}`;
}

/** @param {"pharma"|"food"} type */
export function isSectorBannerDismissed(type) {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(key(type)) === "1";
}

/** @param {"pharma"|"food"} type */
export function dismissSectorBanner(type) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(type), "1");
}

/** @param {"pharma"|"food"} type */
export function resetSectorBannerDismiss(type) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(type));
}
