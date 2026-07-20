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
  payload.setup.terminationEmployeeName = "张三";
  payload.setup.terminationCompanyName = "示例科技有限公司";
  payload.setup.terminationNoticeContact = "13800000000";
  payload.setup.terminationNoticeDate = "2026-01-31";
  const result = validateBackupPayload(payload);
  assert.equal(result.rows[0].payDate, "2026-01-31");
  assert.equal(result.setup.terminationCompanyName, "示例科技有限公司");
  assert.equal(result.setup.terminationNoticeDate, "2026-01-31");
  assert.deepEqual(result.selectedClaims, ["wage", "social"]);
});

test("accepts an explicit employment status and matching departure cutoff", () => {
  const payload = validBackup();
  payload.version = 14;
  payload.setup.employmentStatus = "departed";
  payload.setup.departureDate = "2026-01-31";
  const result = validateBackupPayload(payload);
  assert.equal(result.setup.employmentStatus, "departed");
  assert.equal(result.setup.departureDate, result.setup.cutoffDate);
});

test("accepts and validates the v15 monthly-row cutoff snapshot", () => {
  const payload = validBackup();
  payload.version = 15;
  payload.rowsCutoffDate = "2026-01-31";
  const result = validateBackupPayload(payload);
  assert.equal(result.rowsCutoffDate, "2026-01-31");

  payload.rowsCutoffDate = "2026-02-31";
  assert.throws(() => validateBackupPayload(payload), BackupValidationError);
});

test("accepts v16 payslip deductions, inferred-base fields and wage deductions", () => {
  const payload = validBackup();
  payload.version = 16;
  Object.assign(payload.setup, { socialPersonalPaid:523.53, fundPersonalPaid:125, fundActualBase:2_500 });
  Object.assign(payload.rows[0], { wageDeduction:1_379.31, socialActualBase:4_986, socialPersonalPaid:523.53, fundActualBase:2_500, fundPersonalPaid:125 });
  const result = validateBackupPayload(payload);
  assert.equal(result.setup.socialPersonalPaid, 523.53);
  assert.equal(result.rows[0].wageDeduction, 1_379.31);
  assert.equal(result.rows[0].fundActualBase, 2_500);
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

  const invalidResignation = validBackup();
  invalidResignation.setup.personalResignationSigned = "maybe";
  assert.throws(() => validateBackupPayload(invalidResignation), BackupValidationError);

  const missingDeparture = validBackup();
  missingDeparture.setup.employmentStatus = "departed";
  assert.throws(() => validateBackupPayload(missingDeparture), BackupValidationError);

  const mismatchedDeparture = validBackup();
  mismatchedDeparture.setup.employmentStatus = "departed";
  mismatchedDeparture.setup.departureDate = "2026-01-30";
  assert.throws(() => validateBackupPayload(mismatchedDeparture), BackupValidationError);
});

test("rejects unsupported versions, excessive rows and oversized files", () => {
  const future = validBackup();
  future.version = 17;
  assert.throws(() => validateBackupPayload(future), BackupValidationError);

  const excessive = validBackup();
  excessive.rows = Array.from({ length:MAX_BACKUP_ROWS + 1 }, (_, index) => validRow(index + 1));
  assert.throws(() => validateBackupPayload(excessive), BackupValidationError);
  assert.throws(() => assertBackupFileSize(MAX_BACKUP_BYTES + 1), BackupValidationError);
});
