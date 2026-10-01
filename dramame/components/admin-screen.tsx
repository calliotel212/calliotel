import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin-nav";
import { MissingPage } from "@/components/missing-page";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function AdminDenied() {
  return (
    <>
      <SiteHeader />
      <MissingPage />
      <SiteFooter />
    </>
  );
}

export function AdminAllowed({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="page">
        <p className="eyebrow">Admin</p>
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
        <AdminNav />
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
