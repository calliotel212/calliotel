import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePlan } from "./plans.ts";
import { safeNextPath, validateEmail, validateLogin, validatePassword, validateSignup, validateStudioRequest, validateSuggestion, validateVideoRequest } from "./validators.ts";

test("email validation covers empty and invalid", () => {
  assert.equal(validateEmail(""), "Enter your email.");
  assert.equal(validateEmail("not-an-email"), "That email doesn’t look right.");
  assert.equal(validateEmail("viewer@dramame.net"), undefined);
});

test("email validation accepts plus, dots, underscores, and multi-part domains", () => {
  for (const email of ["astor539@gmail.com", "g_agroup2@yahoo.com", "name+tag@gmail.com", "first.last@example.co.uk"]) {
    assert.equal(validateEmail(email), undefined);
  }
  assert.equal(validateEmail("no-at-sign"), "That email doesn’t look right.");
  assert.equal(validateEmail("trailing@dot."), "That email doesn’t look right.");
});

test("password validation rejects weak passwords", () => {
  assert.equal(validatePassword(""), "Enter a password.");
  assert.equal(validatePassword("short1"), "Use at least 8 characters with a letter and a number.");
  assert.equal(validatePassword("longpassword"), "Use at least 8 characters with a letter and a number.");
  assert.equal(validatePassword("longpass1"), undefined);
});

test("signup requires terms and matching passwords", () => {
  const errors = validateSignup({
    name: "",
    email: "bad",
    password: "short",
    confirm: "other",
    terms: false,
  });
  assert.equal(errors.name, "Enter your name.");
  assert.ok(errors.email);
  assert.ok(errors.password);
  assert.equal(errors.confirm, "Those passwords don’t match.");
  assert.equal(errors.terms, "Accept the terms to create an account.");
});

test("login flags empty password", () => {
  const errors = validateLogin({ email: "a@b.co", password: "" });
  assert.equal(errors.password, "Enter a password.");
  assert.equal(errors.email, undefined);
});

test("suggestion email is optional", () => {
  assert.deepEqual(validateSuggestion({ idea: "A lighthouse keeper who loses one minute every night.", email: "" }), {});
  assert.equal(validateSuggestion({ idea: "too short", email: "" }).idea, "Use at least 10 characters.");
  assert.ok(validateSuggestion({ idea: "A lighthouse keeper who loses one minute every night.", email: "nope" }).email);
});

test("studio request keeps the idea to one line", () => {
  assert.deepEqual(validateStudioRequest({ name: "Ada", email: "ada@dramame.net", idea: "A clock that eats the last minute of the day." }), {});
  assert.equal(validateStudioRequest({ name: "", email: "bad", idea: "" }).name, "Enter your name.");
  assert.ok(validateStudioRequest({ name: "Ada", email: "bad", idea: "A clock." }).email);
  assert.equal(validateStudioRequest({ name: "Ada", email: "ada@dramame.net", idea: "line one\nline two" }).idea, "Keep the idea to one line.");
});

test("plan ids are single, two, series10, and custom", () => {
  assert.equal(normalizePlan("single"), "single");
  assert.equal(normalizePlan(" Two "), "two");
  assert.equal(normalizePlan("series10"), "series10");
  assert.equal(normalizePlan("custom"), "custom");
  assert.equal(normalizePlan("free"), null);
  assert.equal(normalizePlan("fan"), null);
  assert.equal(normalizePlan("studio"), null);
  assert.equal(normalizePlan("enterprise"), null);
  assert.equal(normalizePlan(""), null);
  assert.equal(normalizePlan(undefined), null);
});

test("video request accepts a script and a per-video plan", () => {
  const script = "A keeper loses one minute every night.";
  assert.deepEqual(validateVideoRequest({ script, plan: "single" }), {});
  assert.equal(validateVideoRequest({ script: "too short", plan: "two" }).script, "Use at least 10 characters.");
  assert.equal(validateVideoRequest({ script: "x".repeat(2001), plan: "series10" }).script, "Use 2000 characters or fewer.");
  assert.equal(validateVideoRequest({ script: "", plan: "custom" }).script, "Enter a script or story idea.");
  assert.equal(validateVideoRequest({ script, plan: null }).plan, "Choose a plan.");
  assert.equal(validateVideoRequest({ script, plan: normalizePlan("free") }).plan, "Choose a plan.");
  assert.equal(validateVideoRequest({ script, plan: normalizePlan("fan") }).plan, "Choose a plan.");
  assert.equal(validateVideoRequest({ script, plan: normalizePlan("studio") }).plan, "Choose a plan.");
});

test("safeNextPath blocks off-site redirects", () => {
  assert.equal(safeNextPath("/account/profile"), "/account/profile");
  assert.equal(safeNextPath("https://evil.test"), "/account");
  assert.equal(safeNextPath("//evil.test"), "/account");
});
