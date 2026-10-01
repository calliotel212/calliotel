import Link from "next/link";

export function BrandLockup() {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="28" height="28">
          <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#7557FF" />
          <path d="M9 23.5h14" stroke="#F7F5FF" strokeWidth="1.6" />
          <path d="M11 23.5V13.2c0-2.4 2.2-4.2 5-4.2s5 1.8 5 4.2v10.3" fill="none" stroke="#F7F5FF" strokeWidth="1.6" />
          <path d="M13.2 23.5V15.4c0-1.3 1.2-2.4 2.8-2.4s2.8 1.1 2.8 2.4v8.1" fill="#FFB84D" />
        </svg>
      </span>
      <span className="wordmark">Drama Me</span>
    </Link>
  );
}
