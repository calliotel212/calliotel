import assert from "node:assert/strict";
import { test } from "node:test";
import { changeVoice, generateVoice } from "./voice.ts";

const savedKey = process.env.ELEVENLABS_API_KEY;
const savedFetch = globalThis.fetch;
const savedError = console.error;

function restore() {
  globalThis.fetch = savedFetch;
  console.error = savedError;
  if (savedKey === undefined) delete process.env.ELEVENLABS_API_KEY;
  else process.env.ELEVENLABS_API_KEY = savedKey;
}

test("voice helpers never call ElevenLabs without a key and never log a key", async () => {
  const logs: string[] = [];
  console.error = (message?: unknown) => {
    logs.push(String(message ?? ""));
  };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("refusing live network");
  };

  try {
    delete process.env.ELEVENLABS_API_KEY;
    assert.equal(await generateVoice("Hello from the alley.", "voice123"), null);
    assert.equal(await changeVoice(Buffer.from("audio-bytes"), "voice123"), null);
    assert.equal(calls, 0);
    const missing = logs.join("\n");
    assert.match(missing, /generateVoice skipped: ELEVENLABS_API_KEY is not set/);
    assert.match(missing, /changeVoice skipped: ELEVENLABS_API_KEY is not set/);
    if (savedKey) assert.equal(missing.includes(savedKey), false);

    logs.length = 0;
    process.env.ELEVENLABS_API_KEY = "test-eleven-key";
    globalThis.fetch = async (input, init) => {
      calls += 1;
      const url = String(input);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("xi-api-key"), "test-eleven-key");
      if (url.endsWith("/text-to-speech/voice123")) {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.text, "Hello from the alley.");
        assert.equal(body.model_id, "eleven_multilingual_v2");
        return new Response(Buffer.from("spoken"), { status: 200 });
      }
      if (url.endsWith("/voice-changer/voice123")) {
        assert.equal(init?.body instanceof FormData, true);
        return new Response("token test-eleven-key rejected", { status: 401 });
      }
      throw new Error(`unexpected ${url}`);
    };

    const spoken = await generateVoice("Hello from the alley.", "voice123");
    assert.ok(spoken);
    assert.equal(spoken.toString(), "spoken");
    assert.equal(await changeVoice(Buffer.from("audio-bytes"), "voice123"), null);
    const failure = logs.join("\n");
    assert.match(failure, /changeVoice failed: 401/);
    assert.equal(failure.includes("test-eleven-key"), false);
    assert.equal(calls, 2);
  } finally {
    restore();
  }
});
