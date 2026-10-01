import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  if ((pathname === "/account" || pathname.startsWith("/account/")) && !req.auth?.user) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = "/login";
    signInUrl.search = "";
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/account", "/account/:path*"],
};
