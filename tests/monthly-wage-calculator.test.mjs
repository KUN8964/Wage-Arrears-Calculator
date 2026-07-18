import assert from "node:assert/strict";
import test from "node:test";

import { monthlyEmploymentSpan, proratedMonthlyWage } from "../app/monthly-wage-calculator.mjs";

test("keeps full intervening months at the contract monthly wage", () => {
  assert.deepEqual(monthlyEmploymentSpan({
    wageMonth:"2026-02", employmentDate:"2026-01-10", cutoffDate:"2026-03-18",
  }), { employedDays:28, calendarDays:28, ratio:1 });
  assert.equal(proratedMonthlyWage({
    monthlyWage:20_000, wageMonth:"2026-02", employmentDate:"2026-01-10", cutoffDate:"2026-03-18",
  }), 20_000);
});

test("prorates the first and final wage months through the inclusive employment dates", () => {
  assert.equal(proratedMonthlyWage({
    monthlyWage:31_000, wageMonth:"2026-01", employmentDate:"2026-01-10", cutoffDate:"2026-03-18",
  }), 22_000);
  assert.equal(proratedMonthlyWage({
    monthlyWage:31_000, wageMonth:"2026-03", employmentDate:"2026-01-10", cutoffDate:"2026-03-18",
  }), 18_000);
});

test("supports a same-month employment period and rejects invalid ranges", () => {
  assert.equal(proratedMonthlyWage({
    monthlyWage:30_000, wageMonth:"2026-04", employmentDate:"2026-04-10", cutoffDate:"2026-04-19",
  }), 10_000);
  assert.equal(proratedMonthlyWage({
    monthlyWage:30_000, wageMonth:"2026-04", employmentDate:"2026-04-20", cutoffDate:"2026-04-10",
  }), 0);
  assert.equal(proratedMonthlyWage({
    monthlyWage:30_000, wageMonth:"not-a-month", employmentDate:"2026-04-10", cutoffDate:"2026-04-19",
  }), 0);
});
