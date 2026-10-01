import type { Metadata } from "next";
import Link from "next/link";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <main className="narrow page">
      <p className="eyebrow">FAQ</p>
      <h1>Questions</h1>
      <p className="lede">
        Help and FAQ share this one list. The <Link href="/help">help page</Link> points here and does not keep a second copy.
      </p>
      <div className="faq">
        {FAQ.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
      <p>
        Still stuck? <Link href="/contact">Contact Drama Me</Link> at hello@dramame.net.
      </p>
    </main>
  );
}
