import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Auto-post setup" };

export default async function AutoPostHelpPage() {
  await requireUser();
  return (
    <main className="page">
      <p className="eyebrow">Auto-post</p>
      <h1>What you need</h1>
      <p className="lede">
        Real posting stays off until both developer apps are approved. The keys will be pasted when those reviews are approved.
      </p>
      <h2>TikTok</h2>
      <p>A TikTok developer app with the Content Posting API.</p>
      <h2>Instagram</h2>
      <p>A Meta developer app with the Instagram Graph API.</p>
      <p>A Facebook Page linked to an Instagram Business account.</p>
      <p>Both apps require review before real posting works.</p>
      <p>
        <Link href="/account/auto-post">Back to auto-post</Link>
      </p>
    </main>
  );
}
