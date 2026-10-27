import assert from "node:assert/strict";
import { test } from "node:test";
import { generateClip } from "./video-generator.ts";

const savedKey = process.env.FAL_API_KEY;
const savedFetch = globalThis.fetch;
const savedError = console.error;

function restore() {
  globalThis.fetch = savedFetch;
  console.error = savedError;
  if (savedKey === undefined) delete process.env.FAL_API_KEY;
  else process.env.FAL_API_KEY = savedKey;
}

test("generateClip skips fal when the key is missing and redacts the key on failure", async () => {
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
    delete process.env.FAL_API_KEY;
    assert.equal(await generateClip("rain on the stair", "https://example.com/still.png", 10), null);
    assert.equal(calls, 0);
    const missing = logs.join("\n");
    assert.match(missing, /generateClip skipped: FAL_API_KEY is not set/);
    if (savedKey) assert.equal(missing.includes(savedKey), false);

    logs.length = 0;
    process.env.FAL_API_KEY = "test-fal-key";
    globalThis.fetch = async (input, init) => {
      calls += 1;
      const url = String(input);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), "Key test-fal-key");
      const body = JSON.parse(String(init?.body));
      if (url === "https://fal.run/fal-ai/kling-video/v2.6/pro/image-to-video") {
        assert.equal(body.prompt, "rain on the stair");
        assert.equal(body.start_image_url, "https://example.com/still.png");
        assert.equal(body.duration, "10");
        assert.equal(body.generate_audio, false);
        return new Response(JSON.stringify({ video: { url: "https://example.com/clip.mp4" } }), { status: 200 });
      }
      if (url === "https://fal.run/fal-ai/kling-video/v2.6/pro/text-to-video") {
        assert.equal(body.aspect_ratio, "9:16");
        assert.equal(body.duration, "5");
        assert.equal(body.start_image_url, undefined);
        return new Response("token test-fal-key rejected", { status: 401 });
      }
      throw new Error(`unexpected ${url}`);
    };

    assert.equal(await generateClip("rain on the stair", "https://example.com/still.png", 10), "https://example.com/clip.mp4");
    assert.equal(await generateClip("a short beat", "", 4), null);
    const failure = logs.join("\n");
    assert.match(failure, /generateClip failed: 401/);
    assert.equal(failure.includes("test-fal-key"), false);
    assert.equal(calls, 2);
  } finally {
    restore();
  }
});
