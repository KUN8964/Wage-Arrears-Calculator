import assert from "node:assert/strict";
import test from "node:test";

import { generateMonthlyLedger } from "../app/monthly-ledger-calculator.mjs";

test("generates prorated first and final months with deterministic status", () => {
  const rows = generateMonthlyLedger({
    employmentDate:"2026-01-16",cutoffDate:"2026-02-14",contractPay:31_000,
    wageEnabled:true,arrearsStartMonth:"2026-02",firstArrearsPaidRate:0,idStart:10,
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].duePay, 16_000);
  assert.equal(rows[0].normalPay, 16_000);
  assert.equal(rows[0].status, "已结清");
  assert.equal(rows[1].duePay, 15_500);
  assert.equal(rows[1].arrears, 15_500);
  assert.equal(rows[1].status, "未结清");
});

test("applies paid contribution periods independently", () => {
  const [row] = generateMonthlyLedger({
    employmentDate:"2026-01-01",cutoffDate:"2026-01-31",contractPay:20_000,idStart:1,
    social:{enabled:true,hasPaid:true,startMonth:"2026-01",endMonth:"2026-01",actualMonthly:1_440.954,base:4_986,rate:28.9},
    fund:{enabled:true,hasPaid:false,base:20_000,rate:5},
  });
  assert.equal(row.socialPaid, 1_440.95);
  assert.equal(row.socialDue, 0);
  assert.equal(row.fundDue, 1_000);
  assert.equal(row.status, "未结清");
});
