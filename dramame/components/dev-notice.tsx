export function DevNotice({ url, detail }: { url?: string | null; detail: string }) {
  if (!url) return null;
  return (
    <aside className="dev-notice">
      <p className="eyebrow">Development only</p>
      <p>{detail}</p>
      <a href={url}>{url}</a>
    </aside>
  );
}
