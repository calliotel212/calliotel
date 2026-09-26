"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions/auth";

const LINKS = [
  { href: "/library", label: "Library" },
  { href: "/search", label: "Search" },
  { href: "/series/preview", label: "Scroll preview" },
  { href: "/help", label: "Help" },
];

export function SiteNav({ isAuthed }: { isAuthed: boolean }) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenPath(null);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function itemClass(href: string) {
    const active = pathname === href;
    return active ? "nav-link is-active" : "nav-link";
  }

  const items = (
    <>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={itemClass(link.href)} aria-current={pathname === link.href ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
      {isAuthed ? (
        <>
          <Link href="/account" className={itemClass("/account")} aria-current={pathname.startsWith("/account") ? "page" : undefined}>
            Account
          </Link>
          <form action={logout}>
            <button type="submit" className="text-button">
              Log out
            </button>
          </form>
        </>
      ) : (
        <>
          <Link href="/login" className={itemClass("/login")}>
            Log in
          </Link>
          <Link href="/signup" className="button button-primary button-small">
            Sign up
          </Link>
        </>
      )}
    </>
  );

  return (
    <>
      <nav className="nav-desktop" aria-label="Primary">
        {items}
      </nav>
      <button
        ref={buttonRef}
        type="button"
        className="menu-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenPath(open ? null : pathname)}
      >
        {open ? "Close" : "Menu"}
      </button>
      <div ref={panelRef} id={panelId} className={open ? "nav-mobile is-open" : "nav-mobile"} hidden={!open}>
        <nav aria-label="Mobile">{items}</nav>
      </div>
    </>
  );
}
