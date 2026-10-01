import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { SOCIAL_LINKS } from "@/lib/social";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <BrandLockup />
        <p>Vertical short stories on dramame.net. One minute at a time.</p>
      </div>
      <div>
        <p className="eyebrow">Explore</p>
        <ul>
          <li><Link href="/genres">Genres</Link></li>
          <li><Link href="/how-it-works">How it works</Link></li>
          <li><Link href="/pricing">Pricing</Link></li>
          <li><Link href="/faq">FAQ</Link></li>
          <li><Link href="/suggestions">Suggest a story</Link></li>
          <li><Link href="/about">About</Link></li>
          <li><Link href="/help">Help</Link></li>
          <li><Link href="/contact">Contact</Link></li>
          <li><Link href="/library">Library</Link></li>
          <li><Link href="/search">Search</Link></li>
          <li><Link href="/series/preview">Scroll preview</Link></li>
        </ul>
      </div>
      <div>
        <p className="eyebrow">Legal</p>
        <ul>
          <li><Link href="/privacy">Privacy policy</Link></li>
          <li><Link href="/terms">Terms of service</Link></li>
          <li><Link href="/cookies">Cookie policy</Link></li>
        </ul>
      </div>
      <div>
        <p className="eyebrow">Follow</p>
        <ul>
          {SOCIAL_LINKS.map((link) => (
            <li key={link.name}>
              <a href={link.href} rel="noreferrer">
                {link.name}
              </a>
            </li>
          ))}
        </ul>
        <p className="hint">Placeholder profiles, not live accounts yet.</p>
      </div>
    </footer>
  );
}
