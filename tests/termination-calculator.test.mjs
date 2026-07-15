import assert from "node:assert/strict";
import test from "node:test";

test("calculates statutory N from service length", async () => {
  const { economicCompensationN } = await import("../app/termination-calculator.mjs");
  assert.equal(economicCompensationN({employmentDate:"2025-01-01",terminationDate:"2025-05-31"}), 0.5);
  assert.equal(economicCompensationN({employmentDate:"2025-01-01",terminationDate:"2025-07-01"}), 1);
  assert.equal(economicCompensationN({employmentDate:"2024-01-01",terminationDate:"2026-03-01"}), 2.5);
  assert.equal(economicCompensationN({employmentDate:"2024-01-01",terminationDate:"2026-01-01"}), 2);
});

test("calculates N plus a clamped integer X and applies the high-income cap only to N", async () => {
  const { terminationCompensation } = await import("../app/termination-calculator.mjs");
  const normal = terminationCompensation({
    employmentDate:"2024-01-01", terminationDate:"2026-03-01",
    averageMonthlyPay:20_000, extraMonths:1, extraMonthlyPay:18_000,
  });
  assert.deepEqual(normal, {
    rawN:2.5, appliedN:2.5, nMonthlyBase:20_000, extraMonths:1,
    extraMonthlyBase:18_000, economic:50_000, extra:18_000, total:68_000,
    highIncomeCapped:false,
  });

  const capped = terminationCompensation({
    employmentDate:"2010-01-01", terminationDate:"2026-03-01",
    averageMonthlyPay:40_000, localAverageMonthlyPay:10_000,
    extraMonths:12.8, extraMonthlyPay:40_000,
  });
  assert.equal(capped.appliedN, 12);
  assert.equal(capped.nMonthlyBase, 30_000);
  assert.equal(capped.extraMonths, 9);
  assert.equal(capped.economic, 360_000);
  assert.equal(capped.extra, 360_000);
  assert.equal(capped.total, 720_000);
  assert.equal(capped.highIncomeCapped, true);
});
