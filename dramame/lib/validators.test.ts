import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNextPath, validateEmail, validateLogin, validatePassword, validateSignup } from "./validators.ts";

test("email validation covers empty and invalid", () => {
  assert.equal(validateEmail(""), "Enter your email.");
  assert.equal(validateEmail("not-an-email"), "That email doesn’t look right.");
  assert.equal(validateEmail("viewer@dramame.net"), undefined);
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

test("safeNextPath blocks off-site redirects", () => {
  assert.equal(safeNextPath("/account/profile"), "/account/profile");
  assert.equal(safeNextPath("https://evil.test"), "/account");
  assert.equal(safeNextPath("//evil.test"), "/account");
});
