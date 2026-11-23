import { APP_ADVERTISE_URL, APP_LOGIN_URL, APP_PUBLISHERS_URL } from "@/lib/app-url";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800 bg-[#0A0F1C] py-12">
      <div className="container-marketing px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-lg font-semibold text-white">AdsFind</p>
            <p className="mt-1 text-sm text-slate-400">Enterprise AI advertising network by Calliotel.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Products</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href={APP_ADVERTISE_URL()} className="text-slate-300 hover:text-adsfind-primary">
                  Advertise
                </a>
              </li>
              <li>
                <a href={APP_PUBLISHERS_URL()} className="text-slate-300 hover:text-adsfind-primary">
                  Publisher portal
                </a>
              </li>
              <li>
                <a href="/demo" className="text-slate-400 transition hover:text-slate-300">
                  AI Voice Agents (Calliotel)
                </a>
              </li>
            </ul>
          </div>
          <nav className="flex flex-col gap-2 text-sm" aria-label="Footer">
            <a href={APP_LOGIN_URL()} className="text-slate-400 hover:text-adsfind-primary">
              Log in
            </a>
            <a href="#pricing" className="text-slate-400 hover:text-adsfind-primary">
              Pricing
            </a>
          </nav>
        </div>
        <p className="mt-10 text-center text-xs text-slate-600">
          © {year} Calliotel. All rights reserved.
        </p>
      </div>
    </footer>
  );
}