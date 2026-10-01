"use client";

import { useActionState } from "react";
import { addToQueueAction, queueRowAction } from "@/lib/actions/auto-post";
import { initialFormState } from "@/lib/form-state";
import { AUTO_POST_PROVIDERS, autoPostProviderLabel } from "@/lib/social";

export type QueueRowView = {
  id: string;
  episodeLabel: string;
  providerLabel: string;
  scheduledLabel: string;
  status: string;
  draft: boolean;
};

export function AutoPostPanel({
  episodes,
  rows,
  defaultScheduledAt,
}: {
  episodes: { id: string; label: string }[];
  rows: QueueRowView[];
  defaultScheduledAt: string;
}) {
  const [addState, addAction, addPending] = useActionState(addToQueueAction, initialFormState);
  const [rowState, rowAction, rowPending] = useActionState(queueRowAction, initialFormState);

  return (
    <div className="stack">
      <form action={addAction} className="form" noValidate aria-busy={addPending}>
        <h2>Add to queue</h2>
        {addState.formError ? <p className="form-error" role="alert">{addState.formError}</p> : null}
        {addState.message ? <p className="form-note" role="status">{addState.message}</p> : null}
        <div className="field">
          <label htmlFor="episodeId">Episode</label>
          <select
            id="episodeId"
            name="episodeId"
            defaultValue={episodes[0]?.id ?? ""}
            aria-invalid={addState.fieldErrors.episodeId ? true : undefined}
            aria-describedby={addState.fieldErrors.episodeId ? "episode-error" : undefined}
          >
            {episodes.map((episode) => (
              <option key={episode.id} value={episode.id}>
                {episode.label}
              </option>
            ))}
          </select>
          {addState.fieldErrors.episodeId ? <p id="episode-error" className="field-error" role="alert">{addState.fieldErrors.episodeId}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="provider">Provider</label>
          <select
            id="provider"
            name="provider"
            defaultValue={AUTO_POST_PROVIDERS[0]}
            aria-invalid={addState.fieldErrors.provider ? true : undefined}
            aria-describedby={addState.fieldErrors.provider ? "provider-error" : undefined}
          >
            {AUTO_POST_PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {autoPostProviderLabel(provider)}
              </option>
            ))}
          </select>
          {addState.fieldErrors.provider ? <p id="provider-error" className="field-error" role="alert">{addState.fieldErrors.provider}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="caption">Caption</label>
          <textarea id="caption" name="caption" maxLength={2200} aria-invalid={addState.fieldErrors.caption ? true : undefined} aria-describedby={addState.fieldErrors.caption ? "caption-error" : "caption-hint"} />
          <p id="caption-hint" className="hint">Saved on this server only. Nothing is sent to TikTok or Instagram.</p>
          {addState.fieldErrors.caption ? <p id="caption-error" className="field-error" role="alert">{addState.fieldErrors.caption}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="scheduledAt">Scheduled time (UTC)</label>
          <input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            defaultValue={defaultScheduledAt}
            aria-invalid={addState.fieldErrors.scheduledAt ? true : undefined}
            aria-describedby={addState.fieldErrors.scheduledAt ? "scheduled-error" : "scheduled-hint"}
          />
          <p id="scheduled-hint" className="hint">Shown and stored in UTC.</p>
          {addState.fieldErrors.scheduledAt ? <p id="scheduled-error" className="field-error" role="alert">{addState.fieldErrors.scheduledAt}</p> : null}
        </div>
        <button className="button button-primary" type="submit" disabled={addPending} aria-busy={addPending}>
          {addPending ? "Please wait…" : "Add to queue"}
        </button>
      </form>

      <section>
        <h2>Queue</h2>
        {rowState.formError ? <p className="form-error" role="alert">{rowState.formError}</p> : null}
        {rowState.message ? <p className="form-note" role="status">{rowState.message}</p> : null}
        {rows.length === 0 ? (
          <p>Nothing is queued.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Episode</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Scheduled</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.episodeLabel}</td>
                    <td>{row.providerLabel}</td>
                    <td>{row.scheduledLabel}</td>
                    <td>{row.status}</td>
                    <td>
                      {row.draft ? (
                        <div className="row-actions">
                          <form action={rowAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="intent" value="approve" />
                            <button className="button button-ghost button-small" type="submit" disabled={rowPending}>
                              Approve
                            </button>
                          </form>
                          <form action={rowAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="intent" value="remove" />
                            <button className="button button-ghost button-small" type="submit" disabled={rowPending}>
                              Remove
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
