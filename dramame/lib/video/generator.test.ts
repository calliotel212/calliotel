import assert from "node:assert/strict";
import { test } from "node:test";
import { splitScriptToShots } from "./generator.ts";

test("splitScriptToShots returns seven shots", () => {
  const script = "A keeper loses one minute every night and walks the spiral stair.";
  const shots = splitScriptToShots(script);
  assert.equal(shots.length, 7);
  for (const [offset, shot] of shots.entries()) {
    assert.equal(shot.index, offset + 1);
    assert.equal(typeof shot.prompt, "string");
    assert.ok(shot.prompt.length > 0);
    assert.equal(shot.duration_seconds, 10);
  }
});

test("splitScriptToShots still returns seven shots for a short script", () => {
  const shots = splitScriptToShots("short line");
  assert.equal(shots.length, 7);
  assert.ok(shots.every((shot) => shot.prompt.length > 0));
});
