import { APP_ADVERTISE_URL, APP_LOGIN_URL } from "@/lib/app-url";

const navLinks = [
  { href: "#how-it-works", label: "How it Works" },
  { href: "#publishers", label: "Publishers" },
  { href: "#pricing", label: "Pricing" },
];

export function SiteHeader() {
  const loginUrl = APP_LOGIN_URL();
  const advertiseUrl = APP_ADVERTISE_URL();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#0A0F1C]/90 backdrop-blur-md">
      <div className="container-marketing flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#" className="text-lg font-semibold tracking-tight text-white">
          AdsFind{" "}
          <span className="font-normal text-slate-400">by Calliotel</span>
        </a>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-slate-300 transition hover:text-adsfind-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            href={loginUrl}
            className="hidden text-sm text-slate-300 transition hover:text-white sm:inline"
          >
            Log In
          </a>
          <a href={advertiseUrl} className="btn-primary-glow whitespace-nowrap px-4 py-2">
            Start Advertising
          </a>
        </div>
      </div>
      <nav
        className="flex gap-4 overflow-x-auto border-t border-slate-800 px-4 py-2 md:hidden"
        aria-label="Mobile"
      >
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="whitespace-nowrap text-xs text-slate-300 hover:text-adsfind-primary"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}