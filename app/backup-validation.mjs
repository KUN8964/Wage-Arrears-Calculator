import { isIsoDate, isIsoMonth } from "./date-utils.mjs";

export const CURRENT_BACKUP_VERSION = 16;
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export const MAX_BACKUP_ROWS = 60;

const CLAIMS = new Set(["wage", "social", "fund", "doublePay", "reimbursement", "annualLeave", "overtime", "compTime", "termination", "workInjury"]);
const FLOW_STEPS = new Set(["basic", "scenario", "questions", "review", "results"]);
const STATUSES = new Set(["已结清", "未结清"]);
const MONEY_MAX = 1_000_000_000_000;

const SETUP_NUMBER_RANGES = {
  contractPay:[0, MONEY_MAX], firstArrearsPaidRate:[0, 100], socialPaid:[0, MONEY_MAX], socialActualBase:[0, MONEY_MAX], socialPersonalPaid:[0, MONEY_MAX],
  socialBase:[0, MONEY_MAX], socialRate:[0, 100], socialPensionRate:[0, 100], socialUnemploymentRate:[0, 100],
  socialInjuryRate:[0, 100], socialMaternityRate:[0, 100], socialMedicalRate:[0, 100], fundPaid:[0, MONEY_MAX],
  socialPersonalPensionRate:[0, 100], socialPersonalUnemploymentRate:[0, 100], socialPersonalInjuryRate:[0, 100],
  socialPersonalMaternityRate:[0, 100], socialPersonalMedicalRate:[0, 100], fundBase:[0, MONEY_MAX], fundActualBase:[0, MONEY_MAX], fundPersonalPaid:[0, MONEY_MAX], fundRate:[0, 100],
  fundPersonalRate:[0, 100], reimbursementAmount:[0, MONEY_MAX], annualLeaveWorkYears:[0, 100],
  annualLeaveTakenDays:[0, 100_000], annualLeavePriorUnusedDays:[0, 100_000], annualLeaveAveragePay:[0, MONEY_MAX],
  overtimeWageBase:[0, MONEY_MAX], weekdayOvertimeHours:[0, 100_000], restDayOvertimeHours:[0, 100_000],
  holidayOvertimeHours:[0, 100_000], compTimeWageBase:[0, MONEY_MAX], outstandingCompTimeDays:[0, 100_000],
  terminationAveragePay:[0, MONEY_MAX], terminationAdditionalMonths:[0, 9], terminationExtraPayBase:[0, MONEY_MAX],
  terminationLocalAveragePay:[0, MONEY_MAX], duePay:[0, MONEY_MAX], actualPay:[0, MONEY_MAX],
};
const SETUP_DATE_FIELDS = ["employmentDate", "cutoffDate", "departureDate", "contractStart", "contractEnd", "workInjuryDate", "terminationNoticeDate"];
const SETUP_MONTH_FIELDS = ["arrearsStartMonth", "socialPaidStartMonth", "socialPaidEndMonth", "fundPaidStartMonth", "fundPaidEndMonth", "startMonth", "endMonth"];
const SETUP_BOOLEAN_FIELDS = ["socialHasPaid", "fundHasPaid", "reimbursementIncluded", "annualLeaveWrittenWaiver", "restDayClaimsDistinct"];
const SETUP_TEXT_LIMITS = { reimbursementNote:500, terminationEmployeeName:80, terminationCompanyName:160, terminationNoticeContact:160 };
const SETUP_ENUMS = {
  employmentStatus:new Set(["active", "departed"]),
  terminationType:new Set(["forced", "layoff"]),
  personalResignationSigned:new Set(["yes", "no", "unknown"]),
  forcedNoticeSent:new Set(["yes", "no", "unknown"]),
  forcedNoticeProof:new Set(["yes", "no", "unknown"]),
  workInjuryKind:new Set(["work", "commute", "businessTrip", "occupationalDisease", "suddenDeath", "unclear"]),
  workInjuryCommuteResponsibility:new Set(["nonPrimary", "primary", "pending"]),
  workInjuryEmployerApplied:new Set(["yes", "no", "unknown"]),
};

export class BackupValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "BackupValidationError";
  }
}

const fail = message => { throw new BackupValidationError(message); };
const isRecord = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const checkedNumber = (value, label, min, max, integer = false) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    fail(`${label}不是允许范围内的数字。`);
  }
  return value;
};

const checkedText = (value, label, maxLength) => {
  if (typeof value !== "string" || value.length > maxLength) fail(`${label}格式错误或内容过长。`);
  return value;
};

const normalizeOptionalDate = (value, label) => {
  const text = checkedText(value, label, 10);
  if (!text) return "";
  if (isIsoDate(text)) return text;
  const legacy = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(text);
  if (legacy) {
    const normalized = `${legacy[1]}-${legacy[2].padStart(2, "0")}-${legacy[3].padStart(2, "0")}`;
    if (isIsoDate(normalized)) return normalized;
  }
  fail(`${label}不是有效日期。`);
};

const validateRow = (value, index) => {
  const label = `第 ${index + 1} 行`;
  if (!isRecord(value)) fail(`${label}明细不是有效对象。`);
  const row = value;
  const result = {
    id:checkedNumber(row.id, `${label}编号`, 1, Number.MAX_SAFE_INTEGER, true),
    wageMonth:row.wageMonth === undefined ? "" : checkedText(row.wageMonth, `${label}工资月份`, 7),
    payDate:normalizeOptionalDate(row.payDate, `${label}发薪日期`),
    note:checkedText(row.note, `${label}备注`, 500),
    status:checkedText(row.status, `${label}结清状态`, 3),
  };
  if (result.wageMonth && !isIsoMonth(result.wageMonth)) fail(`${label}工资月份不是有效月份。`);
  if (!STATUSES.has(result.status)) fail(`${label}结清状态无效。`);

  for (const key of ["normalPay", "paid", "duePay", "arrears", "contractPay", "socialPaid", "socialBase", "socialDue", "fundPaid", "fundBase", "fundDue"]) {
    result[key] = checkedNumber(row[key], `${label}${key}`, 0, MONEY_MAX);
  }
  for (const key of ["wageDeduction", "socialActualBase", "socialPersonalPaid", "fundActualBase", "fundPersonalPaid"]) {
    result[key] = row[key] === undefined ? 0 : checkedNumber(row[key], `${label}${key}`, 0, MONEY_MAX);
  }
  if (row.socialRate !== undefined) result.socialRate = checkedNumber(row.socialRate, `${label}社保比例`, 0, 100);
  if (row.fundRate !== undefined) result.fundRate = checkedNumber(row.fundRate, `${label}公积金比例`, 0, 100);
  return result;
};

const validateSetup = value => {
  if (!isRecord(value)) fail("基础测算条件缺失或格式错误。");
  const setup = {};
  for (const [key, range] of Object.entries(SETUP_NUMBER_RANGES)) {
    if (value[key] === undefined) continue;
    setup[key] = checkedNumber(value[key], key, range[0], range[1], key === "terminationAdditionalMonths");
  }
  for (const key of SETUP_DATE_FIELDS) {
    if (value[key] === undefined) continue;
    setup[key] = normalizeOptionalDate(value[key], key);
  }
  for (const key of SETUP_MONTH_FIELDS) {
    if (value[key] === undefined) continue;
    const month = checkedText(value[key], key, 7);
    if (month && !isIsoMonth(month)) fail(`${key}不是有效月份。`);
    setup[key] = month;
  }
  for (const key of SETUP_BOOLEAN_FIELDS) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== "boolean") fail(`${key}必须是布尔值。`);
    setup[key] = value[key];
  }
  for (const [key, maxLength] of Object.entries(SETUP_TEXT_LIMITS)) {
    if (value[key] === undefined) continue;
    setup[key] = checkedText(value[key], key, maxLength);
  }
  for (const [key, values] of Object.entries(SETUP_ENUMS)) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== "string" || !values.has(value[key])) fail(`${key}不是允许的选项。`);
    setup[key] = value[key];
  }
  if (setup.employmentDate && setup.cutoffDate && setup.employmentDate > setup.cutoffDate) fail("计薪截止日期不能早于入职日期。");
  if (setup.employmentStatus === "departed" && !setup.departureDate) fail("已离职状态必须填写离职日期。");
  if (setup.departureDate && setup.cutoffDate && setup.departureDate !== setup.cutoffDate) fail("离职日期必须与计薪截止日期一致。");
  if (setup.employmentDate && setup.departureDate && setup.employmentDate > setup.departureDate) fail("离职日期不能早于入职日期。");
  if (setup.employmentDate && setup.contractEnd && setup.employmentDate > setup.contractEnd) fail("合同期满日不能早于入职日期。");
  for (const [startKey, endKey, label] of [["socialPaidStartMonth", "socialPaidEndMonth", "社保实缴期间"], ["fundPaidStartMonth", "fundPaidEndMonth", "公积金实缴期间"]]) {
    if (setup[startKey] && setup[endKey] && setup[startKey] > setup[endKey]) fail(`${label}起止月份顺序错误。`);
  }
  return setup;
};

const validateDoubleRule = value => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) fail("双倍工资规则格式错误。");
  if (typeof value.enabled !== "boolean") fail("双倍工资启用状态格式错误。");
  const contractEnd = normalizeOptionalDate(value.contractEnd, "双倍工资合同期满日");
  const continuedUntil = normalizeOptionalDate(value.continuedUntil, "双倍工资持续用工截止日");
  if (contractEnd && continuedUntil && contractEnd > continuedUntil) fail("双倍工资持续用工截止日不能早于合同期满日。");
  return { enabled:value.enabled, contractEnd, continuedUntil };
};

export const assertBackupFileSize = size => {
  if (!Number.isFinite(size) || size < 1) fail("备份文件为空。");
  if (size > MAX_BACKUP_BYTES) fail("备份文件超过 2 MB，已停止导入。");
};

export const validateBackupPayload = value => {
  if (!isRecord(value)) fail("备份内容必须是 JSON 对象。");
  if (value.version !== undefined) checkedNumber(value.version, "备份版本", 1, CURRENT_BACKUP_VERSION, true);
  if (!Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > MAX_BACKUP_ROWS) fail(`明细行数必须为 1—${MAX_BACKUP_ROWS} 行。`);
  const rows = value.rows.map(validateRow);
  const setup = validateSetup(value.setup);
  const selectedClaims = value.selectedClaims === undefined ? ["wage", "social", "fund", "doublePay"] : value.selectedClaims;
  if (!Array.isArray(selectedClaims) || selectedClaims.length > CLAIMS.size || selectedClaims.some(item => typeof item !== "string" || !CLAIMS.has(item))) fail("测算事项包含未知选项。");
  const claims = [...new Set(selectedClaims)];
  if (claims.length !== selectedClaims.length) fail("测算事项存在重复值。");
  const flowStep = value.flowStep === undefined ? "results" : value.flowStep;
  if (typeof flowStep !== "string" || !FLOW_STEPS.has(flowStep)) fail("引导步骤状态无效。");
  const caseName = value.caseName === undefined ? "导入的欠款测算" : checkedText(value.caseName, "测算名称", 120).trim() || "导入的欠款测算";
  const rowsCutoffDate = value.rowsCutoffDate === undefined ? "" : normalizeOptionalDate(value.rowsCutoffDate, "明细计算截止日");
  return { version:value.version ?? 1, caseName, setup, selectedClaims:claims, flowStep, rowsCutoffDate, doubleRule:validateDoubleRule(value.doubleRule), rows };
};
