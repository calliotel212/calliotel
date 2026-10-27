import { randomUUID } from "node:crypto";

const OLLAMA_ORIGIN = "http://localhost:11434";
const SHOT_COUNT = 7;
const SHOT_SECONDS = 10;

export type ShotDraft = {
  index: number;
  prompt: string;
  duration_seconds: number;
};

type SavedShot = ShotDraft & {
  status: string;
  clip_url: string | null;
  error: string | null;
};

type VideoRow = {
  id?: string;
  script_text?: string | null;
  status?: string | null;
  output_url?: string | null;
  error?: string | null;
};

type ShotRow = {
  shot_index?: unknown;
  prompt?: unknown;
  duration_seconds?: unknown;
  status?: unknown;
  clip_url?: unknown;
  error?: unknown;
};

type StatementDb = {
  prepare(sql: string): {
    get(...params: unknown[]): Promise<unknown>;
    all(...params: unknown[]): Promise<unknown[]>;
    run(...params: unknown[]): Promise<unknown>;
  };
};

export type GenerationShotState = {
  index: number;
  prompt: string;
  durationSeconds: number;
  status: string;
  clipUrl: string | null;
  error: string | null;
};

export type GenerationStepResult = {
  id: string;
  status: "queued" | "generating" | "assembling" | "ready" | "failed";
  error: string | null;
  outputUrl: string | null;
  remaining: number;
  shot: GenerationShotState | null;
  shots: GenerationShotState[];
};

type StepOptions = {
  retry?: boolean;
  db?: StatementDb;
  lockToken?: string;
  heartbeatMs?: number;
  generateClip?: (prompt: string, imageUrl: string, durationSeconds: number) => Promise<string | null>;
};

export function splitScriptIntoShots(script: string): ShotDraft[] {
  const text = script.trim().replace(/\s+/g, " ");
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  const parts = sentences.length > 0 ? sentences : [text || "Shot"];
  const groups: string[][] = Array.from({ length: SHOT_COUNT }, () => []);
  parts.forEach((sentence, index) => {
    const bucket = Math.min(SHOT_COUNT - 1, Math.floor((index * SHOT_COUNT) / parts.length));
    groups[bucket].push(sentence);
  });
  return groups.map((group, index) => ({
    index: index + 1,
    prompt: group.join(" ").trim() || parts[Math.min(index, parts.length - 1)] || `Shot ${index + 1}`,
    duration_seconds: SHOT_SECONDS,
  }));
}

function stripFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function normalizeShots(value: unknown): ShotDraft[] | null {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { shots?: unknown }).shots)
      ? (value as { shots: unknown[] }).shots
      : null;
  if (!list || list.length !== SHOT_COUNT) return null;
  const shots: ShotDraft[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") return null;
    const prompt = (item as { prompt?: unknown }).prompt;
    if (typeof prompt !== "string" || !prompt.trim()) return null;
    shots.push({
      index: shots.length + 1,
      prompt: prompt.trim(),
      duration_seconds: SHOT_SECONDS,
    });
  }
  return shots.length === SHOT_COUNT ? shots : null;
}

async function shotsFromOllama(script: string): Promise<ShotDraft[] | null> {
  try {
    const tagsResponse = await fetch(`${OLLAMA_ORIGIN}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!tagsResponse.ok) return null;
    const tags = (await tagsResponse.json()) as { models?: Array<{ name?: unknown }> };
    const model = tags.models?.map((item) => item.name).find((name): name is string => typeof name === "string" && name.trim().length > 0);
    if (!model) return null;

    const chatResponse = await fetch(`${OLLAMA_ORIGIN}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          {
            role: "system",
            content:
              'Split this drama script into exactly 7 shots for a vertical video. Reply with JSON only: {"shots":[{"index":1,"prompt":"what the camera sees","duration_seconds":10}]}. Use exactly 7 shots, in story order, with the same characters. duration_seconds is 10.',
          },
          { role: "user", content: script },
        ],
      }),
    });
    if (!chatResponse.ok) return null;
    const chat = (await chatResponse.json()) as { message?: { content?: unknown } };
    const content = chat.message?.content;
    if (typeof content !== "string" || !content.trim()) return null;
    return normalizeShots(JSON.parse(stripFence(content)));
  } catch {
    return null;
  }
}

export async function planShots(script: string): Promise<ShotDraft[]> {
  const planned = await shotsFromOllama(script);
  if (planned) return planned;
  console.log("Ollama is not running or did not return 7 shots. Splitting the script into sentences.");
  return splitScriptIntoShots(script);
}

function redactKeys(value: string): string {
  let text = value.replace(/\b(Bearer|Key)\s+\S+/gi, "$1 [redacted]");
  for (const name of ["ELEVENLABS_API_KEY", "FAL_API_KEY", "KLING_API_KEY", "AUTH_SECRET", "DATABASE_URL", "RESEND_API_KEY"]) {
    const secret = process.env[name]?.trim();
    if (secret) text = text.split(secret).join("[redacted]");
  }
  return text.replace(/\s+/g, " ").slice(0, 500);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function changedRows(result: unknown): number {
  if (!result || typeof result !== "object" || !("changes" in result)) return 0;
  return asNumber((result as { changes?: unknown }).changes) ?? 0;
}

function clipFailureMessage(index: number): string {
  return process.env.FAL_API_KEY?.trim() ? `Clip generation failed for shot ${index}.` : "FAL_API_KEY is not set.";
}

function publishShot(shot: SavedShot): GenerationShotState {
  return {
    index: shot.index,
    prompt: shot.prompt,
    durationSeconds: shot.duration_seconds,
    status: shot.status,
    clipUrl: shot.clip_url,
    error: shot.error,
  };
}

function outputUrlOf(shots: SavedShot[]): string | null {
  return (
    shots
      .slice()
      .sort((a, b) => a.index - b.index)
      .find((shot) => shot.status === "ready" && shot.clip_url)?.clip_url ?? null
  );
}

function stepResult(
  videoId: string,
  status: GenerationStepResult["status"],
  error: string | null,
  outputUrl: string | null,
  shots: SavedShot[],
  shot: SavedShot | null,
): GenerationStepResult {
  return {
    id: videoId,
    status,
    error,
    outputUrl,
    remaining: shots.filter((item) => item.status === "queued").length,
    shot: shot ? publishShot(shot) : null,
    shots: shots.map(publishShot),
  };
}

async function openDb(): Promise<StatementDb> {
  const { getDb } = await import("@/lib/db");
  return getDb();
}

async function loadVideo(db: StatementDb, videoId: string): Promise<VideoRow | null> {
  const row = (await db
    .prepare("SELECT id, script_text, status, output_url, error FROM videos WHERE id = ?")
    .get(videoId)) as VideoRow | undefined;
  return row?.id ? row : null;
}

async function loadShots(db: StatementDb, videoId: string): Promise<SavedShot[]> {
  const rows = (await db
    .prepare(
      `SELECT "index" AS shot_index, prompt, duration_seconds, status, clip_url, error
       FROM shots WHERE video_id = ? ORDER BY "index" ASC`,
    )
    .all(videoId)) as ShotRow[];
  const shots: SavedShot[] = [];
  for (const row of rows) {
    const index = asNumber(row.shot_index);
    const duration = asNumber(row.duration_seconds);
    if (index === null || !Number.isInteger(index) || duration === null || typeof row.prompt !== "string") continue;
    shots.push({
      index,
      prompt: row.prompt,
      duration_seconds: duration,
      status: typeof row.status === "string" && row.status ? row.status : "queued",
      clip_url: typeof row.clip_url === "string" ? row.clip_url : null,
      error: typeof row.error === "string" ? row.error : null,
    });
  }
  return shots.sort((a, b) => a.index - b.index);
}

async function writeShotList(db: StatementDb, videoId: string, shots: SavedShot[]): Promise<void> {
  await db.prepare("UPDATE videos SET shot_list_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(shots), Date.now(), videoId);
}

async function updateShot(db: StatementDb, videoId: string, shot: SavedShot): Promise<void> {
  await db
    .prepare('UPDATE shots SET status = ?, clip_url = ?, error = ? WHERE video_id = ? AND "index" = ?')
    .run(shot.status, shot.clip_url, shot.error, videoId, shot.index);
}

async function markFailed(db: StatementDb, videoId: string, message: string): Promise<void> {
  await db.prepare("UPDATE videos SET status = 'failed', error = ?, updated_at = ? WHERE id = ?").run(redactKeys(message), Date.now(), videoId);
}

async function saveShots(db: StatementDb, videoId: string, shots: ShotDraft[]): Promise<SavedShot[]> {
  const saved: SavedShot[] = shots.map((shot) => ({
    ...shot,
    status: "queued",
    clip_url: null,
    error: null,
  }));
  await writeShotList(db, videoId, saved);
  await db.prepare("DELETE FROM shots WHERE video_id = ?").run(videoId);
  for (const shot of saved) {
    await db
      .prepare(
        `INSERT INTO shots (id, video_id, "index", prompt, duration_seconds, status, clip_url, error)
         VALUES (?, ?, ?, ?, ?, 'queued', NULL, NULL)`,
      )
      .run(randomUUID(), videoId, shot.index, shot.prompt, shot.duration_seconds);
  }
  return saved;
}

async function markVideoGenerating(db: StatementDb, videoId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE videos SET status = 'generating', error = NULL, updated_at = ?
       WHERE id = ? AND status IN ('queued', 'generating', 'assembling')`,
    )
    .run(Date.now(), videoId);
}

async function finishStep(db: StatementDb, videoId: string, shots: SavedShot[], shot: SavedShot | null): Promise<GenerationStepResult> {
  await writeShotList(db, videoId, shots);
  const failed = shots.find((item) => item.status === "failed");
  if (failed) {
    const message = failed.error ?? clipFailureMessage(failed.index);
    await markFailed(db, videoId, message);
    return stepResult(videoId, "failed", redactKeys(message), null, shots, shot);
  }

  const remaining = shots.filter((item) => item.status === "queued").length;
  const busy = shots.some((item) => item.status === "generating" || item.status === "assembling");
  if (shots.length > 0 && remaining === 0 && !busy && shots.every((item) => item.status === "ready")) {
    const outputUrl = outputUrlOf(shots);
    await db
      .prepare("UPDATE videos SET status = 'ready', output_url = ?, error = NULL, updated_at = ? WHERE id = ?")
      .run(outputUrl, Date.now(), videoId);
    return stepResult(videoId, "ready", null, outputUrl, shots, shot);
  }

  await markVideoGenerating(db, videoId);
  return stepResult(videoId, "generating", null, null, shots, shot);
}

async function requeueStuck(db: StatementDb, videoId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE shots SET status = 'queued', clip_url = NULL, error = NULL
       WHERE video_id = ? AND status IN ('failed', 'generating', 'assembling')`,
    )
    .run(videoId);
  await db
    .prepare(
      `UPDATE videos SET status = 'generating', error = NULL, updated_at = ?
       WHERE id = ? AND status IN ('failed', 'generating', 'assembling')`,
    )
    .run(Date.now(), videoId);
  const shots = await loadShots(db, videoId);
  if (shots.length > 0) await writeShotList(db, videoId, shots);
}

// Generates the first queued shot only, then returns. The browser calls this again for the next shot.
export async function advanceGenerationStep(videoId: string, options?: StepOptions): Promise<GenerationStepResult> {
  const db = options?.db ?? (await openDb());
  const row = await loadVideo(db, videoId);
  if (!row?.id) throw new Error("Video not found.");

  if (options?.retry) await requeueStuck(db, videoId);

  const video = (await loadVideo(db, videoId)) ?? row;
  const status = typeof video.status === "string" ? video.status : "queued";
  let shots = await loadShots(db, videoId);
  if (!options?.retry && status === "failed") {
    const message = typeof video.error === "string" && video.error ? video.error : "Generation failed.";
    return stepResult(videoId, "failed", message, null, shots, shots.find((shot) => shot.status === "failed") ?? null);
  }

  if (shots.length === 0) {
    shots = await saveShots(db, videoId, await planShots(row.script_text ?? ""));
    await markVideoGenerating(db, videoId);
  }

  if (!options?.retry && status === "ready" && shots.length > 0 && shots.every((shot) => shot.status === "ready")) {
    const outputUrl = (typeof video.output_url === "string" && video.output_url) || outputUrlOf(shots);
    return stepResult(videoId, "ready", null, outputUrl, shots, null);
  }

  const existingFailure = shots.find((shot) => shot.status === "failed");
  if (!options?.retry && existingFailure) {
    const message = existingFailure.error ?? clipFailureMessage(existingFailure.index);
    await markFailed(db, videoId, message);
    return stepResult(videoId, "failed", redactKeys(message), null, shots, existingFailure);
  }

  if (options?.lockToken && !(await holdsGenerationLock(db, videoId, options.lockToken))) {
    return stepResult(videoId, status === "assembling" ? "assembling" : "generating", null, null, shots, null);
  }

  // A resumed run keeps a shot that is already generating. Resetting it to queued
  // would drop an in-flight clip and start a second fal.ai call.
  const inFlight = options?.lockToken
    ? shots.find((shot) => shot.status === "generating" || shot.status === "assembling")
    : undefined;
  const next = inFlight ?? shots.find((shot) => shot.status === "queued");
  if (!next) return finishStep(db, videoId, shots, null);

  await markVideoGenerating(db, videoId);
  if (!inFlight) {
    const claim = await db
      .prepare(`UPDATE shots SET status = 'generating', error = NULL WHERE video_id = ? AND "index" = ? AND status = 'queued'`)
      .run(videoId, next.index);
    if (changedRows(claim) < 1) {
      const fresh = await loadShots(db, videoId);
      const stillQueued = fresh.find((shot) => shot.index === next.index && shot.status === "queued");
      if (!stillQueued) return finishStep(db, videoId, fresh, null);
    }
    next.status = "generating";
    next.error = null;
    await writeShotList(db, videoId, shots);
  }

  if (options?.lockToken && !(await holdsGenerationLock(db, videoId, options.lockToken))) {
    return stepResult(videoId, "generating", null, null, shots, null);
  }

  const generateClip = options?.generateClip ?? (await import("@/lib/video-generator")).generateClip;
  const imageUrl = process.env.DRAMAME_START_IMAGE_URL?.trim() ?? "";

  try {
    const clipUrl = await generateClip(next.prompt, imageUrl, next.duration_seconds);
    if (options?.lockToken && !(await holdsGenerationLock(db, videoId, options.lockToken))) {
      return stepResult(videoId, "generating", null, null, shots, null);
    }
    if (!clipUrl) throw new Error(clipFailureMessage(next.index));
    next.status = "ready";
    next.clip_url = clipUrl;
    next.error = null;
    await updateShot(db, videoId, next);
    return finishStep(db, videoId, shots, next);
  } catch (error) {
    const message = redactKeys(error instanceof Error ? error.message : clipFailureMessage(next.index));
    console.error(`Generation step failed for ${videoId} shot ${next.index}: ${message}`);
    next.status = "failed";
    next.clip_url = null;
    next.error = message;
    try {
      await updateShot(db, videoId, next);
      await writeShotList(db, videoId, shots);
      await markFailed(db, videoId, message);
    } catch (updateError) {
      const updateMessage = redactKeys(updateError instanceof Error ? updateError.message : "Could not store the failure.");
      console.error(`Generation step could not mark ${videoId} shot ${next.index} failed: ${updateMessage}`);
      throw error;
    }
    return stepResult(videoId, "failed", message, null, shots, next);
  }
}

export async function markGenerationFailed(videoId: string, message: string, db?: StatementDb): Promise<void> {
  const database = db ?? (await openDb());
  const safe = redactKeys(message);
  await database.prepare(`UPDATE shots SET status = 'failed', error = ? WHERE video_id = ? AND status = 'generating'`).run(safe, videoId);
  await markFailed(database, videoId, safe);
  const shots = await loadShots(database, videoId);
  if (shots.length > 0) await writeShotList(database, videoId, shots);
}

export const ALREADY_GENERATING_MESSAGE = "Video is already generating. Please wait.";

// A live run refreshes this while fal.ai is in flight. A visit can resume only after the beats stop.
export const GENERATION_LOCK_STALE_MS = 10_000;
const GENERATION_HEARTBEAT_MS = 3_000;

export type GenerationClaim =
  | { ok: true; previousStatus: "queued" | "failed" | "generating" | "assembling"; lockToken: string }
  | { ok: false; message: string };

type LockRow = {
  status?: unknown;
  generation_lock?: unknown;
  generation_heartbeat?: unknown;
};

async function holdsGenerationLock(db: StatementDb, videoId: string, lockToken: string): Promise<boolean> {
  const row = (await db.prepare(`SELECT status, generation_lock FROM videos WHERE id = ?`).get(videoId)) as LockRow | undefined;
  return row?.generation_lock === lockToken && (row.status === "generating" || row.status === "assembling");
}

function armGenerationHeartbeat(
  db: StatementDb | undefined,
  videoId: string,
  lockToken: string | undefined,
  heartbeatMs: number | undefined,
): ReturnType<typeof setInterval> | null {
  if (!db || !lockToken) return null;
  const interval = heartbeatMs && heartbeatMs > 0 ? heartbeatMs : GENERATION_HEARTBEAT_MS;
  const beat = () => {
    void (async () => {
      try {
        await db
          .prepare(
            `UPDATE videos SET generation_heartbeat = ?
             WHERE id = ? AND generation_lock = ? AND status IN ('generating', 'assembling')`,
          )
          .run(Date.now(), videoId, lockToken);
      } catch {
        // A missed beat lets the lock expire so a later visit can resume the queued shots.
      }
    })();
  };
  beat();
  const timer = setInterval(beat, interval);
  const nodeTimer = timer as unknown as { unref?: () => void };
  nodeTimer.unref?.();
  return timer;
}

async function generationSnapshot(
  db: StatementDb,
  videoId: string,
  fallback: GenerationStepResult | null,
): Promise<GenerationStepResult> {
  if (fallback && (fallback.status === "ready" || fallback.status === "failed")) return fallback;
  const video = await loadVideo(db, videoId);
  const shots = await loadShots(db, videoId);
  const status = typeof video?.status === "string" ? video.status : "";
  if (status === "ready" || status === "failed" || status === "assembling" || status === "generating" || status === "queued") {
    const error = typeof video?.error === "string" ? video.error : null;
    const outputUrl = typeof video?.output_url === "string" ? video.output_url : null;
    return stepResult(videoId, status, error, outputUrl, shots, null);
  }
  return fallback ?? stepResult(videoId, "generating", null, null, shots, null);
}

// Claims the video before any fal.ai call. A second Generate loses the conditional update and must not start another loop.
export async function claimGeneration(videoId: string, db?: StatementDb): Promise<GenerationClaim> {
  const database = db ?? (await openDb());
  const row = await loadVideo(database, videoId);
  if (!row?.id) throw new Error("Video not found.");
  const status = typeof row.status === "string" ? row.status : "";
  if (status === "generating" || status === "assembling") {
    return { ok: false, message: ALREADY_GENERATING_MESSAGE };
  }
  if (status !== "queued" && status !== "failed") {
    return { ok: false, message: status === "ready" ? "Video is already ready." : "Video cannot be generated right now." };
  }

  const lockToken = randomUUID();
  const now = Date.now();
  const result = await database
    .prepare(
      `UPDATE videos SET status = 'generating', error = NULL, updated_at = ?, generation_lock = ?, generation_heartbeat = ?
       WHERE id = ? AND status IN ('queued', 'failed')`,
    )
    .run(now, lockToken, now, videoId);
  if (changedRows(result) < 1) {
    const fresh = await loadVideo(database, videoId);
    const freshStatus = typeof fresh?.status === "string" ? fresh.status : "";
    if (freshStatus === "generating" || freshStatus === "assembling") {
      return { ok: false, message: ALREADY_GENERATING_MESSAGE };
    }
    return { ok: false, message: freshStatus === "ready" ? "Video is already ready." : "Video cannot be generated right now." };
  }
  return { ok: true, previousStatus: status, lockToken };
}

// Takes over a generating video whose background run has stopped heartbeating.
// Does not change shot rows: a ready shot stays ready, and a generating shot stays generating.
export async function resumeGeneration(videoId: string, db?: StatementDb): Promise<GenerationClaim> {
  const database = db ?? (await openDb());
  const row = (await database
    .prepare(`SELECT status, generation_lock, generation_heartbeat FROM videos WHERE id = ?`)
    .get(videoId)) as LockRow | undefined;
  if (!row) throw new Error("Video not found.");
  const status = typeof row.status === "string" ? row.status : "";
  if (status !== "generating" && status !== "assembling") {
    if (status === "ready") return { ok: false, message: "Video is already ready." };
    return { ok: false, message: status === "queued" || status === "failed" ? ALREADY_GENERATING_MESSAGE : "Video cannot be generated right now." };
  }

  const heartbeat = asNumber(row.generation_heartbeat);
  const staleBefore = Date.now() - GENERATION_LOCK_STALE_MS;
  if (heartbeat !== null && heartbeat > staleBefore) {
    return { ok: false, message: ALREADY_GENERATING_MESSAGE };
  }

  const lockToken = randomUUID();
  const now = Date.now();
  const result = await database
    .prepare(
      `UPDATE videos SET generation_lock = ?, generation_heartbeat = ?, updated_at = ?
       WHERE id = ? AND status IN ('generating', 'assembling')
         AND (generation_heartbeat IS NULL OR generation_heartbeat <= ?)`,
    )
    .run(lockToken, now, now, videoId, staleBefore);
  if (changedRows(result) < 1) {
    return { ok: false, message: ALREADY_GENERATING_MESSAGE };
  }
  return { ok: true, previousStatus: status, lockToken };
}

const BACKGROUND_STEP_LIMIT = 30;

// Runs every queued shot, one after another, until the video is ready or a shot fails.
export async function runBackgroundShotLoop(videoId: string, options?: StepOptions): Promise<GenerationStepResult> {
  const db = options?.db ?? (options?.lockToken ? await openDb() : undefined);
  const timer = armGenerationHeartbeat(db, videoId, options?.lockToken, options?.heartbeatMs);
  const retry = Boolean(options?.retry);
  let latest: GenerationStepResult | null = null;
  try {
    try {
      for (let step = 0; step < BACKGROUND_STEP_LIMIT; step += 1) {
        if (db && options?.lockToken && !(await holdsGenerationLock(db, videoId, options.lockToken))) {
          return generationSnapshot(db, videoId, latest);
        }
        const previous = latest;
        latest = await advanceGenerationStep(videoId, {
          db,
          generateClip: options?.generateClip,
          retry: retry && step === 0,
          lockToken: options?.lockToken,
        });
        if (latest.status === "ready" || latest.status === "failed") return latest;
        if (db && options?.lockToken && !(await holdsGenerationLock(db, videoId, options.lockToken))) {
          return latest;
        }
        const completedShot = latest.shot?.status === "ready";
        const repeated =
          completedShot &&
          previous?.shot?.status === "ready" &&
          previous.shot.index === latest.shot?.index &&
          previous.remaining === latest.remaining &&
          previous.status === latest.status;
        if (
          repeated ||
          (!completedShot &&
            (latest.remaining <= 0 ||
              (previous !== null && previous.remaining === latest.remaining && previous.status === latest.status)))
        ) {
          break;
        }
      }
      const message = latest?.error ?? "Generation did not finish.";
      await markGenerationFailed(videoId, message, db);
      return {
        id: videoId,
        status: "failed",
        error: redactKeys(message),
        outputUrl: null,
        remaining: latest?.remaining ?? 0,
        shot: latest?.shot ?? null,
        shots: latest?.shots ?? [],
      };
    } catch (error) {
      const message = redactKeys(error instanceof Error ? error.message : "Generation failed.");
      console.error(`Background generation failed for ${videoId}: ${message}`);
      try {
        await markGenerationFailed(videoId, message, db);
      } catch (updateError) {
        const updateMessage = redactKeys(updateError instanceof Error ? updateError.message : "Could not store the failure.");
        console.error(`Background generation could not mark ${videoId} failed: ${updateMessage}`);
      }
      return {
        id: videoId,
        status: "failed",
        error: message,
        outputUrl: null,
        remaining: latest?.remaining ?? 0,
        shot: latest?.shot ?? null,
        shots: latest?.shots ?? [],
      };
    }
  } finally {
    if (timer) clearInterval(timer);
  }
}

export async function runPipeline(videoId: string): Promise<void> {
  try {
    await advanceGenerationStep(videoId);
  } catch (error) {
    const message = redactKeys(error instanceof Error ? error.message : "Pipeline failed.");
    if (message === "Video not found.") {
      console.error(`runPipeline failed for ${videoId}: video not found.`);
      return;
    }
    console.error(`runPipeline failed for ${videoId}: ${message}`);
    try {
      await markGenerationFailed(videoId, message);
    } catch (updateError) {
      const updateMessage = redactKeys(updateError instanceof Error ? updateError.message : "Could not store the failure.");
      console.error(`runPipeline could not mark ${videoId} failed: ${updateMessage}`);
    }
  }
}
