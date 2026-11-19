import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveApiBase } from "./api-base.ts";

test("local development keeps a configured NestJS base URL", () => {
  assert.equal(resolveApiBase("http://localhost:3000/api/v1", true), "http://localhost:3000/api/v1");
});

test("production never ships a configured localhost base URL", () => {
  assert.equal(resolveApiBase("http://localhost:3000/api/v1", false), "/api/v1");
  assert.equal(resolveApiBase("http://127.0.0.1:3000/api/v1/", false), "/api/v1");
});

test("production keeps an explicitly configured same-origin or remote base", () => {
  assert.equal(resolveApiBase("/api/v1/", false), "/api/v1");
  assert.equal(resolveApiBase("https://api.salamaline.org/api/v1", false), "https://api.salamaline.org/api/v1");
});

test("defaults are environment appropriate", () => {
  assert.equal(resolveApiBase(undefined, true), "http://localhost:3000/api/v1");
  assert.equal(resolveApiBase("   ", false), "/api/v1");
});
