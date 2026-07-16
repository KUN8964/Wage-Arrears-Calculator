import assert from "node:assert/strict";
import test from "node:test";

import { isIsoDate, isIsoMonth, parseIsoDateLocal, parseIsoDateUtc } from "../app/date-utils.mjs";

test("accepts real ISO dates and rejects normalized calendar overflow", () => {
  assert.ok(parseIsoDateUtc("2026-02-28"));
  assert.ok(parseIsoDateLocal("2024-02-29"));
  assert.equal(parseIsoDateUtc("2026-02-29"), null);
  assert.equal(parseIsoDateLocal("2026-02-31"), null);
  assert.equal(isIsoDate("2026-13-01"), false);
  assert.equal(isIsoDate("2026/02/28"), false);
});

test("validates ISO months without allowing month overflow", () => {
  assert.equal(isIsoMonth("2026-01"), true);
  assert.equal(isIsoMonth("2026-12"), true);
  assert.equal(isIsoMonth("2026-00"), false);
  assert.equal(isIsoMonth("2026-13"), false);
});
