import "server-only";

import { headers } from "next/headers";

export async function appOrigin(): Promise<string> {
  const configured = process.env.AUTH_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
