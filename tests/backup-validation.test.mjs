import assert from "node:assert/strict";
import test from "node:test";

import { assertBackupFileSize, BackupValidationError, MAX_BACKUP_BYTES, MAX_BACKUP_ROWS, validateBackupPayload } from "../app/backup-validation.mjs";

const validRow = (id = 1) => ({
  id, wageMonth:"2026-01", payDate:"", normalPay:0, note:"1 月工资", paid:0, status:"未结清",
  duePay:20_000, arrears:20_000, contractPay:20_000, socialPaid:0, socialBase:20_000,
  socialRate:28.9, socialDue:5_780, fundPaid:0, fundBase:20_000, fundRate:5, fundDue:1_000,
});

const validBackup = () => ({
  version:9,
  caseName:"测试测算",
  setup:{ employmentDate:"2026-01-01", cutoffDate:"2026-01-31", contractPay:20_000 },
  selectedClaims:["wage", "social"],
  flowStep:"results",
  doubleRule:{ enabled:false, contractEnd:"", continuedUntil:"" },
  rows:[validRow()],
});

test("accepts a valid backup and normalizes supported legacy slash dates", () => {
  const payload = validBackup();
  payload.rows[0].payDate = "2026/1/31";
  const result = validateBackupPayload(payload);
  assert.equal(result.rows[0].payDate, "2026-01-31");
  assert.deepEqual(result.selectedClaims, ["wage", "social"]);
});

test("keeps validated legacy fields available for the existing migration path", () => {
  const payload = validBackup();
  delete payload.rows[0].wageMonth;
  delete payload.rows[0].socialRate;
  delete payload.rows[0].fundRate;
  payload.setup = { startMonth:"2026-01", endMonth:"2026-01", duePay:20_000, actualPay:0 };
  const result = validateBackupPayload(payload);
  assert.equal(result.rows[0].wageMonth, "");
  assert.equal(result.rows[0].socialRate, undefined);
  assert.equal(result.setup.startMonth, "2026-01");
  assert.equal(result.setup.duePay, 20_000);
});

test("rejects impossible dates, negative amounts and unknown claims", () => {
  const invalidDate = validBackup();
  invalidDate.setup.cutoffDate = "2026-02-31";
  assert.throws(() => validateBackupPayload(invalidDate), BackupValidationError);

  const negativeAmount = validBackup();
  negativeAmount.rows[0].arrears = -1;
  assert.throws(() => validateBackupPayload(negativeAmount), BackupValidationError);

  const unknownClaim = validBackup();
  unknownClaim.selectedClaims.push("unknown");
  assert.throws(() => validateBackupPayload(unknownClaim), BackupValidationError);
});

test("rejects unsupported versions, excessive rows and oversized files", () => {
  const future = validBackup();
  future.version = 10;
  assert.throws(() => validateBackupPayload(future), BackupValidationError);

  const excessive = validBackup();
  excessive.rows = Array.from({ length:MAX_BACKUP_ROWS + 1 }, (_, index) => validRow(index + 1));
  assert.throws(() => validateBackupPayload(excessive), BackupValidationError);
  assert.throws(() => assertBackupFileSize(MAX_BACKUP_BYTES + 1), BackupValidationError);
});
