import type { Metadata } from "next";
import Link from "next/link";
import { AutoPostPanel } from "@/components/auto-post-panel";
import { PREVIEW_EPISODES } from "@/lib/episodes";
import { listPostQueue, listSocialAccounts } from "@/lib/post-queue";
import { autoPostKeysConfigured } from "@/lib/providers";
import { requireUser } from "@/lib/session";
import { autoPostProviderLabel } from "@/lib/social";

export const metadata: Metadata = { title: "Auto-post" };

function defaultScheduledInput(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function formatScheduled(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(ms))} UTC`;
}

export default async function AutoPostPage() {
  const user = await requireUser();
  const accounts = await listSocialAccounts(user.id);
  const queue = await listPostQueue(user.id);
  const configured = autoPostKeysConfigured();

  return (
    <main className="page">
      <h1>Auto-post</h1>
      <p className="lede">Queue a TikTok or Instagram post on this server. This page does not publish anything.</p>
      {configured ? null : (
        <div className="banner" role="status">
          <p>Auto-post is not configured yet. Connect a developer app to enable it.</p>
          <Link href="/account/auto-post/help">What you need</Link>
        </div>
      )}
      <section className="panel">
        <h2>Connected for auto-post</h2>
        {accounts.length === 0 ? (
          <p>No TikTok or Instagram account is connected.</p>
        ) : (
          <ul className="provider-list">
            {accounts.map((account) => (
              <li key={account.id}>
                <p className="provider-name">{autoPostProviderLabel(account.provider)}</p>
                <p className="hint">{account.handle ? `@${account.handle}` : "No handle yet"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <AutoPostPanel
        episodes={PREVIEW_EPISODES.map((episode) => ({
          id: String(episode.number),
          label: `Episode ${episode.number}: ${episode.title}`,
        }))}
        defaultScheduledAt={defaultScheduledInput()}
        rows={queue.map((item) => ({
          id: item.id,
          episodeLabel: item.episodeLabel,
          providerLabel: item.providerLabel,
          scheduledLabel: formatScheduled(item.scheduledAt),
          status: item.status,
          draft: item.status === "draft",
        }))}
      />
    </main>
  );
}
