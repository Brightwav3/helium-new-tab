import { readPinnedSites } from "./model.js";

export function frequentSitesSupported() {
  return typeof chrome !== "undefined" && typeof chrome.permissions?.request === "function";
}

export async function requestFrequentSites() {
  if (!frequentSitesSupported()) {
    return false;
  }

  try {
    return await chrome.permissions.request({ permissions: ["topSites"] });
  } catch {
    return false;
  }
}

export async function readFrequentSites() {
  if (
    !frequentSitesSupported() ||
    !(await chrome.permissions.contains({ permissions: ["topSites"] }))
  ) {
    throw new Error("Top sites permission is unavailable");
  }

  const sites = await chrome.topSites.get();

  return readPinnedSites({ sites }).sites;
}
