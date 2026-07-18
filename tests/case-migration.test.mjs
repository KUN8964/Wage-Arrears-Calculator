import assert from "node:assert/strict";
import test from "node:test";

import { employmentSnapshotFor, restoredRowsNeedReview } from "../app/case-migration.mjs";

test("does not reinterpret a legacy calculation cutoff as proof of departure", () => {
  assert.deepEqual(employmentSnapshotFor({ cutoffDate:"2026-06-30" }, "2026-07-18"), {
    employmentStatus:"active",
    departureDate:"",
    cutoffDate:"2026-07-18",
    sourceCutoffDate:"2026-06-30",
    needsStatusConfirmation:true,
  });
});

test("honors explicit active and departed states", () => {
  assert.deepEqual(employmentSnapshotFor({ employmentStatus:"departed", departureDate:"2026-06-30", cutoffDate:"2026-06-30" }, "2026-07-18"), {
    employmentStatus:"departed",
    departureDate:"2026-06-30",
    cutoffDate:"2026-06-30",
    sourceCutoffDate:"2026-06-30",
    needsStatusConfirmation:false,
  });
  assert.equal(employmentSnapshotFor({ employmentStatus:"active", cutoffDate:"2026-06-30" }, "2026-07-18").cutoffDate, "2026-07-18");
});

test("marks active monthly rows stale only when their snapshot date differs from today", () => {
  assert.equal(restoredRowsNeedReview({ employmentStatus:"active", rowsCutoffDate:"2026-07-17", today:"2026-07-18" }), true);
  assert.equal(restoredRowsNeedReview({ employmentStatus:"active", rowsCutoffDate:"2026-07-18", today:"2026-07-18" }), false);
  assert.equal(restoredRowsNeedReview({ employmentStatus:"departed", rowsCutoffDate:"2026-07-17", today:"2026-07-18" }), false);
});
