import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./password.ts";

test("password hash verifies the original password only", () => {
  const stored = hashPassword("longpass1");
  assert.equal(verifyPassword("longpass1", stored), true);
  assert.equal(verifyPassword("longpass2", stored), false);
  assert.equal(verifyPassword("longpass1", "not-a-hash"), false);
});
