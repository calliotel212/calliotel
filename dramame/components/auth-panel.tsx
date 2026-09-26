import type { ReactNode } from "react";

export function AuthPanel({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="auth-split">
      <aside className="auth-poster">
        <p className="eyebrow">Drama Me</p>
        <p className="poster-line">One minute, then scroll up.</p>
      </aside>
      <div className="auth-panel">
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        {children}
      </div>
    </div>
  );
}
