import assert from "node:assert/strict";
import test from "node:test";

test("calculates statutory annual leave tiers and departure-year proration", async () => {
  const { statutoryAnnualLeaveDays, proratedAnnualLeaveDays } = await import("../app/leave-overtime-calculator.mjs");
  assert.equal(statutoryAnnualLeaveDays(0.9), 0);
  assert.equal(statutoryAnnualLeaveDays(1), 5);
  assert.equal(statutoryAnnualLeaveDays(10), 10);
  assert.equal(statutoryAnnualLeaveDays(20), 15);
  assert.equal(proratedAnnualLeaveDays({ employmentDate:"2026-01-01", cutoffDate:"2026-07-15", cumulativeWorkYears:1, takenDays:0 }), 2);
  assert.equal(proratedAnnualLeaveDays({ employmentDate:"2025-01-01", cutoffDate:"2026-12-31", cumulativeWorkYears:10, takenDays:3 }), 7);
});

test("calculates the extra 200 percent annual leave compensation and written-waiver exception", async () => {
  const { annualLeaveCompensation } = await import("../app/leave-overtime-calculator.mjs");
  assert.equal(Number(annualLeaveCompensation({ averageMonthlyPay:10_000, unusedDays:5, writtenWaiver:false }).toFixed(2)), 4597.70);
  assert.equal(annualLeaveCompensation({ averageMonthlyPay:10_000, unusedDays:5, writtenWaiver:true }), 0);
});

test("calculates overtime and uncompensated rest-day leave without double counting", async () => {
  const { overtimeCompensation, compTimeCompensation } = await import("../app/leave-overtime-calculator.mjs");
  const result = overtimeCompensation({ monthlyWageBase:10_000, weekdayHours:2, restDayHours:8, holidayHours:8 });
  assert.equal(Number(result.weekday.toFixed(2)), 172.41);
  assert.equal(Number(result.restDay.toFixed(2)), 919.54);
  assert.equal(Number(result.holiday.toFixed(2)), 1379.31);
  assert.equal(Number(result.total.toFixed(2)), 2471.26);
  assert.equal(Number(compTimeCompensation({ monthlyWageBase:10_000, outstandingDays:1 }).toFixed(2)), 919.54);
});
