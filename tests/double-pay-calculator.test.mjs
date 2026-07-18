import assert from "node:assert/strict";
import test from "node:test";

import { automaticDoubleRuleFor, doublePayForMonth, oneYearContractEndFor } from "../app/double-pay-calculator.mjs";

test("infers the final day of a one-year contract from its presumed signing date", () => {
  assert.equal(oneYearContractEndFor("2025-06-10"), "2026-06-09");
  assert.equal(oneYearContractEndFor("2024-02-29"), "2025-02-28");
  assert.equal(oneYearContractEndFor("invalid"), "");
});

test("enables double pay after one full month of continued employment", () => {
  assert.equal(automaticDoubleRuleFor({contractEnd:"2026-01-31",cutoffDate:"2026-02-27"}).enabled, false);
  const rule = automaticDoubleRuleFor({contractEnd:"2026-01-31",cutoffDate:"2026-02-28"});
  assert.equal(rule.enabled, true);
  assert.equal(doublePayForMonth({wageMonth:"2026-02",contractPay:20_000}, rule), 20_000);
});

test("returns zero outside the eligible period or for invalid inputs", () => {
  const rule = {enabled:true,contractEnd:"2026-01-31",continuedUntil:"2026-03-31"};
  assert.equal(doublePayForMonth({wageMonth:"2026-01",contractPay:20_000}, rule), 0);
  assert.equal(doublePayForMonth({wageMonth:"invalid",contractPay:20_000}, rule), 0);
  assert.equal(doublePayForMonth({wageMonth:"2026-02",contractPay:20_000}, {...rule,enabled:false}), 0);
});
