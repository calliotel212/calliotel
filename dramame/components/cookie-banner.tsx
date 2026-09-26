"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

const KEY = "dramame-cookie-choice";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return localStorage.getItem(KEY);
}

function getServerSnapshot() {
  return "server";
}

export function CookieBanner() {
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function choose(value: "accepted" | "rejected") {
    localStorage.setItem(KEY, value);
    emit();
  }

  if (choice) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-labelledby="cookie-title" aria-describedby="cookie-copy">
      <div>
        <p id="cookie-title" className="eyebrow">
          Cookies
        </p>
        <p id="cookie-copy">
          A session cookie is set when you log in. This choice is stored on your device. Read the{" "}
          <Link href="/cookies">cookie policy</Link>.
        </p>
      </div>
      <div className="cookie-actions">
        <button type="button" className="button button-ghost" onClick={() => choose("rejected")}>
          Reject
        </button>
        <button type="button" className="button button-primary" onClick={() => choose("accepted")}>
          Accept
        </button>
      </div>
    </div>
  );
}
