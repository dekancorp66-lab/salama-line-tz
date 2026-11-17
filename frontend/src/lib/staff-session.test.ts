import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allowedStatuses, canManageCases, canReadAudit, clearStaffSession, getStaffSession,
  isAdminRole, setStaffSession, TERMINAL_STATUSES,
} from "./staff-session.ts";

test("role gates mirror the backend role sets", () => {
  assert.equal(isAdminRole("ADMIN"), true);
  assert.equal(isAdminRole("SUPER_ADMIN"), true);
  assert.equal(isAdminRole("RESPONDER"), false);
  assert.equal(canManageCases("RESPONDER"), true);
  assert.equal(canManageCases("CONTENT_MANAGER"), false);
  assert.equal(canReadAudit("AUDITOR"), true);
  assert.equal(canReadAudit("RESPONDER"), false);
});

test("only declared forward transitions are offered", () => {
  assert.deepEqual(allowedStatuses("NEW"), ["PENDING", "PENDING_REVIEW", "CANCELLED"]);
  assert.deepEqual(allowedStatuses("CLOSED"), []);
  assert.deepEqual(allowedStatuses("EXPIRED"), []);
  assert.ok(TERMINAL_STATUSES.includes("RESOLVED") === false);
});

test("the staff session starts empty and can be cleared", () => {
  clearStaffSession();
  assert.deepEqual(getStaffSession(), { token: null, user: null });
  const user = { id: "u1", email: "a@example.org", displayName: "A", role: "RESPONDER", districtCode: "MBEYA" };
  setStaffSession({ token: "token", user });
  assert.deepEqual(getStaffSession(), { token: "token", user });
  clearStaffSession();
  assert.equal(getStaffSession().token, null);
});
