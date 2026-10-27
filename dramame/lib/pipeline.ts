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

type ScriptRow = {
  id?: string;
  script_text?: string | null;
};

type StatementDb = {
  prepare(sql: string): {
    get(...params: unknown[]): Promise<unknown>;
    run(...params: unknown[]): Promise<unknown>;
  };
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
  for (const name of ["ELEVENLABS_API_KEY", "FAL_API_KEY"]) {
    const secret = process.env[name]?.trim();
    if (secret) text = text.split(secret).join("[redacted]");
  }
  return text.replace(/\s+/g, " ").slice(0, 500);
}

async function openDb(): Promise<StatementDb> {
  const { getDb } = await import("@/lib/db");
  return getDb();
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

async function execute(videoId: string): Promise<void> {
  const db = await openDb();
  const row = (await db.prepare("SELECT id, script_text FROM videos WHERE id = ?").get(videoId)) as ScriptRow | undefined;
  if (!row?.id) {
    console.error(`runPipeline failed for ${videoId}: video not found.`);
    return;
  }

  await db.prepare("UPDATE videos SET status = 'generating', error = NULL, updated_at = ? WHERE id = ?").run(Date.now(), videoId);
  const drafts = await planShots(row.script_text ?? "");
  const shots = await saveShots(db, videoId, drafts);
  const imageUrl = process.env.DRAMAME_START_IMAGE_URL?.trim() ?? "";
  const { generateClip } = await import("@/lib/video-generator");

  for (const shot of shots) {
    const clipUrl = await generateClip(shot.prompt, imageUrl, shot.duration_seconds);
    if (!clipUrl) {
      const message = process.env.FAL_API_KEY?.trim() ? `Clip generation failed for shot ${shot.index}.` : "FAL_API_KEY is not set.";
      console.error(`runPipeline failed for ${videoId}: ${message}`);
      shot.status = "failed";
      shot.error = message;
      await updateShot(db, videoId, shot);
      await writeShotList(db, videoId, shots);
      await markFailed(db, videoId, message);
      return;
    }
    shot.status = "ready";
    shot.clip_url = clipUrl;
    shot.error = null;
    await updateShot(db, videoId, shot);
  }

  await writeShotList(db, videoId, shots);
  const outputUrl = shots.find((shot) => shot.clip_url)?.clip_url ?? null;
  await db
    .prepare("UPDATE videos SET status = 'ready', output_url = ?, error = NULL, updated_at = ? WHERE id = ?")
    .run(outputUrl, Date.now(), videoId);
}

export async function runPipeline(videoId: string): Promise<void> {
  try {
    await execute(videoId);
  } catch (error) {
    const message = redactKeys(error instanceof Error ? error.message : "Pipeline failed.");
    console.error(`runPipeline failed for ${videoId}: ${message}`);
    try {
      await markFailed(await openDb(), videoId, message);
    } catch (updateError) {
      const updateMessage = redactKeys(updateError instanceof Error ? updateError.message : "Could not store the failure.");
      console.error(`runPipeline could not mark ${videoId} failed: ${updateMessage}`);
    }
  }
}
