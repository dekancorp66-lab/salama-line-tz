import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatTrackingDate,
  isValidCaseCode,
  normalizeCaseCode,
  statusLabel,
} from "./case-tracking.ts";

test("normalizing a reference trims whitespace and uppercases casing", () => {
  assert.equal(normalizeCaseCode("  sl-cc723587  "), "SL-CC723587");
  assert.equal(normalizeCaseCode("SL-Ab12Cd34"), "SL-AB12CD34");
});

test("valid references use the strict SL- plus eight uppercase hex format", () => {
  assert.equal(isValidCaseCode("SL-CC723587"), true);
  assert.equal(isValidCaseCode("sl-cc723587"), true);
  assert.equal(isValidCaseCode("  SL-ABCDEF12 "), true);
});

test("internal ids, malformed and injected references are rejected before any request", () => {
  for (const value of [
    "",
    "SL-123",
    "SL-CC72358",
    "SL-CC7235877",
    "SL-GGGGGGGG",
    "cmwl1pc6n000ey92bkg6j464x",
    "SL-CC723587;DROP",
    "SL-CC72 3587",
    "SL-CC723587<script>",
  ]) {
    assert.equal(isValidCaseCode(value), false, `should reject ${value}`);
  }
});

test("public statuses have stable bilingual labels", () => {
  assert.equal(statusLabel("en", "RECEIVED"), "Received");
  assert.equal(statusLabel("en", "UNDER_REVIEW"), "Under review");
  assert.equal(statusLabel("en", "IN_PROGRESS"), "In progress");
  assert.equal(statusLabel("en", "CLOSED"), "Closed");
  for (const status of ["RECEIVED", "UNDER_REVIEW", "IN_PROGRESS", "CLOSED"] as const) {
    assert.ok(statusLabel("sw", status).length > 0);
  }
});

test("tracking dates are formatted for display and invalid values fall back safely", () => {
  const formatted = formatTrackingDate("2026-01-01T08:00:00.000Z", "en");
  assert.match(formatted, /2026/);
  assert.doesNotMatch(formatted, /T08:00:00/);
  assert.equal(formatTrackingDate("not-a-date", "en"), "not-a-date");
});
