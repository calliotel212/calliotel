import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const allowed = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
    const email = req.auth?.user?.email?.trim().toLowerCase() ?? "";
    if (!allowed || email !== allowed) {
      const url = req.nextUrl.clone();
      url.pathname = "/__dramame-missing";
      return NextResponse.rewrite(url);
    }
  }
  if ((pathname === "/account" || pathname.startsWith("/account/")) && !req.auth?.user) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = "/login";
    signInUrl.search = "";
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/account", "/account/:path*", "/admin", "/admin/:path*"],
};
