import assert from "node:assert/strict";
import { test } from "node:test";
import { isEpisodeUnlocked, nextHighest } from "./unlock.ts";

test("later episodes stay locked until the previous one is opened", () => {
  assert.equal(isEpisodeUnlocked(1, 0), true);
  assert.equal(isEpisodeUnlocked(2, 0), false);
  assert.equal(isEpisodeUnlocked(2, 1), true);
  assert.equal(isEpisodeUnlocked(3, 1), false);
});

test("opening an episode records the highest opened number", () => {
  assert.equal(nextHighest(1, 0), 1);
  assert.equal(nextHighest(1, 2), 2);
});
