const SIGNUP_URL = "https://app.calliotel.ai/signup";

const navLinks = [
  { href: "#demo", label: "Demo" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-navy-950/90 backdrop-blur-md">
      <div className="container-marketing flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#" className="text-lg font-semibold tracking-tight text-white">
          Calliotel
        </a>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-slate-300 transition hover:text-accent-400"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <a
          href={SIGNUP_URL}
          className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-navy-950 transition hover:bg-accent-400"
        >
          Get started
        </a>
      </div>
      <nav
        className="flex gap-4 overflow-x-auto border-t border-slate-800/60 px-4 py-2 md:hidden"
        aria-label="Mobile"
      >
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="whitespace-nowrap text-xs text-slate-400 hover:text-accent-400"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
