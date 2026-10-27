const API_ORIGIN = "https://api.elevenlabs.io/v1";

function elevenKey(caller: "generateVoice" | "changeVoice"): string | null {
  const key = process.env.ELEVENLABS_API_KEY?.trim() ?? "";
  if (!key) {
    console.error(`${caller} skipped: ELEVENLABS_API_KEY is not set.`);
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

function loggedDetail(raw: string, secret: string): string {
  return redact(raw.replace(/\s+/g, " ").slice(0, 300), secret);
}

async function readAudio(response: Response, caller: "generateVoice" | "changeVoice", secret: string): Promise<Buffer | null> {
  if (!response.ok) {
    const detail = loggedDetail(await response.text(), secret);
    console.error(`${caller} failed: ${response.status} ${detail}`);
    return null;
  }
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0) {
    console.error(`${caller} failed: ElevenLabs returned empty audio.`);
    return null;
  }
  return audio;
}

export async function generateVoice(text: string, voiceId: string): Promise<Buffer | null> {
  const key = elevenKey("generateVoice");
  if (!key) return null;
  const script = text.trim();
  const voice = voiceId.trim();
  if (!script) {
    console.error("generateVoice skipped: text is empty.");
    return null;
  }
  if (!voice) {
    console.error("generateVoice skipped: voice id is empty.");
    return null;
  }

  try {
    const response = await fetch(`${API_ORIGIN}/text-to-speech/${encodeURIComponent(voice)}`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text: script, model_id: "eleven_multilingual_v2" }),
    });
    return await readAudio(response, "generateVoice", key);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`generateVoice failed: ${loggedDetail(message, key)}`);
    return null;
  }
}

export async function changeVoice(audioBuffer: Buffer, voiceId: string): Promise<Buffer | null> {
  const key = elevenKey("changeVoice");
  if (!key) return null;
  const voice = voiceId.trim();
  if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
    console.error("changeVoice skipped: audio buffer is empty.");
    return null;
  }
  if (!voice) {
    console.error("changeVoice skipped: voice id is empty.");
    return null;
  }

  const bytes = new Uint8Array(audioBuffer.byteLength);
  bytes.set(audioBuffer);
  const form = new FormData();
  form.append("audio", new Blob([bytes], { type: "audio/mpeg" }), "source.mp3");
  form.append("model_id", "eleven_multilingual_sts_v2");

  try {
    const response = await fetch(`${API_ORIGIN}/voice-changer/${encodeURIComponent(voice)}`, {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
    });
    return await readAudio(response, "changeVoice", key);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`changeVoice failed: ${loggedDetail(message, key)}`);
    return null;
  }
}
