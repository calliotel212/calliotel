const IMAGE_TO_VIDEO = "https://fal.run/fal-ai/kling-video/v2.6/pro/image-to-video";
const TEXT_TO_VIDEO = "https://fal.run/fal-ai/kling-video/v2.6/pro/text-to-video";

function falKey(): string | null {
  const key = process.env.FAL_API_KEY?.trim() ?? "";
  if (!key) {
    console.error("generateClip skipped: FAL_API_KEY is not set.");
    return null;
  }
  return key;
}

function redact(value: string, secret: string): string {
  let text = value.replace(/\b(Bearer|Key)\s+\S+/gi, "$1 [redacted]");
  const trimmed = secret.trim();
  if (trimmed) text = text.split(trimmed).join("[redacted]");
  return text;
}

function klingDuration(seconds: number): "5" | "10" {
  return Number.isFinite(seconds) && seconds >= 8 ? "10" : "5";
}

function clipUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const video = record.video;
  if (video && typeof video === "object") {
    const url = (video as { url?: unknown }).url;
    if (typeof url === "string" && /^https?:\/\//i.test(url.trim())) return url.trim();
  }
  if (record.data) return clipUrl(record.data);
  return null;
}

// Calls fal.ai Kling 2.6. A non-empty imageUrl uses image-to-video.
// An empty imageUrl uses text-to-video at 9:16, for a script that has no still yet.
export async function generateClip(prompt: string, imageUrl: string, durationSeconds: number): Promise<string | null> {
  const key = falKey();
  if (!key) return null;
  const text = prompt.trim();
  if (!text) {
    console.error("generateClip skipped: prompt is empty.");
    return null;
  }
  const image = imageUrl.trim();
  if (image && !/^https?:\/\//i.test(image)) {
    console.error("generateClip skipped: imageUrl must be an http(s) URL.");
    return null;
  }

  const duration = klingDuration(durationSeconds);
  const endpoint = image ? IMAGE_TO_VIDEO : TEXT_TO_VIDEO;
  const body: Record<string, string | boolean> = {
    prompt: text,
    duration,
    generate_audio: false,
  };
  if (image) body.start_image_url = image;
  else body.aspect_ratio = "9:16";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    if (!response.ok) {
      console.error(`generateClip failed: ${response.status} ${redact(raw.replace(/\s+/g, " ").slice(0, 300), key)}`);
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("generateClip failed: Kling returned a response that was not JSON.");
      return null;
    }
    const url = clipUrl(parsed);
    if (!url) {
      console.error("generateClip failed: Kling response did not include a clip URL.");
      return null;
    }
    return url;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`generateClip failed: ${redact(message, key)}`);
    return null;
  }
}
