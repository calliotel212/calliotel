const SIGNUP_URL = "https://app.calliotel.ai/signup";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800 bg-navy-950 py-12">
      <div className="container-marketing px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="text-lg font-semibold text-white">Calliotel</p>
            <p className="mt-1 text-sm text-slate-500">AI phone agents for MENA businesses.</p>
          </div>
          <nav className="flex flex-wrap justify-center gap-6 text-sm" aria-label="Footer">
            <a href="#pricing" className="text-slate-400 hover:text-accent-400">
              Pricing
            </a>
            <a href="#faq" className="text-slate-400 hover:text-accent-400">
              FAQ
            </a>
            <a href={SIGNUP_URL} className="text-slate-400 hover:text-accent-400">
              Sign up
            </a>
          </nav>
        </div>
        <p className="mt-8 text-center text-xs text-slate-600">
          © {year} Calliotel. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
