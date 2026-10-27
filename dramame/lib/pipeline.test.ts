import assert from "node:assert/strict";
import { test } from "node:test";
import { planShots, splitScriptIntoShots } from "./pipeline.ts";

const savedFetch = globalThis.fetch;
const savedLog = console.log;

function restore() {
  globalThis.fetch = savedFetch;
  console.log = savedLog;
}

test("sentence split and Ollama fallback both return seven shots without calling providers", async () => {
  const logs: string[] = [];
  console.log = (message?: unknown) => {
    logs.push(String(message ?? ""));
  };
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.startsWith("http://localhost:11434")) throw new Error("connect ECONNREFUSED");
    throw new Error("refusing live network");
  };

  try {
    const seven = splitScriptIntoShots("One. Two. Three. Four. Five. Six. Seven.");
    assert.equal(seven.length, 7);
    assert.deepEqual(
      seven.map((shot) => shot.prompt),
      ["One.", "Two.", "Three.", "Four.", "Five.", "Six.", "Seven."],
    );
    assert.deepEqual(
      seven.map((shot) => shot.index),
      [1, 2, 3, 4, 5, 6, 7],
    );
    assert.ok(seven.every((shot) => shot.duration_seconds === 10));

    const short = splitScriptIntoShots("short line");
    assert.equal(short.length, 7);
    assert.ok(short.every((shot) => shot.prompt.length > 0));

    const fallback = await planShots("Alpha walks in. Beta looks back. Gamma runs.");
    assert.equal(fallback.length, 7);
    assert.ok(fallback.every((shot) => shot.prompt.length > 0));
    assert.ok(urls.every((url) => url.startsWith("http://localhost:11434")));
    assert.equal(urls.some((url) => url.includes("fal.run") || url.includes("elevenlabs")), false);
    assert.match(logs.join("\n"), /Splitting the script into sentences/);

    urls.length = 0;
    logs.length = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url === "http://localhost:11434/api/tags") {
        return Response.json({ models: [{ name: "llama3.2" }] });
      }
      if (url === "http://localhost:11434/api/chat") {
        const shots = Array.from({ length: 7 }, (_, index) => ({
          index: index + 1,
          prompt: `Model shot ${index + 1}`,
          duration_seconds: 5,
        }));
        return Response.json({ message: { content: JSON.stringify({ shots }) } });
      }
      throw new Error("refusing live network");
    };

    const planned = await planShots("A longer script that Ollama will split.");
    assert.deepEqual(
      planned.map((shot) => shot.prompt),
      ["Model shot 1", "Model shot 2", "Model shot 3", "Model shot 4", "Model shot 5", "Model shot 6", "Model shot 7"],
    );
    assert.ok(planned.every((shot) => shot.duration_seconds === 10));
    assert.equal(urls.some((url) => url.includes("fal.run") || url.includes("elevenlabs")), false);
    assert.equal(logs.length, 0);
  } finally {
    restore();
  }
});
