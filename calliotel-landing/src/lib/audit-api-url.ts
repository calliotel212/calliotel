import { getAppBaseUrl } from "./app-url";

const APEX_HOSTS = new Set(["calliotel.ai", "www.calliotel.ai"]);

/** Browser POST target for the free website audit API. */
export function getAuditApiUrl(): string {
  if (typeof window !== "undefined" && APEX_HOSTS.has(window.location.hostname)) {
    return "/api/v1/advertisers/audit";
  }
  return `${getAppBaseUrl()}/api/v1/advertisers/audit`;
}