"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { assertBackupFileSize, BackupValidationError, validateBackupPayload } from "./backup-validation.mjs";
import { employmentSnapshotFor, restoredRowsNeedReview } from "./case-migration.mjs";
import { parseIsoDateLocal } from "./date-utils.mjs";
import { baseFromContributionAmount, contributionReconciliationForMonth, DEFAULT_PERSONAL_SOCIAL_RATES, DEFAULT_SOCIAL_RATES, declaredBaseFromPaidAmount, personalContributionGapsForArrears, socialContributionForMonth, totalEmployerRate, totalPersonalRate } from "./contribution-calculator.mjs";
import { annualLeaveCompensation, compTimeCompensation, currentYearEmploymentDays, dailyWage, overtimeCompensation, proratedAnnualLeaveDays, statutoryAnnualLeaveDays } from "./leave-overtime-calculator.mjs";
import { monthlyEmploymentSpan, proratedMonthlyWage } from "./monthly-wage-calculator.mjs";
import { roundMoney, sumMoney } from "./money-utils.mjs";
import { terminationCompensation } from "./termination-calculator.mjs";
import { buildTerminationNotice, safeTerminationNoticeFileName, TERMINATION_NOTICE_REASONS, TERMINATION_NOTICE_RIGHTS } from "./termination-notice.mjs";
import { WORK_INJURY_KINDS, workInjuryScreening } from "./work-injury-screening.mjs";
import { buildRightsRoutePlan } from "./rights-route-planner.mjs";
import { contributionGap, rowSettlementStatus, wageArrears } from "./row-calculator.mjs";
import { csvDocument } from "./csv-export.mjs";
import { addCalendarDays as addDays, addCalendarMonths as addMonths, automaticDoubleRuleFor, doublePayForMonth, oneYearContractEndFor } from "./double-pay-calculator.mjs";
import { claimOptions, defaultRule, defaultSetup, type Claim, type DoublePayRule, type FlowStep, type LegacyQuickSetup, type QuestionIssue, type QuickSetup, type RightsPlan, type Row, type SocialRates } from "./calculator-model";
import { generateMonthlyLedger } from "./monthly-ledger-calculator.mjs";
import { DotGridBackground } from "./dot-grid-background";
import { SplitText } from "./split-text";

type TerminationNoticeReason = keyof typeof TERMINATION_NOTICE_REASONS;
type TerminationNoticeRight = keyof typeof TERMINATION_NOTICE_RIGHTS;

const exampleRows: Row[] = [
  [1,"2025/06",0,"",0,"已结清",0,0,20000,384.96,4812,3979.256,250,2490,2101.2],
  [2,"2025-07-10",10363.34,"6月工资",0,"已结清",0,0,20000,384.96,4812,3979.256,250,2490,2101.2],
  [3,"2025/8/11",14088.65,"7月工资",0,"已结清",0,0,20000,384.96,4812,3979.256,250,2490,2101.2],
  [4,"2025/9/10",16931.75,"8月工资",0,"已结清",0,0,20000,398.88,4986,3933.668,250,2490,2101.2],
  [5,"2025/10/11",18532.34,"9月工资",0,"已结清",0,0,20000,398.88,4986,3933.668,250,2490,2101.2],
  [6,"2025/11/10",17866.99,"10月工资",0,"已结清",0,0,20000,398.88,4986,3933.668,250,2490,2101.2],
  [7,"2025/12/10",0,"11月工资",17891.18,"已结清",0,0,20000,398.88,4986,3933.668,250,2490,2101.2],
  [8,"2026/1/10",0,"12月工资",17916.32,"已结清",0,0,20000,398.88,4986,3933.668,250,2490,2101.2],
  [9,"2026/2/10",0,"1月工资",18920.92,"已结清",0,0,20000,398.88,4986,3933.668,250,2490,2101.2],
  [10,"2026/3/10",0,"发2月工资的30%",5676.28,"未结清",18920.92,13244.64,20000,398.88,4986,3933.668,250,2490,2101.2],
  [11,"2026/4/10",0,"实际应发3月工资",0,"未结清",18000,18000,20000,398.88,4986,3933.668,250,2490,2101.2],
  [12,"2026/5/10",0,"实际应发4月工资",0,"未结清",18000,18000,20000,398.88,4986,3933.668,250,2490,2101.2],
  [13,"2026/6/10",0,"实际应发5月工资",0,"未结清",18000,18000,20000,398.88,4986,3933.668,250,2490,2101.2],
  [14,"2026/7/10",0,"实际应发6月工资",0,"未结清",18000,18000,20000,398.88,4986,3933.668,250,2490,2101.2],
].map(([id,payDate,normalPay,note,paid,status,duePay,arrears,contractPay,,socialActualBase,,fundPaid,,fundDue], index) => {
  const start = new Date(2025, 5 + Math.max(0, index - 1), 1);
  const wageMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  const targetBase = Number(contractPay || 0);
  const social = socialContributionForMonth({expectedBase:targetBase,actualBase:Number(socialActualBase||0),rates:DEFAULT_SOCIAL_RATES});
  return { id, wageMonth, payDate, normalPay, note, paid, status, duePay, arrears, contractPay, wageDeduction:0, socialPaid:social.actual, socialBase:targetBase, socialActualBase:Number(socialActualBase||0), socialPersonalPaid:0, socialRate:social.rate, socialDue:social.gap, fundPaid, fundBase:targetBase, fundActualBase:2490, fundPersonalPaid:0, fundRate:targetBase ? (Number(fundDue)+Number(fundPaid))/targetBase*100 : 0, fundDue } as Row;
});

const blankRow = (): Row => ({ id: Date.now(), wageMonth:"", payDate:"", normalPay:0, note:"", paid:0, status:"未结清", duePay:0, arrears:0, contractPay:0, wageDeduction:0, socialPaid:0, socialBase:0, socialActualBase:0, socialPersonalPaid:0, socialRate:0, socialDue:0, fundPaid:0, fundBase:0, fundActualBase:0, fundPersonalPaid:0, fundRate:0, fundDue:0 });

const socialDueFor = (row: Row) => contributionGap({base:row.socialBase,rate:row.socialRate,paid:row.socialPaid});
const fundDueFor = (row: Row) => contributionGap({base:row.fundBase,rate:row.fundRate,paid:row.fundPaid});
const monthCountBetween = (startValue: string, endValue: string) => {
  const start = atMidnight(startValue), end = atMidnight(endValue);
  if (!start || !end || end < start) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
};
const normalizeRow = (row: Row, index = 0): Row => {
  const extended = {...row,
    wageDeduction:Number(row.wageDeduction||0),
    socialActualBase:Number(row.socialActualBase||0),socialPersonalPaid:Number(row.socialPersonalPaid||0),
    fundActualBase:Number(row.fundActualBase||0),fundPersonalPaid:Number(row.fundPersonalPaid||0),
  } as Row;
  if (row.socialRate != null && row.fundRate != null) return {...extended,status:rowSettlementStatus(extended)};
  const fallback = exampleRows[Math.min(index, exampleRows.length - 1)] || blankRow();
  const socialBase = Number(row.contractPay || row.socialBase || 0);
  const fundBase = Number(row.contractPay || row.fundBase || 0);
  const normalized = {
    ...fallback, ...extended, socialBase, fundBase,
    socialRate: socialBase ? (Number(row.socialDue || 0) + Number(row.socialPaid || 0)) / socialBase * 100 : 0,
    fundRate: fundBase ? (Number(row.fundDue || 0) + Number(row.fundPaid || 0)) / fundBase * 100 : 0,
  } as Row;
  return {...normalized,status:rowSettlementStatus(normalized)};
};

const money = (value: number) => value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = (value: number) => value.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const atMidnight = (value: string) => parseIsoDateLocal(value);
const dateLabel = (date: Date | null) => date ? date.toLocaleDateString("zh-CN") : "—";
const normalizeSetup = (old: LegacyQuickSetup = {}): QuickSetup => {
  const employmentDate = old.employmentDate || (old.startMonth ? `${old.startMonth}-01` : "");
  const { employmentStatus, departureDate, cutoffDate } = employmentSnapshotFor(old, todayInputValue());
  const current = {...old};
  delete current.startMonth;
  delete current.endMonth;
  delete current.duePay;
  delete current.actualPay;
  const legacyDefaultRates = Number(old.socialPensionRate)===14
    && Number(old.socialUnemploymentRate)===2
    && Number(old.socialInjuryRate)===0.8
    && Number(old.socialMaternityRate)===0.6
    && Number(old.socialMedicalRate)===11.5;
  const storedRates: SocialRates = {
    pension:Number(old.socialPensionRate ?? DEFAULT_SOCIAL_RATES.pension), unemployment:Number(old.socialUnemploymentRate ?? DEFAULT_SOCIAL_RATES.unemployment),
    injury:Number(old.socialInjuryRate ?? DEFAULT_SOCIAL_RATES.injury), maternity:Number(old.socialMaternityRate ?? DEFAULT_SOCIAL_RATES.maternity), medical:Number(old.socialMedicalRate ?? DEFAULT_SOCIAL_RATES.medical),
  };
  const rates:SocialRates = legacyDefaultRates
    ? {...DEFAULT_SOCIAL_RATES}
    : {...storedRates,maternity:0,medical:storedRates.medical+storedRates.maternity};
  const socialRate = totalEmployerRate(rates);
  const storedPersonalRates:SocialRates = {
    pension:Number(old.socialPersonalPensionRate ?? DEFAULT_PERSONAL_SOCIAL_RATES.pension), unemployment:Number(old.socialPersonalUnemploymentRate ?? DEFAULT_PERSONAL_SOCIAL_RATES.unemployment),
    injury:Number(old.socialPersonalInjuryRate ?? DEFAULT_PERSONAL_SOCIAL_RATES.injury), maternity:Number(old.socialPersonalMaternityRate ?? DEFAULT_PERSONAL_SOCIAL_RATES.maternity), medical:Number(old.socialPersonalMedicalRate ?? DEFAULT_PERSONAL_SOCIAL_RATES.medical),
  };
  const personalRates:SocialRates = {...storedPersonalRates,maternity:0,medical:storedPersonalRates.medical+storedPersonalRates.maternity};
  const socialActualBase = Number(old.socialActualBase||0)
    || declaredBaseFromPaidAmount(Number(old.socialPersonalPaid||0), personalRates)
    || declaredBaseFromPaidAmount(Number(old.socialPaid||0), rates);
  return {...defaultSetup, ...current, employmentStatus, employmentDate, departureDate, cutoffDate, contractStart:old.contractStart || employmentDate, socialActualBase, socialRate,
    socialPensionRate:rates.pension, socialUnemploymentRate:rates.unemployment, socialInjuryRate:rates.injury, socialMaternityRate:rates.maternity, socialMedicalRate:rates.medical,
    socialPersonalPensionRate:personalRates.pension, socialPersonalUnemploymentRate:personalRates.unemployment, socialPersonalInjuryRate:personalRates.injury,
    socialPersonalMaternityRate:personalRates.maternity, socialPersonalMedicalRate:personalRates.medical,
    fundRate:Number(old.fundRate||0)>0?Number(old.fundRate):5, fundPersonalRate:Number(old.fundPersonalRate ?? 5),
    socialHasPaid:old.socialHasPaid ?? Number(old.socialPaid||old.socialPersonalPaid||old.socialActualBase||0)>0,
    fundHasPaid:old.fundHasPaid ?? Number(old.fundPaid||old.fundPersonalPaid||old.fundActualBase||0)>0};
};
const todayInputValue = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; };
const fields: { key: keyof Row; label: string; group?: string; width?: number }[] = [
  {key:"wageMonth",label:"工资所属月",width:112}, {key:"payDate",label:"实际发薪日",width:126}, {key:"normalPay",label:"已发工资",width:116},
  {key:"note",label:"备注",width:178}, {key:"paid",label:"后续补发",width:108},
  {key:"status",label:"结清状态",width:100}, {key:"wageDeduction",label:"请假等扣款",width:110}, {key:"duePay",label:"应发薪水",width:110},
  {key:"arrears",label:"欠薪",width:108}, {key:"contractPay",label:"合同月薪",width:110},
  {key:"socialPaid",label:"公司实际已缴",group:"社保",width:112}, {key:"socialPersonalPaid",label:"个人实际已扣",group:"社保",width:112}, {key:"socialActualBase",label:"实际申报基数",group:"社保",width:115}, {key:"socialBase",label:"应缴基数",group:"社保",width:105}, {key:"socialRate",label:"公司比例(%)",group:"社保",width:104},
  {key:"socialDue",label:"尚欠补缴金额",group:"社保",width:122}, {key:"fundPaid",label:"公司实际已缴",group:"公积金",width:112},
  {key:"fundPersonalPaid",label:"个人实际已扣",group:"公积金",width:112}, {key:"fundActualBase",label:"实际缴存基数",group:"公积金",width:115}, {key:"fundBase",label:"应缴基数",group:"公积金",width:105}, {key:"fundRate",label:"公司比例(%)",group:"公积金",width:104}, {key:"fundDue",label:"尚欠补缴金额",group:"公积金",width:122},
];

export default function Home() {
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [doubleRule, setDoubleRule] = useState<DoublePayRule>(defaultRule);
  const [setup, setSetup] = useState<QuickSetup>(defaultSetup);
  const [selectedClaims, setSelectedClaims] = useState<Claim[]>([]);
  const [flowStep, setFlowStep] = useState<FlowStep>("basic");
  const [precisionOpen, setPrecisionOpen] = useState(false);
  const [caseName, setCaseName] = useState("我的欠款测算");
  const [filter, setFilter] = useState<"全部" | "未结清" | "已结清">("全部");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState("");
  const [terminationNoticeReasonOverrides, setTerminationNoticeReasonOverrides] = useState<Partial<Record<TerminationNoticeReason, boolean>>>({});
  const [terminationNoticeRightOverrides, setTerminationNoticeRightOverrides] = useState<Partial<Record<TerminationNoticeRight, boolean>>>({});
  const importInput = useRef<HTMLInputElement>(null);

  // Restore browser-only state once after hydration for this local-first app.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const today = todayInputValue();
    const cached = localStorage.getItem("xinbao-rows");
    if (cached) try {
      const parsed = JSON.parse(cached) as Row[];
      setRows(parsed.map((row, index) => normalizeRow({ ...row, wageMonth: row.wageMonth || exampleRows[index]?.wageMonth || "" } as Row, index)));
    } catch { /* use seed data */ }
    const cachedRule = localStorage.getItem("xinbao-double-rule");
    let restoredRule = defaultRule;
    if (cachedRule) try { restoredRule = {...defaultRule, ...JSON.parse(cachedRule)}; setDoubleRule(restoredRule); } catch { /* use defaults */ }
    const cachedMeta = localStorage.getItem("xinbao-meta");
    if (cachedMeta) {
      try {
        const meta = JSON.parse(cachedMeta), old = meta.setup || {};
        const snapshot = employmentSnapshotFor({...old, cutoffDate:old.cutoffDate || restoredRule.continuedUntil}, today);
        const normalizedSetup = normalizeSetup({...old, contractEnd:old.contractEnd || restoredRule.contractEnd, cutoffDate:old.cutoffDate || restoredRule.continuedUntil});
        const rowsCutoffDate = meta.rowsCutoffDate || snapshot.sourceCutoffDate;
        const staleRows = restoredRowsNeedReview({employmentStatus:normalizedSetup.employmentStatus,rowsCutoffDate,today});
        setCaseName(meta.caseName || "我的欠款测算");
        setSetup(normalizedSetup);
        setSelectedClaims(Array.isArray(meta.selectedClaims) ? meta.selectedClaims : ["wage","social","fund","doublePay"]);
        setFlowStep(snapshot.needsStatusConfirmation || staleRows ? "basic" : meta.flowStep || "results");
        if (snapshot.needsStatusConfirmation) setRestoreNotice("这是旧版存档，原统计截止日不能证明已经离职。系统暂按在职处理，请确认任职状态后重新生成明细。");
        else if (staleRows) setRestoreNotice(`存档明细计算至 ${rowsCutoffDate}，当前在职应计算至 ${today}。为保留你的逐月调整，系统未自动覆盖，请核对后重新生成明细。`);
      } catch {
        setSetup(current => ({...current,cutoffDate:today,departureDate:""}));
      }
    } else {
      setSetup(current => ({...current,cutoffDate:today,departureDate:""}));
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const wageEnabled=selectedClaims.includes("wage"), socialEnabled=selectedClaims.includes("social"), fundEnabled=selectedClaims.includes("fund"), doublePayEnabled=selectedClaims.includes("doublePay"), reimbursementEnabled=selectedClaims.includes("reimbursement"), annualLeaveEnabled=selectedClaims.includes("annualLeave"), overtimeEnabled=selectedClaims.includes("overtime"), compTimeEnabled=selectedClaims.includes("compTime"), terminationEnabled=selectedClaims.includes("termination"), workInjuryEnabled=selectedClaims.includes("workInjury");
  const inferredEmploymentMonth=setup.employmentDate.slice(0,7);
  const effectiveSocialStart=setup.socialPaidStartMonth || inferredEmploymentMonth;
  const hasSocialPaidPeriod=Boolean(setup.socialHasPaid&&effectiveSocialStart&&setup.socialPaidEndMonth);
  const effectiveFundStart=setup.fundPaidStartMonth || (hasSocialPaidPeriod?effectiveSocialStart:inferredEmploymentMonth);
  const effectiveFundEnd=setup.fundPaidEndMonth || (hasSocialPaidPeriod?setup.socialPaidEndMonth:"");
  const socialRates: SocialRates = {pension:Number(setup.socialPensionRate||0),unemployment:Number(setup.socialUnemploymentRate||0),injury:Number(setup.socialInjuryRate||0),maternity:Number(setup.socialMaternityRate||0),medical:Number(setup.socialMedicalRate||0)};
  const personalSocialRates:SocialRates = {pension:Number(setup.socialPersonalPensionRate||0),unemployment:Number(setup.socialPersonalUnemploymentRate||0),injury:Number(setup.socialPersonalInjuryRate||0),maternity:Number(setup.socialPersonalMaternityRate||0),medical:Number(setup.socialPersonalMedicalRate||0)};
  const effectiveSocialRate = socialEnabled ? totalEmployerRate(socialRates) : 0;
  const effectivePersonalSocialRate = socialEnabled ? totalPersonalRate(personalSocialRates) : 0;
  const inferredSocialActualBase = socialEnabled&&setup.socialHasPaid ? declaredBaseFromPaidAmount(Number(setup.socialPersonalPaid||0),personalSocialRates) : 0;
  const effectiveSocialActualBase = socialEnabled&&setup.socialHasPaid ? Number(setup.socialActualBase||inferredSocialActualBase||0) : 0;
  const effectiveSocialBase = socialEnabled ? Number(setup.socialBase||setup.contractPay||0) : 0;
  const effectiveFundBase = fundEnabled ? Number(setup.fundBase||setup.contractPay||0) : 0;
  const effectiveFundPersonalRate = fundEnabled ? Number(setup.fundPersonalRate||0) : 0;
  const effectiveFundRate = fundEnabled ? Number(setup.fundRate||5) : 0;
  const inferredFundActualBase = fundEnabled&&setup.fundHasPaid ? baseFromContributionAmount(Number(setup.fundPersonalPaid||0),effectiveFundPersonalRate) : 0;
  const effectiveFundActualBase = fundEnabled&&setup.fundHasPaid ? Number(setup.fundActualBase||inferredFundActualBase||0) : 0;
  const setupSocialActualPersonal = setup.socialHasPaid
    ? Number(setup.socialPersonalPaid||roundMoney(effectiveSocialActualBase*effectivePersonalSocialRate/100)) : 0;
  const setupSocialActualEmployer = setup.socialHasPaid
    ? Number(setup.socialPaid||roundMoney(effectiveSocialActualBase*effectiveSocialRate/100)) : 0;
  const setupFundActualPersonal = setup.fundHasPaid
    ? Number(setup.fundPersonalPaid||roundMoney(effectiveFundActualBase*effectiveFundPersonalRate/100)) : 0;
  const setupFundActualEmployer = setup.fundHasPaid
    ? Number(setup.fundPaid||roundMoney(effectiveFundActualBase*effectiveFundRate/100)) : 0;
  const effectiveDoubleRule = useMemo(() => doublePayEnabled ? automaticDoubleRuleFor(setup, doubleRule) : defaultRule, [setup, doubleRule, doublePayEnabled]);
  const doubleById = useMemo(() => new Map(rows.map(row => [row.id, doublePayForMonth(row, effectiveDoubleRule)])), [rows, effectiveDoubleRule]);
  const socialReconciliationForRow=useMemo(()=>(row:Row)=>contributionReconciliationForMonth({
    expectedBase:socialEnabled?Number(row.socialBase||effectiveSocialBase):0,
    actualBase:socialEnabled?Number(row.socialActualBase||0):0,
    employerRate:socialEnabled?Number(row.socialRate||effectiveSocialRate):0,
    personalRate:socialEnabled?effectivePersonalSocialRate:0,
    actualEmployerPaid:socialEnabled?Number(row.socialPaid||0):0,
    actualPersonalPaid:socialEnabled?Number(row.socialPersonalPaid||0):0,
  }),[socialEnabled,effectiveSocialBase,effectiveSocialRate,effectivePersonalSocialRate]);
  const fundReconciliationForRow=useMemo(()=>(row:Row)=>contributionReconciliationForMonth({
    expectedBase:fundEnabled?Number(row.fundBase||effectiveFundBase):0,
    actualBase:fundEnabled?Number(row.fundActualBase||0):0,
    employerRate:fundEnabled?Number(row.fundRate||effectiveFundRate):0,
    personalRate:fundEnabled?effectiveFundPersonalRate:0,
    actualEmployerPaid:fundEnabled?Number(row.fundPaid||0):0,
    actualPersonalPaid:fundEnabled?Number(row.fundPersonalPaid||0):0,
  }),[fundEnabled,effectiveFundBase,effectiveFundRate,effectiveFundPersonalRate]);
  const personalForRow=useMemo(()=>(row:Row)=>personalContributionGapsForArrears({
    arrears:wageEnabled?Number(row.arrears||0):0,
    socialGap:socialReconciliationForRow(row).personalGap,
    fundGap:fundReconciliationForRow(row).personalGap,
  }), [wageEnabled,socialReconciliationForRow,fundReconciliationForRow]);
  const totals = useMemo(() => rows.reduce((a, r) => ({
    normal:sumMoney([a.normal,r.normalPay]), paid:sumMoney([a.paid,r.paid]),
    arrears:sumMoney([a.arrears,r.arrears]), deduction:sumMoney([a.deduction,r.wageDeduction]), social:sumMoney([a.social,socialReconciliationForRow(r).employerGap]),
    fund:sumMoney([a.fund,fundReconciliationForRow(r).employerGap]), double:sumMoney([a.double,doubleById.get(r.id)||0]),
    socialActual:sumMoney([a.socialActual,socialReconciliationForRow(r).employerActual]), socialExpected:sumMoney([a.socialExpected,socialReconciliationForRow(r).employerExpected]),
    fundActual:sumMoney([a.fundActual,fundReconciliationForRow(r).employerActual]), fundExpected:sumMoney([a.fundExpected,fundReconciliationForRow(r).employerExpected]),
    personalSocialExpected:sumMoney([a.personalSocialExpected,socialReconciliationForRow(r).personalExpected]), personalSocialActual:sumMoney([a.personalSocialActual,socialReconciliationForRow(r).personalActual]), personalSocialGap:sumMoney([a.personalSocialGap,socialReconciliationForRow(r).personalGap]),
    personalFundExpected:sumMoney([a.personalFundExpected,fundReconciliationForRow(r).personalExpected]), personalFundActual:sumMoney([a.personalFundActual,fundReconciliationForRow(r).personalActual]), personalFundGap:sumMoney([a.personalFundGap,fundReconciliationForRow(r).personalGap]),
    personalSocial:sumMoney([a.personalSocial,personalForRow(r).social]), personalFund:sumMoney([a.personalFund,personalForRow(r).fund]),
  }), {normal:0,paid:0,arrears:0,deduction:0,social:0,fund:0,double:0,socialActual:0,socialExpected:0,fundActual:0,fundExpected:0,personalSocialExpected:0,personalSocialActual:0,personalSocialGap:0,personalFundExpected:0,personalFundActual:0,personalFundGap:0,personalSocial:0,personalFund:0}), [rows, doubleById, personalForRow,socialReconciliationForRow,fundReconciliationForRow]);
  const wageArrearsMonths = useMemo(() => [...new Set(rows
    .filter(row => Number(row.arrears || 0) > 0 && /^\d{4}-\d{2}$/.test(row.wageMonth))
    .map(row => row.wageMonth))].sort(), [rows]);
  const wageArrearsPeriod = wageArrearsMonths.length
    ? wageArrearsMonths.length === 1
      ? wageArrearsMonths[0]
      : `${wageArrearsMonths[0]} 至 ${wageArrearsMonths[wageArrearsMonths.length - 1]}`
    : "当前未形成欠薪";
  const reimbursementTotal = reimbursementEnabled&&setup.reimbursementIncluded ? Number(setup.reimbursementAmount||0) : 0;
  const rowClaimTotal = (row: Row) => sumMoney([wageEnabled?row.arrears:0,socialEnabled?socialDueFor(row):0,fundEnabled?fundDueFor(row):0,doublePayEnabled?doubleById.get(row.id)||0:0]);
  const setupMonths = monthCountBetween(setup.employmentDate, setup.cutoffDate);
  const systemDueForRow=(row:Row)=>proratedMonthlyWage({monthlyWage:setup.contractPay,wageMonth:row.wageMonth,employmentDate:setup.employmentDate,cutoffDate:setup.cutoffDate});
  const monthlyWageAdjustedCount=rows.filter(row=>Math.abs(Number(row.duePay||0)-roundMoney(Math.max(0,systemDueForRow(row)-Number(row.wageDeduction||0))))>=0.01||Number(row.wageDeduction||0)>0).length;
  const setupSocialMonthly = contributionReconciliationForMonth({expectedBase:effectiveSocialBase,actualBase:effectiveSocialActualBase,employerRate:effectiveSocialRate,personalRate:effectivePersonalSocialRate,actualEmployerPaid:setupSocialActualEmployer,actualPersonalPaid:setupSocialActualPersonal});
  const setupSocialActualMonthly = setupSocialMonthly.employerActual;
  const setupFundMonthly = contributionReconciliationForMonth({expectedBase:effectiveFundBase,actualBase:effectiveFundActualBase,employerRate:effectiveFundRate,personalRate:effectiveFundPersonalRate,actualEmployerPaid:setupFundActualEmployer,actualPersonalPaid:setupFundActualPersonal});
  const annualLeaveStatutoryDays=statutoryAnnualLeaveDays(setup.annualLeaveWorkYears);
  const annualLeaveElapsedDays=currentYearEmploymentDays(setup.employmentDate,setup.cutoffDate);
  const annualLeaveCurrentYearDays=annualLeaveEnabled?proratedAnnualLeaveDays({employmentDate:setup.employmentDate,cutoffDate:setup.cutoffDate,cumulativeWorkYears:setup.annualLeaveWorkYears,takenDays:setup.annualLeaveTakenDays}):0;
  const annualLeaveUnusedDays=annualLeaveCurrentYearDays+Number(setup.annualLeavePriorUnusedDays||0);
  const effectiveAnnualLeavePay=Number(setup.annualLeaveAveragePay||setup.contractPay||0);
  const annualLeaveTotal=annualLeaveEnabled?annualLeaveCompensation({averageMonthlyPay:effectiveAnnualLeavePay,unusedDays:annualLeaveUnusedDays,writtenWaiver:setup.annualLeaveWrittenWaiver}):0;
  const effectiveOvertimeBase=Number(setup.overtimeWageBase||setup.contractPay||0);
  const overtimeBreakdown=overtimeCompensation({monthlyWageBase:effectiveOvertimeBase,weekdayHours:setup.weekdayOvertimeHours,restDayHours:setup.restDayOvertimeHours,holidayHours:setup.holidayOvertimeHours});
  const overtimeTotal=overtimeEnabled?overtimeBreakdown.total:0;
  const effectiveCompTimeBase=Number(setup.compTimeWageBase||setup.contractPay||0);
  const compTimeTotal=compTimeEnabled?compTimeCompensation({monthlyWageBase:effectiveCompTimeBase,outstandingDays:setup.outstandingCompTimeDays}):0;
  const effectiveTerminationAveragePay=Number(setup.terminationAveragePay||setup.contractPay||0);
  const effectiveTerminationExtraPayBase=Number(setup.terminationExtraPayBase||effectiveTerminationAveragePay||0);
  const terminationBreakdown=terminationCompensation({employmentDate:setup.employmentDate,terminationDate:setup.cutoffDate,averageMonthlyPay:effectiveTerminationAveragePay,localAverageMonthlyPay:setup.terminationLocalAveragePay,extraMonths:setup.terminationType==="layoff"?setup.terminationAdditionalMonths:0,extraMonthlyPay:effectiveTerminationExtraPayBase});
  const terminationTotal=terminationEnabled?terminationBreakdown.total:0;
  const workInjuryResult=workInjuryScreening({kind:setup.workInjuryKind,commuteResponsibility:setup.workInjuryCommuteResponsibility,incidentDate:setup.workInjuryDate});
  const workInjuryFilingNote=setup.workInjuryEmployerApplied==="yes"?"单位已申请：请保存受理决定、申报材料和后续认定文书。":setup.workInjuryEmployerApplied==="no"?"单位未申请：不要只等待单位处理，注意个人通常为事故后 1 年内的申请期限。":"申报情况不清楚：建议尽快向单位或当地人社部门核实是否已经受理。";
  const grossDirectClaims=sumMoney([wageEnabled?totals.arrears:0,doublePayEnabled?totals.double:0,reimbursementTotal,annualLeaveTotal,overtimeTotal,compTimeTotal,terminationTotal]);
  const personalContributionTotal=sumMoney([totals.personalSocial,totals.personalFund]);
  const socialAccountTopUpTotal=sumMoney([socialEnabled?totals.social:0,socialEnabled?totals.personalSocialGap:0]);
  const fundAccountTopUpTotal=sumMoney([fundEnabled?totals.fund:0,fundEnabled?totals.personalFundGap:0]);
  const contributionAccountTopUpTotal=sumMoney([socialAccountTopUpTotal,fundAccountTopUpTotal]);
  const rightsFulfillmentTotal=sumMoney([grossDirectClaims,socialEnabled?totals.social:0,fundEnabled?totals.fund:0]);
  const toSocialAccount=sumMoney([socialEnabled?totals.social:0,totals.personalSocial]);
  const toFundAccount=sumMoney([fundEnabled?totals.fund:0,totals.personalFund]);
  const expectedPersonalActual=roundMoney(Math.max(0,rightsFulfillmentTotal-toSocialAccount-toFundAccount));
  const needsRestDayDistinctConfirmation=overtimeEnabled&&compTimeEnabled&&Number(setup.restDayOvertimeHours)>0&&Number(setup.outstandingCompTimeDays)>0;
  const visible = rows.filter(r => (filter === "全部" || rowSettlementStatus(r) === filter) && `${r.payDate}${r.note}`.includes(query));
  const basicReady=Boolean(setup.employmentDate&&setup.cutoffDate&&Number(setup.contractPay)>0&&setup.employmentDate<=setup.cutoffDate&&(setup.employmentStatus==="active"||setup.departureDate));
  const firstQuestionMonth=setup.employmentDate.slice(0,7), lastQuestionMonth=setup.cutoffDate.slice(0,7);
  const questionIssues:QuestionIssue[]=[];
  const addQuestionIssue=(id:string,message:string,targetId:string)=>questionIssues.push({id,message,targetId});
  if (wageEnabled) {
    if (!setup.arrearsStartMonth) addQuestionIssue("wage-start","“开始欠薪月份”尚未填写。","question-wage-start");
    else if (setup.arrearsStartMonth<firstQuestionMonth||setup.arrearsStartMonth>lastQuestionMonth) addQuestionIssue("wage-start","开始欠薪月份必须位于入职月份和计薪截止月份之间。","question-wage-start");
    if (Number(setup.firstArrearsPaidRate)<0||Number(setup.firstArrearsPaidRate)>100) addQuestionIssue("wage-rate","首个欠薪月已发比例只能填写 0%—100%。","question-wage-rate");
  }
  if (annualLeaveEnabled&&Number(setup.annualLeaveWorkYears)<1) addQuestionIssue("annual-leave-years","累计工作满 1 年后才享受法定年休假，请核对工作年限。","question-annual-leave-years");
  if (overtimeEnabled&&Number(setup.weekdayOvertimeHours)<=0&&Number(setup.restDayOvertimeHours)<=0&&Number(setup.holidayOvertimeHours)<=0) addQuestionIssue("overtime-hours","至少填写一类尚未支付的加班时数。","question-overtime-hours");
  if (compTimeEnabled&&Number(setup.outstandingCompTimeDays)<=0) addQuestionIssue("comp-time-days","“尚未补休的休息日加班”天数尚未填写。","question-comp-time-days");
  if (needsRestDayDistinctConfirmation&&!setup.restDayClaimsDistinct) addQuestionIssue("rest-day-distinct","请确认加班工资与调休折现不是同一批休息日加班。","question-rest-day-distinct");
  if (doublePayEnabled) {
    if (!setup.contractEnd) addQuestionIssue("contract-end","“合同上写的最后一天”尚未填写。","question-contract-end");
    else if (setup.contractEnd<setup.employmentDate) addQuestionIssue("contract-end","合同期满日不能早于入职日期。","question-contract-end");
    else if (setup.contractEnd>setup.cutoffDate) addQuestionIssue("contract-end","合同期满日晚于计薪截止日期，无法判断到期后持续用工。","question-contract-end");
  }
  if (socialEnabled) {
    if (effectiveSocialRate<=0||effectiveSocialRate>100) addQuestionIssue("social-rate","社保公司费率合计需大于 0% 且不超过 100%。","question-social-rate");
    if (setup.socialHasPaid) {
      if (effectiveSocialActualBase<=0) addQuestionIssue("social-base","请填写工资表个人社保扣款，或填写官方实际申报基数。","question-social-personal-paid");
      if (!setup.socialPaidEndMonth) addQuestionIssue("social-period","“社保最后缴到月份”尚未填写。","question-social-end");
      else if (effectiveSocialStart>setup.socialPaidEndMonth||effectiveSocialStart<firstQuestionMonth||setup.socialPaidEndMonth>lastQuestionMonth) addQuestionIssue("social-period","社保实际缴纳期间必须位于入职月份和计薪截止月份之间，且开始月份不能晚于截止月份。","question-social-start");
    }
  }
  if (fundEnabled) {
    if (Number(setup.fundRate)<=0||Number(setup.fundRate)>100) addQuestionIssue("fund-rate","公积金单位比例需大于 0% 且不超过 100%。","question-fund-rate");
    if (setup.fundHasPaid) {
      if (effectiveFundActualBase<=0&&Number(setup.fundPaid)<=0) addQuestionIssue("fund-paid","请填写工资表个人公积金扣款、实际缴存基数或单位实缴金额。","question-fund-personal-paid");
      if (!effectiveFundEnd) addQuestionIssue("fund-period","“公积金最后缴到月份”尚未填写。","question-fund-end");
      else if (effectiveFundStart>effectiveFundEnd||effectiveFundStart<firstQuestionMonth||effectiveFundEnd>lastQuestionMonth) addQuestionIssue("fund-period","公积金实际缴纳期间必须位于入职月份和计薪截止月份之间，且开始月份不能晚于截止月份。","question-fund-start");
    }
  }
  if (reimbursementEnabled&&Number(setup.reimbursementAmount)<=0) addQuestionIssue("reimbursement-amount","“尚未支付的报销金额”尚未填写。","question-reimbursement-amount");
  const questionsReady=selectedClaims.length>0&&questionIssues.length===0;
  const hasQuestionIssue=(targetId:string)=>questionIssues.some(issue=>issue.targetId===targetId);
  const exceptionRows=rows.filter(r=>rowClaimTotal(r)>0);
  const hasReimbursementException=reimbursementEnabled&&Number(setup.reimbursementAmount)>0;
  const hasAnnualLeaveException=annualLeaveEnabled&&annualLeaveTotal>0;
  const hasOvertimeException=overtimeEnabled&&overtimeTotal>0;
  const hasCompTimeException=compTimeEnabled&&compTimeTotal>0;
  const hasTerminationException=terminationEnabled&&terminationTotal>0;
  const exceptionCount=exceptionRows.length+(hasReimbursementException?1:0)+(hasAnnualLeaveException?1:0)+(hasOvertimeException?1:0)+(hasCompTimeException?1:0)+(hasTerminationException?1:0);
  const rightsPlan=buildRightsRoutePlan({
    wageDue:wageEnabled?totals.arrears:0,
    socialEnabled,socialDue:socialEnabled?totals.social:0,socialHasPaid:setup.socialHasPaid,
    fundEnabled,fundDue:fundEnabled?totals.fund:0,fundHasPaid:setup.fundHasPaid,
    doublePayDue:doublePayEnabled?totals.double:0,
    reimbursementDue:reimbursementEnabled?Number(setup.reimbursementAmount||0):0,
    annualLeaveDue:annualLeaveTotal,overtimeDue:overtimeTotal,compTimeDue:compTimeTotal,
    terminationEnabled,terminationType:setup.terminationType,personalResignationSigned:setup.personalResignationSigned,
    forcedNoticeSent:setup.forcedNoticeSent,forcedNoticeProof:setup.forcedNoticeProof,
    workInjuryEnabled,
  }) as RightsPlan;
  const terminationNoticeReasonOptions:{key:TerminationNoticeReason;label:string;description:string;automatic:boolean}[]=[];
  if (wageEnabled&&totals.arrears>0) terminationNoticeReasonOptions.push({key:"wage",label:"未及时足额支付劳动报酬",description:`系统已测算欠薪 ¥ ${money(totals.arrears)}，默认写入通知。`,automatic:true});
  if (socialEnabled&&totals.social>0&&!setup.socialHasPaid) terminationNoticeReasonOptions.push({key:"socialUnpaid",label:"未依法缴纳社会保险费",description:"系统记录为未缴社保，默认写入通知；发送前仍需核对官方缴费记录。",automatic:true});
  if (socialEnabled&&totals.social>0&&setup.socialHasPaid) terminationNoticeReasonOptions.push({key:"socialUnderpaid",label:"社保基数或金额可能不足",description:"各地对基数偏低能否支持被迫解除存在差异，系统不默认勾选。",automatic:false});
  const terminationNoticeReasons=terminationNoticeReasonOptions.filter(option=>terminationNoticeReasonOverrides[option.key]??option.automatic).map(option=>option.key);
  const terminationNoticeRightAmounts:Partial<Record<TerminationNoticeRight,number>>={
    wage:totals.arrears,social:socialAccountTopUpTotal,fund:fundAccountTopUpTotal,
    reimbursement:Number(setup.reimbursementAmount||0),overtime:overtimeTotal,
  };
  const terminationNoticeRightOptions=(Object.keys(TERMINATION_NOTICE_RIGHTS) as TerminationNoticeRight[])
    .filter(key=>selectedClaims.includes(key as Claim))
    .map(key=>({key,...TERMINATION_NOTICE_RIGHTS[key],amount:Number(terminationNoticeRightAmounts[key]||0)}));
  const terminationNoticeRights=terminationNoticeRightOptions.filter(option=>terminationNoticeRightOverrides[option.key]??false).map(option=>option.key);
  const terminationNoticeDate=setup.terminationNoticeDate||todayInputValue();
  const terminationNotice=buildTerminationNotice({
    employeeName:setup.terminationEmployeeName,
    companyName:setup.terminationCompanyName,
    employmentDate:setup.employmentDate,
    contractEnd:doublePayEnabled?setup.contractEnd:"",
    continuedEmploymentUntil:doublePayEnabled?setup.cutoffDate:"",
    noticeDate:terminationNoticeDate,
    contact:setup.terminationNoticeContact,
    reasons:terminationNoticeReasons,
    rights:terminationNoticeRights,
  });
  const hasTerminationNoticeFacts=terminationNotice.factParagraphs.length>0;
  const terminationNoticeReasonSection=hasTerminationNoticeFacts?"二":"一";
  const terminationNoticeRightsSection=hasTerminationNoticeFacts?"三":"二";
  const terminationNoticeClosingSection=hasTerminationNoticeFacts?(terminationNotice.rightsParagraphs.length>0?"四":"三"):(terminationNotice.rightsParagraphs.length>0?"三":"二");
  const terminationNoticeBlocked=setup.personalResignationSigned==="yes";
  const terminationNoticeReady=Boolean(setup.terminationEmployeeName.trim()&&setup.terminationCompanyName.trim()&&terminationNoticeReasons.length&&!terminationNoticeBlocked);
  const reportNumber=`WBC-${(setup.cutoffDate||todayInputValue()).slice(0,7).replace("-","")}-${String(Math.max(1,rows.length)).padStart(3,"0")}`;
  const toggleClaim=(claim:Claim)=>{
    const isAdding=!selectedClaims.includes(claim);
    if (isAdding&&claim==="doublePay"&&!setup.contractEnd) {
      setSetup(current=>{
        if (current.contractEnd) return current;
        const inferredStart=current.contractStart||current.employmentDate;
        return {...current,contractStart:inferredStart,contractEnd:oneYearContractEndFor(inferredStart)};
      });
    }
    setSelectedClaims(current=>current.includes(claim)?current.filter(x=>x!==claim):[...current,claim]);
  };
  const closeClaim=(claim:Claim)=>setSelectedClaims(current=>current.filter(item=>item!==claim));
  const jumpToQuestionIssue=(targetId:string)=>{
    const target=document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({behavior:"smooth",block:"center"});
    window.setTimeout(()=>target.focus({preventScroll:true}),260);
  };
  const continueToReview=()=>{
    if (!questionsReady) {
      if (questionIssues[0]) jumpToQuestionIssue(questionIssues[0].targetId);
      return;
    }
    setFlowStep("review");
  };

  const update = (id: number, key: keyof Row, value: string) => setRows(prev => prev.map(r => {
    if (r.id !== id) return r;
    const textField = key === "wageMonth" || key === "payDate" || key === "note";
    const moneyField = ["normalPay","paid","duePay","arrears","contractPay","wageDeduction","socialPaid","socialBase","socialActualBase","socialPersonalPaid","socialDue","fundPaid","fundBase","fundActualBase","fundPersonalPaid","fundDue"].includes(String(key));
    const next = {...r,[key]:textField?value:moneyField?roundMoney(Number(value)):Number(value)} as Row;
    if (key === "wageDeduction") next.duePay=roundMoney(Math.max(0,systemDueForRow(next)-next.wageDeduction));
    if (["duePay","normalPay","paid"].includes(String(key))) next.arrears=wageArrears(next);
    next.status=rowSettlementStatus(next);
    return next;
  }));

  const rowsWithComputedGaps = () => rows.map(r => ({...r,status:rowSettlementStatus(r),socialDue:socialDueFor(r),fundDue:fundDueFor(r)}));
  const save = () => { const persistedSetup={...setup,socialPaid:setupSocialActualMonthly,fundPaid:setupFundActualEmployer,socialRate:effectiveSocialRate}; localStorage.setItem("xinbao-rows", JSON.stringify(rowsWithComputedGaps())); localStorage.setItem("xinbao-double-rule", JSON.stringify(effectiveDoubleRule)); localStorage.setItem("xinbao-meta", JSON.stringify({version:16,caseName,setup:persistedSetup,rowsCutoffDate:setup.cutoffDate,selectedClaims,flowStep})); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  const printReport = () => {
    const title = document.title;
    document.title = " ";
    try {
      window.print();
    } finally {
      document.title = title;
    }
  };
  const addRow = () => setRows(prev => [...prev, { ...(prev[prev.length - 1] || blankRow()), id: Date.now(), wageMonth:"", payDate:"", normalPay:0, note:"新增欠薪月份", paid:0, status:"未结清", duePay:Number(setup.contractPay || 0), arrears:Number(setup.contractPay || 0), contractPay:Number(setup.contractPay || 0), wageDeduction:0, socialPaid:0, socialBase:effectiveSocialBase, socialActualBase:0, socialPersonalPaid:0, socialRate:effectiveSocialRate, fundPaid:0, fundBase:effectiveFundBase, fundActualBase:0, fundPersonalPaid:0, fundRate:effectiveFundRate }]);
  const remove = (id: number) => setRows(prev => prev.filter(r => r.id !== id));
  const exportCsv = () => {
    const header = [...fields.map(f => `${f.group ? f.group + "-" : ""}${f.label}`), "社保-个人应缴", "社保-个人少缴", "社保-账户应补合计", "公积金-个人应缴", "公积金-个人少缴", "公积金-账户应补合计", "本月工资中待划个人社保", "本月工资中待划个人公积金", "支付给本人", "未续签双倍工资差额", "权益履行总额"];
    const body = rows.map(r => { const personal=personalForRow(r), social= socialReconciliationForRow(r), fund=fundReconciliationForRow(r), double=doublePayEnabled?Number(doubleById.get(r.id)||0):0; return [...fields.map(f => f.key === "socialDue" ? social.employerGap : f.key === "fundDue" ? fund.employerGap : f.key === "status" ? rowSettlementStatus(r) : r[f.key]), social.personalExpected,social.personalGap,social.totalGap,fund.personalExpected,fund.personalGap,fund.totalGap,personal.social,personal.fund,sumMoney([Math.max(0,Number(r.arrears||0)-personal.total),double]),double,rowClaimTotal(r)]; });
    const csv = csvDocument([header, ...body]);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"})); a.download = "薪资计算器明细.csv"; a.click();
  };
  const exportData = () => {
    const data = JSON.stringify({ version:16, caseName, setup:{...setup,socialPaid:setupSocialActualMonthly,fundPaid:setupFundActualEmployer,socialRate:effectiveSocialRate}, rowsCutoffDate:setup.cutoffDate, selectedClaims, flowStep, doubleRule:effectiveDoubleRule, rows:rowsWithComputedGaps() }, null, 2);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], {type:"application/json"})); a.download = `${caseName || "欠款测算"}.json`; a.click();
  };
  const downloadTerminationNotice=(content:string,type:string,extension:string)=>{
    if (!terminationNoticeReady) return;
    const href=URL.createObjectURL(new Blob(["\ufeff",content],{type}));
    const anchor=document.createElement("a");
    anchor.href=href;
    anchor.download=`${safeTerminationNoticeFileName({employeeName:setup.terminationEmployeeName,noticeDate:terminationNoticeDate})}.${extension}`;
    anchor.click();
    window.setTimeout(()=>URL.revokeObjectURL(href),1000);
  };
  const printTerminationNotice=()=>{
    if (!terminationNoticeReady) return;
    const popup=window.open("","_blank","width=920,height=820");
    if (!popup) { alert("浏览器阻止了文书预览窗口，请允许弹出窗口后重试。"); return; }
    popup.opener=null;
    popup.document.open();
    popup.document.write(terminationNotice.html);
    popup.document.close();
    popup.focus();
    window.setTimeout(()=>popup.print(),350);
  };
  const importData = (file?: File) => {
    if (!file) return;
    try {
      assertBackupFileSize(file.size);
    } catch (error) {
      alert(error instanceof BackupValidationError ? error.message : "备份文件无法读取。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = validateBackupPayload(JSON.parse(String(reader.result))) as {
          version:number;
          caseName:string;
          setup:LegacyQuickSetup;
          rowsCutoffDate:string;
          selectedClaims:Claim[];
          doubleRule?:DoublePayRule;
          rows:Row[];
        };
        const importedRule = {...defaultRule, ...(data.doubleRule || {})};
        const today = todayInputValue();
        const sourceSetup = {...data.setup, contractEnd:data.setup.contractEnd || importedRule.contractEnd, cutoffDate:data.setup.cutoffDate || importedRule.continuedUntil} as LegacyQuickSetup;
        const snapshot = employmentSnapshotFor(sourceSetup, today);
        const normalizedSetup = normalizeSetup(sourceSetup);
        const rowsCutoffDate = data.rowsCutoffDate || snapshot.sourceCutoffDate;
        const staleRows = restoredRowsNeedReview({employmentStatus:normalizedSetup.employmentStatus,rowsCutoffDate,today});
        setRows(data.rows.map((row, index) => normalizeRow(row as Row, index)));
        setDoubleRule(importedRule);
        setSetup(normalizedSetup);
        setSelectedClaims(data.selectedClaims as Claim[]);
        setTerminationNoticeReasonOverrides({});
        setTerminationNoticeRightOverrides({});
        setFlowStep(snapshot.needsStatusConfirmation || staleRows ? "basic" : "results");
        setRestoreNotice(snapshot.needsStatusConfirmation
          ? "这是旧版备份，原统计截止日不能证明已经离职。系统暂按在职处理，请确认任职状态后重新生成明细。"
          : staleRows ? `备份明细计算至 ${rowsCutoffDate}，当前在职应计算至 ${today}。为保留逐月调整，系统未自动覆盖，请核对后重新生成明细。` : "");
        setCaseName(data.caseName);
      } catch (error) {
        alert(error instanceof BackupValidationError ? `导入失败：${error.message}` : "导入失败：文件不是有效的 JSON 备份。");
      }
    };
    reader.onerror = () => alert("导入失败：无法读取所选文件。");
    reader.readAsText(file);
  };
  const generateRows = () => {
    if (!setup.employmentDate || !setup.cutoffDate) return alert("请先填写入职日期，并确认在职状态或离职日期。");
    const startDate=atMidnight(setup.employmentDate), endDate=atMidnight(setup.cutoffDate);
    if (!startDate || !endDate) return alert("日期格式无法识别，请重新选择。");
    const sy=startDate.getFullYear(), sm=startDate.getMonth()+1, count=monthCountBetween(setup.employmentDate,setup.cutoffDate);
    if (count < 1 || count > 60) return alert("测算期间需为 1—60 个月。");
    if (!selectedClaims.length) return alert("请至少选择一项需要测算的事项。");
    if (doublePayEnabled && !setup.contractEnd) return alert("请填写劳动合同期满日。");
    if (setup.employmentDate && setup.contractEnd && setup.employmentDate > setup.contractEnd) return alert("合同期满日不能早于入职日期。");
    const firstMonth=`${sy}-${String(sm).padStart(2,"0")}`, lastMonth=`${endDate.getFullYear()}-${String(endDate.getMonth()+1).padStart(2,"0")}`;
    if (wageEnabled && !setup.arrearsStartMonth) return alert("请填写开始欠薪月份。");
    if (wageEnabled && setup.arrearsStartMonth && (setup.arrearsStartMonth < firstMonth || setup.arrearsStartMonth > lastMonth)) return alert("开始欠薪月份需位于入职月份和计薪截止月份之间。");
    if (reimbursementEnabled && Number(setup.reimbursementAmount||0)<=0) return alert("请填写尚未支付的报销金额。");
    if (annualLeaveEnabled && Number(setup.annualLeaveWorkYears||0)<1) return alert("累计工作满 1 年后才享受法定年休假，请核对累计工作年限。");
    if (overtimeEnabled && Number(setup.weekdayOvertimeHours||0)<=0 && Number(setup.restDayOvertimeHours||0)<=0 && Number(setup.holidayOvertimeHours||0)<=0) return alert("请至少填写一类尚未支付的加班时数。");
    if (compTimeEnabled && Number(setup.outstandingCompTimeDays||0)<=0) return alert("请填写休息日加班尚未补休的天数。");
    if (needsRestDayDistinctConfirmation && !setup.restDayClaimsDistinct) return alert("请确认加班工资与调休折现不是同一批休息日加班，避免重复计算。");
    if (socialEnabled && effectiveSocialRate<=0) return alert("请至少填写一项社保公司费率。");
    if (fundEnabled && Number(setup.fundRate||0)<=0) return alert("请填写当地最低公积金单位比例。");
    const paidPeriods = [
      {enabled:socialEnabled&&setup.socialHasPaid,label:"社保",amount:effectiveSocialActualBase,start:effectiveSocialStart,end:setup.socialPaidEndMonth},
      {enabled:fundEnabled&&setup.fundHasPaid,label:"公积金",amount:Number(effectiveFundActualBase||setupFundActualEmployer||0),start:effectiveFundStart,end:effectiveFundEnd},
    ];
    for (const period of paidPeriods) {
      if (!period.enabled) continue;
      if ((period.start && !period.end) || (!period.start && period.end) || (period.amount > 0 && (!period.start || !period.end))) return alert(`请完整填写${period.label}公司实际缴纳的开始月份和截止月份。`);
      if (period.start && (period.start > period.end || period.start < firstMonth || period.end > lastMonth)) return alert(`${period.label}公司实际缴纳期间需位于入职月份和计薪截止月份之间。`);
    }
    const generated = generateMonthlyLedger({
      employmentDate:setup.employmentDate,cutoffDate:setup.cutoffDate,contractPay:setup.contractPay,wageEnabled,arrearsStartMonth:setup.arrearsStartMonth,firstArrearsPaidRate:setup.firstArrearsPaidRate,
      social:{enabled:socialEnabled,hasPaid:setup.socialHasPaid,startMonth:effectiveSocialStart,endMonth:setup.socialPaidEndMonth,actualMonthly:setupSocialActualMonthly,actualBase:effectiveSocialActualBase,personalActualMonthly:setupSocialActualPersonal,base:effectiveSocialBase,rate:effectiveSocialRate},
      fund:{enabled:fundEnabled,hasPaid:setup.fundHasPaid,startMonth:effectiveFundStart,endMonth:effectiveFundEnd,actualMonthly:setupFundActualEmployer,actualBase:effectiveFundActualBase,personalActualMonthly:setupFundActualPersonal,base:effectiveFundBase,rate:effectiveFundRate},
    }) as Row[];
    if (rows.some(r => r.wageMonth || r.duePay || r.normalPay) && !confirm("批量生成会替换当前明细，是否继续？")) return;
    setRows(generated);
    setRestoreNotice("");
    setFlowStep("results");
    setPrecisionOpen(false);
  };
  const newCase = () => { if (!confirm("新建测算会清空当前页面数据，建议先导出备份。是否继续？")) return; setRows([blankRow()]); setDoubleRule(defaultRule); setSetup({...defaultSetup,cutoffDate:todayInputValue()}); setSelectedClaims([]); setFlowStep("basic"); setPrecisionOpen(false); setCaseName("我的欠款测算"); setRestoreNotice(""); setTerminationNoticeReasonOverrides({}); setTerminationNoticeRightOverrides({}); localStorage.removeItem("xinbao-rows"); localStorage.removeItem("xinbao-double-rule"); localStorage.removeItem("xinbao-meta"); };

  return <main className="app-shell">
    <a className="skip-link" href="#calculator">跳到测算表单</a>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">薪</span><div><strong>薪资计算器</strong><small>免登录 · 本地保存 · 开箱即用</small></div></div>
      <div className="top-actions"><span className="safe">● 数据仅保存在本机</span><button className="ghost" onClick={newCase}>新建</button><button className="ghost" onClick={()=>importInput.current?.click()}>导入</button><button className="ghost" onClick={exportData}>备份</button><button className="ghost" onClick={exportCsv}>CSV</button>{flowStep==="results"&&<button className="ghost report-export" onClick={printReport}>导出报告</button>}<button className="primary" onClick={save}>{saved ? "已保存 ✓" : "保存"}</button><input ref={importInput} className="file-input" type="file" accept="application/json,.json" onChange={e=>{importData(e.target.files?.[0]);e.target.value=""}}/></div>
    </header>

    {flowStep==="basic"&&<section className="hero hero-dot-banner">
      <DotGridBackground />
      <div className="hero-copy"><h1 aria-label="工资、社保、公积金、加班工资、年假、报销，统统算清"><SplitText className="hero-slogan" lines={["FUCK", "COMPANY"]} /><span className="hero-claims">工资、社保、公积金、加班工资、年假、报销……</span><em>统统算清</em></h1><div className="hero-actions"><a className="hero-primary" href="#calculator" aria-label="开始测算"><span className="hero-start-label"><b>START</b></span><span className="hero-start-arrows" aria-hidden="true"><i></i><i></i><i></i></span></a></div></div>
    </section>}

    <section className="quick-card guided-card" id="calculator">
      <div className="guided-head">
        <div><p className="eyebrow">GUIDED CALCULATOR / 引导测算</p><h2>{flowStep==="basic"?"先确认基础事实":flowStep==="scenario"?"选择要计算的事项":flowStep==="questions"?"只回答与你有关的问题":flowStep==="review"?"核对事实与系统推定":"测算结果已生成"}</h2></div>
        <div className="stepper" aria-label="测算进度">{["basic","scenario","questions","review","results"].map((step,index)=><span key={step} className={flowStep===step?"active":(["basic","scenario","questions","review","results"].indexOf(flowStep)>index?"done":"")}>{index+1}</span>)}</div>
      </div>

      {flowStep==="basic"&&<div className="guided-step">
        <p className="step-intro">先确认当前是在职还是已离职。系统会以今天或离职日期作为计薪截止日，再按月生成工资明细。</p>
        <div className="basic-fields">
          <fieldset className="employment-state"><legend>当前任职状态</legend><div role="group" aria-label="当前任职状态"><button type="button" className={setup.employmentStatus==="active"?"active":""} aria-pressed={setup.employmentStatus==="active"} onClick={()=>setSetup(s=>({...s,employmentStatus:"active",departureDate:"",cutoffDate:todayInputValue()}))}>当前在职</button><button type="button" className={setup.employmentStatus==="departed"?"active":""} aria-pressed={setup.employmentStatus==="departed"} onClick={()=>setSetup(s=>({...s,employmentStatus:"departed",cutoffDate:s.departureDate}))}>已经离职</button></div><small>{setup.employmentStatus==="active"?"计薪自动截止到今天":"请填写实际离职日期"}</small></fieldset>
          <label><span>入职日期</span><input type="date" value={setup.employmentDate} onChange={e=>setSetup(s=>({...s,employmentDate:e.target.value,contractStart:s.contractStart||e.target.value}))}/></label>
          {setup.employmentStatus==="departed"?<label><span>离职日期</span><input type="date" value={setup.departureDate} onChange={e=>setSetup(s=>({...s,departureDate:e.target.value,cutoffDate:e.target.value}))}/><small>工资、年假和离职补偿均计算至该日</small></label>:<div className="calculation-cutoff"><span>计薪截止日期</span><output aria-label="计薪截止日期">{setup.cutoffDate||"正在读取今天日期"}</output><small>当前在职，系统按本机今天日期自动计算</small></div>}
          <label className="salary-field"><span>合同月薪</span><div className="money-input salary-input"><input type="number" min="0" value={setup.contractPay||""} placeholder="例如 20,000" onChange={e=>setSetup(s=>({...s,contractPay:Number(e.target.value)}))}/><span className="salary-unit">元/月</span></div><small>劳动合同约定的税前月工资</small></label>
        </div>
        {restoreNotice&&<p className="inline-hint" role="status">{restoreNotice}</p>}
        {setup.employmentStatus==="departed"&&!setup.departureDate&&<p className="inline-hint">请填写离职日期，系统会以该日作为计薪截止日期。</p>}
        {setup.employmentDate&&setup.cutoffDate&&setup.employmentDate>setup.cutoffDate&&<p className="inline-error" role="alert">计薪截止日期不能早于入职日期。</p>}
        <div className="guided-actions"><span></span><button className="next" disabled={!basicReady} onClick={()=>setFlowStep("scenario")}>下一步：选择事项 →</button></div>
      </div>}

      {flowStep==="scenario"&&<div className="guided-step">
        <p className="step-intro">可以多选。没有选择的事项不会显示问题，也不会进入合计。</p>
        <div className="claim-grid">{claimOptions.map(option=><button key={option.key} className={selectedClaims.includes(option.key)?"claim active":"claim"} aria-pressed={selectedClaims.includes(option.key)} onClick={()=>toggleClaim(option.key)}><b>{option.mark}</b><span><strong>{option.title}</strong><small>{option.copy}</small></span><i>{selectedClaims.includes(option.key)?"✓":"＋"}</i></button>)}</div>
        {!selectedClaims.length&&<p className="inline-hint">请至少选择一项。</p>}
        <div className="guided-actions"><button className="back" onClick={()=>setFlowStep("basic")}>← 返回</button><button className="next" disabled={!selectedClaims.length} onClick={()=>setFlowStep("questions")}>下一步：回答问题 →</button></div>
      </div>}

      {flowStep==="questions"&&<div className="guided-step">
        <div className="question-stack">
          {wageEnabled&&<article className="question-module"><header><b>欠</b><div><strong>工资少发或未发</strong><small>开始欠薪前按足额发放，之后默认未发</small></div></header><div className="module-fields"><label><span>从哪个月开始欠薪？</span><input id="question-wage-start" aria-invalid={hasQuestionIssue("question-wage-start")} type="month" value={setup.arrearsStartMonth} onChange={e=>setSetup(s=>({...s,arrearsStartMonth:e.target.value}))}/></label><label><span>首个欠薪月实际发了多少？</span><div className="rate-choices wage-rate-choices">{[0,30,50,100].map(rate=><button key={rate} className={setup.firstArrearsPaidRate===rate?"active":""} onClick={()=>setSetup(s=>({...s,firstArrearsPaidRate:rate}))}>{rate}%</button>)}<div className="money-input custom-rate-input"><i>%</i><input id="question-wage-rate" aria-invalid={hasQuestionIssue("question-wage-rate")} aria-label="首个欠薪月自定义已发比例" type="number" min="0" max="100" value={setup.firstArrearsPaidRate||""} onChange={e=>setSetup(s=>({...s,firstArrearsPaidRate:Number(e.target.value)}))}/></div></div></label></div></article>}
          {annualLeaveEnabled&&<article className="question-module rights-module">
            <header><b>年</b><div><strong>未休年假折现</strong><small>离职当年自动折算，正常工资已支付时只计额外 200%</small></div><button className="question-close" type="button" aria-label="关闭未休年假折现" onClick={()=>closeClaim("annualLeave")}>关闭此项</button></header>
            <div className="module-fields rights-fields">
              <label><span>累计工作年限</span><input id="question-annual-leave-years" aria-invalid={hasQuestionIssue("question-annual-leave-years")} type="number" min="0" step="0.1" value={setup.annualLeaveWorkYears||""} onChange={e=>setSetup(s=>({...s,annualLeaveWorkYears:Number(e.target.value)}))}/><small>包含在其他单位的累计工作时间</small></label>
              <label><span>统计当年已休年假</span><div className="money-input unit-input"><input type="number" min="0" step="0.5" value={setup.annualLeaveTakenDays||""} onChange={e=>setSetup(s=>({...s,annualLeaveTakenDays:Number(e.target.value)}))}/><span>天</span></div></label>
              <label><span>前 12 个月平均月工资（不含加班费）</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.annualLeaveAveragePay||""} placeholder={`默认按合同月薪 ${setup.contractPay||0}`} onChange={e=>setSetup(s=>({...s,annualLeaveAveragePay:Number(e.target.value)}))}/></div><small>可含绩效、提成、奖金和岗位补贴；未满 12 个月按实际月份</small></label>
              <label><span>往年仍主张的未休天数（可选）</span><div className="money-input unit-input"><input type="number" min="0" step="1" value={setup.annualLeavePriorUnusedDays||""} onChange={e=>setSetup(s=>({...s,annualLeavePriorUnusedDays:Number(e.target.value)}))}/><span>天</span></div><small>请自行核对仲裁时效和证据</small></label>
              <div className="rights-summary"><div><span>全年法定天数</span><strong>{annualLeaveStatutoryDays} 天</strong></div><div><span>截至统计日折算未休</span><strong>{annualLeaveCurrentYearDays} 天</strong></div><div><span>日工资</span><strong>¥ {money(dailyWage(effectiveAnnualLeavePay))}</strong></div><div><span>额外补偿</span><strong>¥ {money(annualLeaveTotal)}</strong></div></div>
              <p className="rights-formula-note"><b>为什么是 {annualLeaveCurrentYearDays} 天？</b>当年在职 {annualLeaveElapsedDays} 天 ÷ 365 × 全年 {annualLeaveStatutoryDays} 天 − 已休 {percent(setup.annualLeaveTakenDays)} 天，结果舍去不足 1 天。该折算用于解除或终止劳动合同当年的测算；持续在职到年末时应按实际情况重新计算。</p>
              <label className="check-line"><input type="checkbox" checked={setup.annualLeaveWrittenWaiver} onChange={e=>setSetup(s=>({...s,annualLeaveWrittenWaiver:e.target.checked}))}/><span>我曾因本人原因<strong>书面主动放弃</strong>上述年休假</span></label>
              {setup.annualLeaveWrittenWaiver&&<p className="legal-warning">已按书面主动放弃例外处理：额外 200% 补偿为 0。仅有口头放弃时不要勾选。</p>}
              <p className="rights-evidence">建议准备：劳动合同与离职记录、工资流水或工资条、考勤及休假记录、公司未安排休假或欠薪沟通记录。寒暑假、较长病事假等法定例外未自动判定。</p>
            </div>
          </article>}
          {overtimeEnabled&&<article className="question-module rights-module">
            <header><b>加</b><div><strong>加班工资未支付</strong><small>三类加班分开填写，系统按 150% / 200% / 300% 测算</small></div><button className="question-close" type="button" aria-label="关闭加班工资未支付" onClick={()=>closeClaim("overtime")}>关闭此项</button></header>
            <div className="module-fields rights-fields">
              <label><span>加班工资月基数</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.overtimeWageBase||""} placeholder={`默认按合同月薪 ${setup.contractPay||0}`} onChange={e=>setSetup(s=>({...s,overtimeWageBase:Number(e.target.value)}))}/></div><small>约定或当地裁审口径不同时可修改</small></label>
              <label><span>工作日延时加班</span><div className="money-input unit-input"><input id="question-overtime-hours" aria-invalid={hasQuestionIssue("question-overtime-hours")} type="number" min="0" step="0.5" value={setup.weekdayOvertimeHours||""} onChange={e=>setSetup(s=>({...s,weekdayOvertimeHours:Number(e.target.value)}))}/><span>小时</span></div><small>三类加班至少填写一类；本项按小时工资 × 150%</small></label>
              <label><span>休息日加班尚未补休</span><div className="money-input unit-input"><input type="number" min="0" step="0.5" value={setup.restDayOvertimeHours||""} onChange={e=>setSetup(s=>({...s,restDayOvertimeHours:Number(e.target.value)}))}/><span>小时</span></div><small>按小时工资 × 200%</small></label>
              <label><span>法定节假日加班</span><div className="money-input unit-input"><input type="number" min="0" step="0.5" value={setup.holidayOvertimeHours||""} onChange={e=>setSetup(s=>({...s,holidayOvertimeHours:Number(e.target.value)}))}/><span>小时</span></div><small>按小时工资 × 300%，不能用补休替代</small></label>
              <div className="rights-summary"><div><span>小时工资</span><strong>¥ {money(overtimeBreakdown.hourly)}</strong></div><div><span>工作日</span><strong>¥ {money(overtimeBreakdown.weekday)}</strong></div><div><span>休息日</span><strong>¥ {money(overtimeBreakdown.restDay)}</strong></div><div><span>法定节假日</span><strong>¥ {money(overtimeBreakdown.holiday)}</strong></div></div>
              <p className="rights-evidence">建议准备：考勤、排班、审批、工作成果、聊天记录及工资流水。实行综合计算工时或不定时工时的，计算口径可能不同。</p>
            </div>
          </article>}
          {compTimeEnabled&&<article className="question-module rights-module">
            <header><b>休</b><div><strong>调休尚未兑现</strong><small>仅计算休息日加班后仍未安排补休的部分</small></div><button className="question-close" type="button" aria-label="关闭调休尚未兑现" onClick={()=>closeClaim("compTime")}>关闭此项</button></header>
            <div className="module-fields rights-fields">
              <label><span>尚未补休的休息日加班</span><div className="money-input unit-input"><input id="question-comp-time-days" aria-invalid={hasQuestionIssue("question-comp-time-days")} type="number" min="0" step="0.5" value={setup.outstandingCompTimeDays||""} onChange={e=>setSetup(s=>({...s,outstandingCompTimeDays:Number(e.target.value)}))}/><span>天</span></div><small>按日工资 × 200% 测算</small></label>
              <label><span>调休折现月工资基数</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.compTimeWageBase||""} placeholder={`默认按合同月薪 ${setup.contractPay||0}`} onChange={e=>setSetup(s=>({...s,compTimeWageBase:Number(e.target.value)}))}/></div></label>
              <div className="legal-warning strong-warning">不得与“休息日加班工资”重复填写同一批加班；工作日延时和法定节假日加班也不能用调休替代。</div>
              {needsRestDayDistinctConfirmation&&<label className="check-line"><input id="question-rest-day-distinct" aria-invalid={hasQuestionIssue("question-rest-day-distinct")} type="checkbox" checked={setup.restDayClaimsDistinct} onChange={e=>setSetup(s=>({...s,restDayClaimsDistinct:e.target.checked}))}/><span>我确认两处填写的<strong>不是同一批休息日加班</strong></span></label>}
              <div className="rights-summary compact-summary"><div><span>日工资</span><strong>¥ {money(dailyWage(effectiveCompTimeBase))}</strong></div><div><span>尚未补休</span><strong>{percent(Number(setup.outstandingCompTimeDays||0))} 天</strong></div><div><span>折现金额</span><strong>¥ {money(compTimeTotal)}</strong></div></div>
            </div>
          </article>}
          {doublePayEnabled&&<article className="question-module"><header><b>2×</b><div><strong>未签订劳动合同或合同到期仍在工作</strong><small>系统先按一年期合同推定到期日，计薪截止日已由任职状态确定</small></div></header><div className="module-fields"><label className="inferred"><span>合同上写的最后一天 <em>{setup.contractEnd===oneYearContractEndFor(setup.contractStart||setup.employmentDate)?"系统推定":"已修改"}</em></span><input id="question-contract-end" aria-invalid={hasQuestionIssue("question-contract-end")} type="date" value={setup.contractEnd} onChange={e=>setSetup(s=>({...s,contractEnd:e.target.value}))}/><small>暂按入职日期 {setup.contractStart||setup.employmentDate||"—"} 作为签约日，自动填写一年期合同的最后一天；请按劳动合同直接修改</small></label></div></article>}
          {terminationEnabled&&<article className="question-module termination-module">
            <header><b>N</b><div><strong>离职经济补偿</strong><small>系统按本单位工龄自动计算 N，两种情形只会计入其中一种</small></div></header>
            <div className="termination-kind" role="group" aria-label="离职经济补偿情形">
              <button type="button" className={setup.terminationType==="forced"?"active":""} aria-pressed={setup.terminationType==="forced"} onClick={()=>setSetup(s=>({...s,terminationType:"forced"}))}>被迫离职（N）</button>
              <button type="button" className={setup.terminationType==="layoff"?"active":""} aria-pressed={setup.terminationType==="layoff"} onClick={()=>setSetup(s=>({...s,terminationType:"layoff"}))}>裁员/公司解除（N+X）</button>
            </div>
            <div className="module-fields termination-fields">
              <label><span>解除前 12 个月平均应得工资</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.terminationAveragePay||""} placeholder={`默认按合同月薪 ${setup.contractPay||0}`} onChange={e=>setSetup(s=>({...s,terminationAveragePay:Number(e.target.value)}))}/></div><small>包含奖金、津贴和补贴；未满 12 个月按实际月份平均</small></label>
              {setup.terminationType==="layoff"&&<><label><span>额外补偿月数 X</span><div className="money-input unit-input"><input aria-label="额外补偿月数X" type="number" min="0" max="9" step="1" value={setup.terminationAdditionalMonths} onChange={e=>setSetup(s=>({...s,terminationAdditionalMonths:Math.min(9,Math.max(0,Math.trunc(Number(e.target.value)||0)))}))}/><span>个月</span></div><small>默认 1，可按通知、协议或实际主张改为 0–9 的整数</small></label><label><span>X 部分每月工资基数</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.terminationExtraPayBase||""} placeholder={`默认 ${effectiveTerminationAveragePay}`} onChange={e=>setSetup(s=>({...s,terminationExtraPayBase:Number(e.target.value)}))}/></div><small>法定代通知金通常按上一个月工资；协议额外补偿按约定填写</small></label></>}
              {setup.terminationType==="forced"&&<div className="termination-confirmations">
                <div className="termination-verification-head"><div><span>解除通知核验</span><strong>三个关键状态</strong></div><small>只需选择，不需要描述事情经过</small></div>
                <fieldset><legend>是否已经提交“个人原因辞职”或签署离职协议？</legend><div>{([['yes','已经提交'],['no','没有提交'],['unknown','不清楚']] as const).map(([key,label])=><button type="button" key={key} className={setup.personalResignationSigned===key?"active":""} aria-pressed={setup.personalResignationSigned===key} onClick={()=>setSetup(s=>({...s,personalResignationSigned:key}))}>{label}</button>)}</div><small>普通辞职文件可能与依据第 38 条被迫解除的主张冲突。</small></fieldset>
                <fieldset><legend>是否已经发送依据第 38 条解除劳动合同的通知？</legend><div>{([['yes','已发送'],['no','未发送'],['unknown','不清楚']] as const).map(([key,label])=><button type="button" key={key} className={setup.forcedNoticeSent===key?"active":""} aria-pressed={setup.forcedNoticeSent===key} onClick={()=>setSetup(s=>({...s,forcedNoticeSent:key,forcedNoticeProof:key==="yes"?s.forcedNoticeProof:"unknown"}))}>{label}</button>)}</div><small>这里只确认通知状态，不要求填写经过。</small></fieldset>
                {setup.forcedNoticeSent==="yes"&&<fieldset><legend>是否保留通知送达证明？</legend><div>{([['yes','已保留'],['no','未保留'],['unknown','不清楚']] as const).map(([key,label])=><button type="button" key={key} className={setup.forcedNoticeProof===key?"active":""} aria-pressed={setup.forcedNoticeProof===key} onClick={()=>setSetup(s=>({...s,forcedNoticeProof:key}))}>{label}</button>)}</div><small>例如 EMS 回执、邮件记录、微信或钉钉送达记录。</small></fieldset>}
                {setup.personalResignationSigned==="yes"&&<p className="termination-status danger"><b>文件可能冲突：</b>不要直接再次发送相互矛盾的解除文件，建议先由律师或法律援助机构复核现有文件。</p>}
                {setup.forcedNoticeSent==="no"&&<p className="termination-status warning"><b>程序尚未完成：</b>当前只测算 N，发送解除通知前建议先固定欠薪、社保及劳动关系证据。</p>}
                {setup.forcedNoticeSent==="unknown"&&<p className="termination-status"><b>需要确认：</b>无法确认通知状态时，报告将把被迫离职补偿标记为待核验。</p>}
                {setup.forcedNoticeSent==="yes"&&setup.forcedNoticeProof!=="yes"&&<p className="termination-status warning"><b>送达证据待补充：</b>已填写发送通知，但尚未确认保留送达证明。</p>}
              </div>}
              {setup.terminationType==="forced"&&setup.forcedNoticeSent==="no"&&<section className="termination-notice-builder" aria-labelledby="termination-notice-title">
                <header>
                  <div><span>通知书生成器</span><h3 id="termination-notice-title">生成解除劳动合同通知书</h3></div>
                  <p>姓名和公司名称是必填项；系统只把当前测算能够支持的事实带入模板。</p>
                </header>
                <div className="termination-notice-layout">
                  <div className="termination-notice-form">
                    <div className="termination-notice-fields">
                      <label><span>劳动者姓名</span><input aria-label="解除通知劳动者姓名" autoComplete="name" value={setup.terminationEmployeeName} placeholder="例如：张三" onChange={e=>setSetup(s=>({...s,terminationEmployeeName:e.target.value}))}/></label>
                      <label><span>用人单位全称</span><input aria-label="解除通知用人单位全称" value={setup.terminationCompanyName} placeholder="以营业执照或劳动合同为准" onChange={e=>setSetup(s=>({...s,terminationCompanyName:e.target.value}))}/></label>
                      <label><span>落款日期</span><input aria-label="解除通知落款日期" type="date" value={terminationNoticeDate} onChange={e=>setSetup(s=>({...s,terminationNoticeDate:e.target.value}))}/><small>文书约定自送达公司之日起生效</small></label>
                      <label><span>联系方式（可选）</span><input aria-label="解除通知联系方式" inputMode="tel" value={setup.terminationNoticeContact} placeholder="手机号或电子邮箱" onChange={e=>setSetup(s=>({...s,terminationNoticeContact:e.target.value}))}/></label>
                    </div>
                    <fieldset className="termination-notice-reasons">
                      <legend>确认写入通知的解除事由</legend>
                      {terminationNoticeReasonOptions.length?terminationNoticeReasonOptions.map(option=>{
                        const checked=terminationNoticeReasonOverrides[option.key]??option.automatic;
                        return <label key={option.key} className={checked?"selected":""}><input type="checkbox" checked={checked} onChange={e=>setTerminationNoticeReasonOverrides(current=>({...current,[option.key]:e.target.checked}))}/><span><strong>{option.label}</strong><small>{option.description}</small></span><i>{option.automatic?"系统推定":"人工复核"}</i></label>;
                      }):<p>当前测算尚未形成可自动带入的欠薪或未缴社保事实，请不要使用空白解除理由直接发送通知。</p>}
                    </fieldset>
                    {hasTerminationNoticeFacts&&<fieldset className="termination-notice-reasons termination-notice-facts">
                      <legend>自动写入的劳动关系延续事实</legend>
                      <div className="termination-notice-fact"><b aria-hidden="true">✓</b><span><strong>劳动合同期满后继续提供劳动</strong><small>合同于 {setup.contractEnd} 期满，此后未办理终止、解除或续签手续，仍持续提供劳动至 {setup.cutoffDate}；该内容作为事实背景写入，不单独作为第 38 条解除事由。</small></span><i>事实背景</i></div>
                    </fieldset>}
                    {terminationNoticeRightOptions.length>0&&<fieldset className="termination-notice-reasons termination-notice-rights">
                      <legend>选择随通知一并列明的待处理权益</legend>
                      {terminationNoticeRightOptions.map(option=>{
                        const checked=terminationNoticeRightOverrides[option.key]??false;
                        const amountBreakdown=option.key==="social"?`公司少缴 ¥ ${money(totals.social)} + 个人少缴 ¥ ${money(totals.personalSocialGap)}`:option.key==="fund"?`单位少缴 ¥ ${money(totals.fund)} + 个人少缴 ¥ ${money(totals.personalFundGap)}`:"";
                        const amountText=option.amount>0?`当前账户预计应补 ¥ ${money(option.amount)}${amountBreakdown?`（${amountBreakdown}）`:""}；最终以证据、官方核定或有权机关认定为准。`:"已从前一步选择带入；生成测算明细后请再次核对事实和金额。";
                        return <label key={option.key} className={checked?"selected":""}><input aria-label={`通知列明：${option.label}`} type="checkbox" checked={checked} onChange={e=>setTerminationNoticeRightOverrides(current=>({...current,[option.key]:e.target.checked}))}/><span><strong>{option.label}</strong><small>{amountText}</small></span><i>前序已选</i></label>;
                      })}
                      <p>本清单用于列明希望公司核对处理的事项，不会自动把公积金、报销或加班争议认定为第 38 条解除理由。</p>
                    </fieldset>}
                    {terminationNoticeBlocked&&<p className="termination-notice-lock" role="alert"><b>暂不提供下载：</b>你已选择“提交个人原因辞职或签署离职协议”，与第38条解除主张可能冲突，请先让律师或法律援助机构复核已有文件。</p>}
                    {!terminationNoticeBlocked&&(!setup.terminationEmployeeName.trim()||!setup.terminationCompanyName.trim()||!terminationNoticeReasons.length)&&<p className="termination-notice-help">填写姓名、公司全称并至少确认一项解除事由后，即可下载。所有内容只在本机生成。</p>}
                    <div className="termination-notice-actions">
                      <button type="button" disabled={!terminationNoticeReady} onClick={()=>downloadTerminationNotice(terminationNotice.markdown,"text/markdown;charset=utf-8","md")}>下载 Markdown</button>
                      <button type="button" disabled={!terminationNoticeReady} onClick={()=>downloadTerminationNotice(terminationNotice.html,"application/msword;charset=utf-8","doc")}>下载 Word（.doc）</button>
                      <button type="button" className="primary" disabled={!terminationNoticeReady} onClick={printTerminationNotice}>生成 PDF</button>
                    </div>
                    <p className="termination-notice-footnote">“生成 PDF”会打开系统打印窗口，请选择“存储为 PDF”。建议将通知书通过 EMS、公司邮箱或企业通讯工具送达并保留正文、寄件凭证和签收记录。<a href="https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_0abfdd261c03417b949df19d869add8d.html" target="_blank" rel="noreferrer">核对《劳动合同法》原文</a></p>
                  </div>
                  <article className="termination-notice-preview" aria-label="解除劳动合同通知书预览">
                    <span>DOCUMENT PREVIEW / 文书预览</span>
                    <h4>解除劳动合同通知书</h4>
                    <b>致：{terminationNotice.company}</b>
                    <p>{terminationNotice.intro}</p>
                    {hasTerminationNoticeFacts&&<><h5>一、劳动关系延续事实</h5><ol>{terminationNotice.factParagraphs.map((paragraph:string,index:number)=><li key={paragraph}>{index+1}. {paragraph}</li>)}</ol></>}
                    <h5>{terminationNoticeReasonSection}、解除事由</h5>
                    <ol>{terminationNotice.reasonParagraphs.map((paragraph:string,index:number)=><li key={paragraph}>{index+1}. {paragraph}</li>)}</ol>
                    {terminationNotice.rightsParagraphs.length>0&&<><h5>{terminationNoticeRightsSection}、随通知一并列明的待处理权益事项</h5><ol>{terminationNotice.rightsParagraphs.map((paragraph:string,index:number)=><li key={paragraph}>{index+1}. {paragraph}</li>)}</ol></>}
                    <h5>{terminationNoticeClosingSection}、解除通知与后续事项</h5>
                    <p>{terminationNotice.effective}</p>
                    <ol>{terminationNotice.requests.map((request,index)=><li key={request}>{index+1}. {request}</li>)}</ol>
                    <div><p>通知人：{terminationNotice.employee}</p><p>日期：{terminationNoticeDate}</p></div>
                  </article>
                </div>
              </section>}
              <div className="rights-summary termination-summary"><div><span>系统计算 N</span><strong>{percent(terminationBreakdown.rawN)}</strong></div><div><span>N 部分采用基数</span><strong>¥ {money(terminationBreakdown.nMonthlyBase)}</strong></div><div><span>额外月数 X</span><strong>{terminationBreakdown.extraMonths}</strong></div><div><span>补偿测算合计</span><strong>¥ {money(terminationTotal)}</strong></div></div>
              <p className="termination-formula">N 部分：{percent(terminationBreakdown.appliedN)} × ¥ {money(terminationBreakdown.nMonthlyBase)} = ¥ {money(terminationBreakdown.economic)}{setup.terminationType==="layoff"&&<>；X 部分：{terminationBreakdown.extraMonths} × ¥ {money(terminationBreakdown.extraMonthlyBase)} = ¥ {money(terminationBreakdown.extra)}</>}</p>
            </div>
            <details className="advanced-base termination-cap"><summary>高工资封顶设置（可选）</summary><label className="inferred"><span>当地上年度职工月平均工资</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.terminationLocalAveragePay||""} placeholder="不填写则暂不自动封顶" onChange={e=>setSetup(s=>({...s,terminationLocalAveragePay:Number(e.target.value)}))}/></div><small>填写后，N 部分自动按当地月平均工资 3 倍封顶，计算年限最高 12 年；X 部分不受该封顶影响</small></label></details>
            {setup.terminationType==="forced"?<p className="termination-legal"><b>被迫离职适用边界：</b>仅在劳动者依据《劳动合同法》第 38 条依法解除，并符合第 46 条经济补偿情形时按 N 主张；需保留书面通知和单位违法事实证据。</p>:<p className="termination-legal"><b>不要把所有裁员都理解成 N+1：</b>经济性裁员通常为 N，并不当然增加 1 个月；法定“+1”主要对应第 40 条未提前 30 日书面通知时的代通知金，其他 X 应以协议或实际依据为准。</p>}
          </article>}
          {workInjuryEnabled&&<article className="question-module work-injury-module">
            <header><b>伤</b><div><strong>工伤情况初筛</strong><small>只核对典型情形和申报期限，不计算待遇金额，也不进入欠款合计</small></div><button className="question-close" type="button" aria-label="关闭工伤情况初筛" onClick={()=>closeClaim("workInjury")}>关闭此项</button></header>
            <fieldset className="injury-kind"><legend>哪一种情况最接近？</legend>{(Object.entries(WORK_INJURY_KINDS) as [QuickSetup["workInjuryKind"],string][]).map(([key,label])=><button type="button" key={key} className={setup.workInjuryKind===key?"active":""} aria-pressed={setup.workInjuryKind===key} onClick={()=>setSetup(s=>({...s,workInjuryKind:key}))}><span>{label}</span><i>{setup.workInjuryKind===key?"已选择":"选择"}</i></button>)}</fieldset>
            <div className="module-fields injury-fields">
              <label><span>事故发生或职业病确诊日期（可选）</span><input type="date" value={setup.workInjuryDate} onChange={e=>setSetup(s=>({...s,workInjuryDate:e.target.value}))}/><small>填写后自动提示单位和个人通常的申报期限</small></label>
              {setup.workInjuryKind==="commute"&&<fieldset className="injury-responsibility"><legend>交通事故责任结论</legend><div>{([['nonPrimary','无责、次责或同责'],['primary','主责或全责'],['pending','尚未认定或不清楚']] as const).map(([key,label])=><button type="button" key={key} className={setup.workInjuryCommuteResponsibility===key?"active":""} aria-pressed={setup.workInjuryCommuteResponsibility===key} onClick={()=>setSetup(s=>({...s,workInjuryCommuteResponsibility:key}))}>{label}</button>)}</div><small>还需同时满足合理上下班时间和路线等条件</small></fieldset>}
              <fieldset className="injury-responsibility"><legend>单位是否已经申请工伤认定？</legend><div>{([['yes','已经申请'],['no','没有申请'],['unknown','不清楚']] as const).map(([key,label])=><button type="button" key={key} className={setup.workInjuryEmployerApplied===key?"active":""} aria-pressed={setup.workInjuryEmployerApplied===key} onClick={()=>setSetup(s=>({...s,workInjuryEmployerApplied:key}))}>{label}</button>)}</div></fieldset>
              <div className={`injury-screening ${workInjuryResult.level}`} aria-live="polite"><span>系统初筛</span><strong>{workInjuryResult.title}</strong><p>{workInjuryResult.explanation}<br/>{workInjuryFilingNote}</p></div>
              <div className="injury-deadlines"><div><span>单位通常申请期限</span><strong>{workInjuryResult.employerDeadline||"事故后 30 日内"}</strong><small>特殊情况可依法申请延长</small></div><div><span>单位未申请时，个人通常期限</span><strong>{workInjuryResult.workerDeadline||"事故后 1 年内"}</strong><small>职工、近亲属或工会可直接申请</small></div></div>
              <p className="rights-evidence"><b>先保留这些材料：</b>工伤认定申请表、劳动关系证明、医疗诊断或职业病诊断材料；另保存事故现场照片、报警或责任认定、考勤排班、工作指令、同事证言及与单位沟通记录。是否构成工伤最终由社会保险行政部门依法认定。</p>
              <p className="injury-legal-note">依据《工伤保险条例》第 14、15、17、18 条进行典型情形初筛。醉酒或吸毒、自残或自杀、故意犯罪等法定排除情形，以及伤残等级和各项待遇金额，本工具暂不自动判断。</p>
            </div>
          </article>}
          {socialEnabled&&<article className="question-module">
            <header><b>社</b><div><strong>社会保险</strong><small>从工资表个人扣款反推基数，分别核算公司与个人少缴</small></div></header>
            <div className="has-paid"><span>工资表或缴费记录显示缴过社保吗？</span><button className={!setup.socialHasPaid?"active":""} onClick={()=>setSetup(s=>({...s,socialHasPaid:false,socialPaid:0,socialActualBase:0,socialPersonalPaid:0,socialPaidEndMonth:""}))}>没有</button><button className={setup.socialHasPaid?"active":""} onClick={()=>setSetup(s=>({...s,socialHasPaid:true}))}>缴纳过</button></div>
            <div className="module-fields">
              <label><span>工资表个人社保扣款</span><div className="money-input"><i>¥</i><input id="question-social-personal-paid" aria-invalid={hasQuestionIssue("question-social-personal-paid")} type="number" min="0" disabled={!setup.socialHasPaid} value={setup.socialPersonalPaid||""} placeholder={setup.socialHasPaid?"例如 523.53":"未缴为 0"} onChange={e=>setSetup(s=>({...s,socialPersonalPaid:Number(e.target.value)}))}/></div><small>填个人当月被扣金额；系统按个人费率反推实际申报基数</small></label>
              <label className="inferred"><span>实际申报缴费基数 <em>{setup.socialActualBase?"官方值":inferredSocialActualBase?"扣款反推":"待填写"}</em></span><div className="money-input"><i>¥</i><input id="question-social-base" aria-label="实际申报缴费基数" type="number" min="0" disabled={!setup.socialHasPaid} value={setup.socialActualBase||inferredSocialActualBase||""} placeholder="可留空由系统反推" onChange={e=>setSetup(s=>({...s,socialActualBase:Number(e.target.value)}))}/></div><small>官方缴费记录中的基数优先；反推值仅为估算，允许修改</small></label>
              {setup.socialHasPaid&&<><label><span>最后缴到哪个月？</span><input id="question-social-end" aria-invalid={hasQuestionIssue("question-social-end")} type="month" value={setup.socialPaidEndMonth} onChange={e=>setSetup(s=>({...s,socialPaidEndMonth:e.target.value}))}/></label><label className="inferred"><span>从哪个月开始缴？ <em>系统推定</em></span><input id="question-social-start" aria-invalid={hasQuestionIssue("question-social-start")} type="month" value={effectiveSocialStart} onChange={e=>setSetup(s=>({...s,socialPaidStartMonth:e.target.value}))}/><small>根据入职月份推定，可修改</small></label></>}
              <div className="social-rates"><div className="social-rates-head"><span>社保公司费率（医保含生育，均可修改）</span><strong>合计 {percent(effectiveSocialRate)}%</strong></div><div className="social-rate-grid">{([
                ["养老保险","socialPensionRate"],["失业保险","socialUnemploymentRate"],["工伤保险","socialInjuryRate"],["职工医保（含生育）","socialMedicalRate"],
              ] as const).map(([label,key],index)=><label key={key}><span>{label}</span><div className="money-input compact"><i>%</i><input id={index===0?"question-social-rate":undefined} aria-invalid={index===0&&hasQuestionIssue("question-social-rate")} aria-label={`${label}公司费率`} type="number" min="0" max="100" step="0.1" value={setup[key] ?? ""} onChange={e=>setSetup(s=>({...s,[key]:Number(e.target.value),socialMaternityRate:0}))}/></div></label>)}</div><div className="injury-rate-guide"><b>工伤保险行业基准费率</b><div className="injury-rate-presets">{([0.2,0.4,0.7,0.9,1.1,1.3,1.6,1.9] as const).map((rate,index)=><button type="button" key={rate} className={Number(setup.socialInjuryRate)===rate?"active":""} aria-pressed={Number(setup.socialInjuryRate)===rate} onClick={()=>setSetup(s=>({...s,socialInjuryRate:rate}))}>{index+1} 类 · {rate}%</button>)}</div><span>先按单位所属行业选择基准，再按单位实际浮动档次修正；0.84% 不是杭州通用费率。</span></div><div className="rate-guide social-guide"><b>杭州企业职工参考（核对至 2026-07-18）</b><span>养老 16%；失业常规单位 1.5%；职工医保（含生育）9.9%。工伤按行业类别和浮动档次核定，请以单位缴费明细为准。</span></div></div>
              <div className="social-rates personal-social-rates"><div className="social-rates-head"><span>社保个人费率（医保含生育，均可修改）</span><strong>合计 {percent(effectivePersonalSocialRate)}%</strong></div><div className="social-rate-grid">{([
                ["养老保险","socialPersonalPensionRate"],["失业保险","socialPersonalUnemploymentRate"],["工伤保险","socialPersonalInjuryRate"],["职工医保（含生育）","socialPersonalMedicalRate"],
              ] as const).map(([label,key])=><label key={key}><span>{label}</span><div className="money-input compact"><i>%</i><input aria-label={`${label}个人费率`} type="number" min="0" max="100" step="0.1" value={setup[key] ?? ""} onChange={e=>setSetup(s=>({...s,[key]:Number(e.target.value),socialPersonalMaternityRate:0}))}/></div></label>)}</div><div className="rate-guide social-guide"><b>杭州个人参考（核对至 2026-07-18）</b><span>养老 8%、失业 0.5%、职工医保 2%；工伤及生育不由个人另行缴费，请按本人缴费明细修正。</span></div></div>
              <div className="rate-formula social-formula"><div><small>公司实际缴纳（推算）</small><strong>¥ {money(setupSocialMonthly.employerActual)}</strong><span>实际基数 ¥ {money(effectiveSocialActualBase)} × {percent(effectiveSocialRate)}%</span></div><i>对比</i><div><small>公司应缴</small><strong>¥ {money(setupSocialMonthly.employerExpected)}</strong><span>应缴基数 ¥ {money(effectiveSocialBase)} × {percent(effectiveSocialRate)}%</span></div><i>差额</i><div className="applied"><small>公司每月少缴</small><strong>¥ {money(setupSocialMonthly.employerGap)}</strong><span>公司承担部分</span></div></div>
              <div className="rate-formula personal-reconciliation"><div><small>工资表个人已扣</small><strong>¥ {money(setupSocialMonthly.personalActual)}</strong><span>以填写扣款优先</span></div><i>对比</i><div><small>个人应缴</small><strong>¥ {money(setupSocialMonthly.personalExpected)}</strong><span>应缴基数 ¥ {money(effectiveSocialBase)} × {percent(effectivePersonalSocialRate)}%</span></div><i>差额</i><div className="applied"><small>个人每月少缴</small><strong>¥ {money(setupSocialMonthly.personalGap)}</strong><span>账户待补个人部分</span></div></div>
              <div className="contribution-total-callout"><span>社保账户每月预计应补合计</span><strong>¥ {money(setupSocialMonthly.totalGap)}</strong><small>公司 ¥ {money(setupSocialMonthly.employerGap)} + 个人 ¥ {money(setupSocialMonthly.personalGap)}</small></div>
              <p className="base-inference-note"><b>缴费基数默认使用工资推定：</b>当前以合同月薪作为缺省值；通常还需结合本人上年度月平均工资（新入职人员结合起薪月工资）及参保地当年度基数上下限修正。</p>
            </div>
            <details className="advanced-base"><summary>修改应缴测算基数</summary><label className="inferred"><span>依法应缴测算基数 <em>{setup.socialBase?"已修改":"工资推定"}</em></span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.socialBase||""} placeholder={`默认按合同月薪 ${setup.contractPay||0}`} onChange={e=>setSetup(s=>({...s,socialBase:Number(e.target.value)}))}/></div><small>默认以合同月薪作工资推定；应结合本人上年度月平均工资、新入职起薪月工资及当地上下限修正，最终以经办机构核定为准</small></label></details>
          </article>}
          {fundEnabled&&<article className="question-module">
            <header><b>积</b><div><strong>住房公积金</strong><small>从个人扣款反推缴存基数，分别核算单位与个人差额</small></div></header>
            <div className="has-paid"><span>工资表或缴存记录显示缴过公积金吗？</span><button className={!setup.fundHasPaid?"active":""} onClick={()=>setSetup(s=>({...s,fundHasPaid:false,fundPaid:0,fundActualBase:0,fundPersonalPaid:0,fundPaidEndMonth:""}))}>没有</button><button className={setup.fundHasPaid?"active":""} onClick={()=>setSetup(s=>({...s,fundHasPaid:true}))}>缴纳过</button></div>
            <div className="module-fields">
              <label><span>工资表个人公积金扣款</span><div className="money-input"><i>¥</i><input id="question-fund-personal-paid" aria-invalid={hasQuestionIssue("question-fund-personal-paid")} type="number" min="0" disabled={!setup.fundHasPaid} value={setup.fundPersonalPaid||""} placeholder={setup.fundHasPaid?"例如 125.00":"未缴为 0"} onChange={e=>setSetup(s=>({...s,fundPersonalPaid:Number(e.target.value)}))}/></div><small>系统按个人缴存比例反推实际缴存基数</small></label>
              <label className="inferred"><span>实际缴存基数 <em>{setup.fundActualBase?"官方值":inferredFundActualBase?"扣款反推":"待填写"}</em></span><div className="money-input"><i>¥</i><input aria-label="实际缴存基数" type="number" min="0" disabled={!setup.fundHasPaid} value={setup.fundActualBase||inferredFundActualBase||""} placeholder="可留空由系统反推" onChange={e=>setSetup(s=>({...s,fundActualBase:Number(e.target.value)}))}/></div><small>官方明细优先；因按元取整，反推基数可能有小幅误差</small></label>
              <label><span>单位实际每月缴存金额（可选）</span><div className="money-input"><i>¥</i><input id="question-fund-paid" type="number" min="0" disabled={!setup.fundHasPaid} value={setup.fundPaid||""} placeholder="留空则按反推基数计算" onChange={e=>setSetup(s=>({...s,fundPaid:Number(e.target.value)}))}/></div><small>如有单位缴存明细请填写；否则按实际基数 × 单位比例推算</small></label>
              {setup.fundHasPaid&&<><label className="inferred"><span>最后缴到哪个月？ {hasSocialPaidPeriod&&!setup.fundPaidEndMonth&&<em>沿用社保</em>}{setup.fundPaidEndMonth&&<em>已修改</em>}</span><input id="question-fund-end" aria-invalid={hasQuestionIssue("question-fund-end")} type="month" value={effectiveFundEnd} onChange={e=>setSetup(s=>({...s,fundPaidEndMonth:e.target.value}))}/><small>{hasSocialPaidPeriod&&!setup.fundPaidEndMonth?"已带入社保最后缴费月份，可修改":"请按公积金缴存明细填写"}</small></label><label className="inferred"><span>从哪个月开始缴？ <em>{setup.fundPaidStartMonth?"已修改":hasSocialPaidPeriod?"沿用社保":"系统推定"}</em></span><input id="question-fund-start" aria-invalid={hasQuestionIssue("question-fund-start")} type="month" value={effectiveFundStart} onChange={e=>setSetup(s=>({...s,fundPaidStartMonth:e.target.value}))}/><small>{hasSocialPaidPeriod&&!setup.fundPaidStartMonth?"已带入社保开始缴费月份，可修改":"根据入职月份推定，可修改"}</small></label></>}
              <label className="rate-field"><span>当地最低单位比例（可修改）</span><div className="rate-presets">{[5,7,10,12].map(rate=><button key={rate} className={setup.fundRate===rate?"active":""} onClick={()=>setSetup(s=>({...s,fundRate:rate}))}>{rate}%</button>)}</div><div className="money-input compact"><i>%</i><input id="question-fund-rate" aria-invalid={hasQuestionIssue("question-fund-rate")} type="number" min="0.01" max="100" step="0.1" value={setup.fundRate||""} onChange={e=>setSetup(s=>({...s,fundRate:Number(e.target.value)}))}/></div><div className="rate-guide"><b>单位缴存比例法定范围 5%–12%（普通情形）</b><span>默认最低 5%；如当地现行规则或获批情形不同，可手工修改。</span></div></label>
              <label className="rate-field personal-fund-rate"><span>个人缴存比例（可修改）</span><div className="rate-presets">{[5,7,10,12].map(rate=><button key={rate} className={setup.fundPersonalRate===rate?"active":""} onClick={()=>setSetup(s=>({...s,fundPersonalRate:rate}))}>{rate}%</button>)}</div><div className="money-input compact"><i>%</i><input aria-label="公积金个人缴存比例" type="number" min="0" max="100" step="0.1" value={setup.fundPersonalRate??""} onChange={e=>setSetup(s=>({...s,fundPersonalRate:Number(e.target.value)}))}/></div><div className="rate-guide"><b>用于估算个人应缴部分</b><span>个人缴存比例通常与单位比例一致，但仍以缴存地规则和实际缴存明细为准。</span></div></label>
              <div className="rate-formula fund-formula"><div><small>单位实际缴存（填写或推算）</small><strong>¥ {money(setupFundMonthly.employerActual)}</strong><span>实际基数 ¥ {money(effectiveFundActualBase)} × {percent(effectiveFundRate)}%</span></div><i>对比</i><div><small>单位应缴</small><strong>¥ {money(setupFundMonthly.employerExpected)}</strong><span>应缴基数 ¥ {money(effectiveFundBase)} × {percent(effectiveFundRate)}%</span></div><i>差额</i><div className="applied"><small>单位每月少缴</small><strong>¥ {money(setupFundMonthly.employerGap)}</strong><span>单位缴存部分</span></div></div>
              <div className="rate-formula personal-reconciliation"><div><small>工资表个人已扣</small><strong>¥ {money(setupFundMonthly.personalActual)}</strong><span>以填写扣款优先</span></div><i>对比</i><div><small>个人应缴</small><strong>¥ {money(setupFundMonthly.personalExpected)}</strong><span>应缴基数 ¥ {money(effectiveFundBase)} × {percent(effectiveFundPersonalRate)}%</span></div><i>差额</i><div className="applied"><small>个人每月少缴</small><strong>¥ {money(setupFundMonthly.personalGap)}</strong><span>账户待补个人部分</span></div></div>
              <div className="contribution-total-callout"><span>公积金账户每月预计应补合计</span><strong>¥ {money(setupFundMonthly.totalGap)}</strong><small>单位 ¥ {money(setupFundMonthly.employerGap)} + 个人 ¥ {money(setupFundMonthly.personalGap)}</small></div>
              <p className="base-inference-note"><b>缴费基数默认使用工资推定：</b>当前以合同月薪作为缺省值；通常还需结合本人上年度月平均工资（新入职人员结合起薪月工资）及缴存地当年度基数上下限修正。</p>
            </div>
            <details className="advanced-base"><summary>修改测算基数</summary><label className="inferred"><span>公积金测算基数 <em>{setup.fundBase?"已修改":"工资推定"}</em></span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.fundBase||""} placeholder={`默认按合同月薪 ${setup.contractPay||0}`} onChange={e=>setSetup(s=>({...s,fundBase:Number(e.target.value)}))}/></div><small>默认以合同月薪作工资推定；应结合本人上年度月平均工资、新入职起薪月工资及当地上下限修正，最终以缴存地核定为准</small></label></details>
          </article>}
          {reimbursementEnabled&&<article className="question-module reimbursement-module">
            <header><b>报</b><div><strong>报销费用未支付</strong><small>填写公司尚未支付的报销金额，可选择是否进入本次合计</small></div></header>
            <div className="module-fields reimbursement-fields">
              <label><span>尚未支付的报销金额</span><div className="money-input"><i>¥</i><input id="question-reimbursement-amount" aria-invalid={hasQuestionIssue("question-reimbursement-amount")} type="number" min="0" value={setup.reimbursementAmount||""} placeholder="例如 3,680" onChange={e=>setSetup(s=>({...s,reimbursementAmount:Number(e.target.value)}))}/></div><small>填写你已经垫付、但公司尚未支付的金额</small></label>
              <label><span>报销事项说明（可选）</span><input value={setup.reimbursementNote} placeholder="例如：差旅、交通及客户招待费" onChange={e=>setSetup(s=>({...s,reimbursementNote:e.target.value}))}/><small>将显示在导出的测算报告中</small></label>
              <div className="reimbursement-policy" role="group" aria-label="报销金额计入口径"><span>这笔报销如何处理？</span><button className={setup.reimbursementIncluded?"active":""} aria-pressed={setup.reimbursementIncluded} onClick={()=>setSetup(s=>({...s,reimbursementIncluded:true}))}>计入本次合计</button><button className={!setup.reimbursementIncluded?"active":""} aria-pressed={!setup.reimbursementIncluded} onClick={()=>setSetup(s=>({...s,reimbursementIncluded:false}))}>仅在报告中记录</button></div>
            </div>
          </article>}
        </div>
        {questionIssues.length>0&&<section className="question-validation" aria-labelledby="question-validation-title" aria-live="polite">
          <div className="question-validation-head"><span>{String(questionIssues.length).padStart(2,"0")}</span><div><h3 id="question-validation-title">还有 {questionIssues.length} 项需要处理</h3><small>点击任一问题，系统会直接定位并聚焦到对应输入框。</small></div></div>
          <ul>{questionIssues.map((issue,index)=><li key={issue.id}><button type="button" data-testid={`question-issue-${issue.id}`} onClick={()=>jumpToQuestionIssue(issue.targetId)}><b>{String(index+1).padStart(2,"0")}</b><span>{issue.message}</span><i>去处理 →</i></button></li>)}</ul>
        </section>}
        <div className="guided-actions"><button className="back" onClick={()=>setFlowStep("scenario")}>← 返回</button><button type="button" className={`next${questionsReady?"":" needs-attention"}`} onClick={continueToReview}>{questionsReady?"下一步：核对推定 →":`检查 ${questionIssues.length} 项后继续 →`}</button></div>
      </div>}

      {flowStep==="review"&&<div className="guided-step review-step">
        <div className="review-grid"><article><span>你填写的事实</span><strong>{setup.employmentDate} 入职 · {setup.employmentStatus==="active"?"当前在职":`${setup.departureDate} 离职`}</strong><p>合同月薪 ¥ {money(setup.contractPay)} · 计薪至 {setup.cutoffDate} · 共 {setupMonths} 个自然月</p></article><article><span>本次测算事项</span><strong>{claimOptions.filter(x=>selectedClaims.includes(x.key)).map(x=>x.title).join("、")}</strong><p>金额类事项进入合计；工伤模块仅作资格和期限初筛</p></article><article className="assumptions"><span>系统推定与计算依据</span><strong>{doublePayEnabled?`合同期满日 ${setup.contractEnd}`:"按本次所选事项计算"}</strong><p>{wageEnabled?"首尾月先按自然日在职比例预填，可在结果页逐月调整；":""}{socialEnabled?`社保工资推定基数 ¥ ${money(effectiveSocialBase)}，公司比例 ${percent(effectiveSocialRate)}%，个人比例 ${percent(effectivePersonalSocialRate)}%；`:""}{fundEnabled?`公积金工资推定基数 ¥ ${money(effectiveFundBase)}，单位比例 ${percent(effectiveFundRate)}%，个人比例 ${percent(effectiveFundPersonalRate)}%；`:""}{annualLeaveEnabled?`年假 ${annualLeaveUnusedDays} 天 × 日工资 × 200%；`:""}{overtimeEnabled?`加班按 150% / 200% / 300%；`:""}{compTimeEnabled?`未补休 ${percent(setup.outstandingCompTimeDays)} 天 × 200%；`:""}{terminationEnabled?`离职补偿按 ${setup.terminationType==="forced"?"N":`N+${terminationBreakdown.extraMonths}`}，N=${percent(terminationBreakdown.appliedN)}；`:""}{workInjuryEnabled?`工伤初筛：${workInjuryResult.title}（不计入合计）；`:""}{reimbursementEnabled?`报销 ¥ ${money(Number(setup.reimbursementAmount||0))}（${setup.reimbursementIncluded?"计入合计":"仅记录"}）`:""}</p></article></div>
        {(socialEnabled||fundEnabled)&&<div className="policy-warning"><b>工资推定基数需要复核</b><span>未手工修改时，系统暂以合同月薪作为社保和公积金缴费基数。实际通常需结合本人上年度月平均工资（新入职人员结合起薪月工资）以及参保、缴存地当年度基数上下限修正；最终以官方明细和经办机构核定为准。</span></div>}
        <label className="review-name"><span>测算名称（可选）</span><input value={caseName} onChange={e=>setCaseName(e.target.value)} /></label>
        <div className="guided-actions"><button className="back" onClick={()=>setFlowStep("questions")}>← 返回修改</button><button className="next generate-result" onClick={generateRows}>确认并生成结果 →</button></div>
      </div>}

      {flowStep==="results"&&<div className="guided-step result-ready"><div><span>已计算至 {setup.cutoffDate} · 共 {rows.length} 个月</span><strong>权益履行总额 ¥ {money(rightsFulfillmentTotal)}</strong><small>{setup.employmentStatus==="active"?"当前在职，截止日自动采用今天":"已按离职日期截止"}；特殊月份可在下方逐月调整</small></div><button className="back" onClick={()=>setFlowStep("basic")}>修改测算条件</button></div>}
    </section>

    {flowStep === "results" && <>
    {wageEnabled&&<section className="monthly-wage-card" aria-labelledby="monthly-wage-title">
      <header><div><p className="eyebrow">MONTHLY WAGE / 月度应发</p><h2 id="monthly-wage-title">按月调整应发工资</h2><p>首月和截止月先按自然日在职天数比例预填。请假、病假、缺勤、奖金或工资变动等特殊情况，请直接按工资条和考勤修正对应月份。</p></div><span>{monthlyWageAdjustedCount?`已调整 ${monthlyWageAdjustedCount} 个月`:"尚未手工调整"}</span></header>
      <div className="monthly-wage-list">{rows.map(row=>{const systemDue=systemDueForRow(row),deductedDue=roundMoney(Math.max(0,systemDue-Number(row.wageDeduction||0))),span=monthlyEmploymentSpan({wageMonth:row.wageMonth,employmentDate:setup.employmentDate,cutoffDate:setup.cutoffDate}),adjusted=Math.abs(Number(row.duePay||0)-deductedDue)>=0.01||Number(row.wageDeduction||0)>0;return <article key={row.id} className={adjusted?"adjusted":""}>
        <div className="monthly-wage-month"><strong>{row.wageMonth||"未填写月份"}</strong><small>{span.employedDays<span.calendarDays?`在职 ${span.employedDays}/${span.calendarDays} 个自然日`:`整月预填 ¥ ${money(systemDue)}`}</small></div>
        <label><span>请假等工资扣款</span><div className="monthly-money-input"><i>¥</i><input aria-label={`${row.wageMonth} 请假等工资扣款`} type="number" min="0" step="0.01" value={row.wageDeduction||""} placeholder="0.00" onChange={e=>update(row.id,"wageDeduction",e.target.value)}/></div><small>从系统预填应发中扣减</small></label>
        <label><span>本月应发工资</span><div className="monthly-money-input"><i>¥</i><input aria-label={`${row.wageMonth} 应发工资`} type="number" min="0" step="0.01" value={row.duePay} onChange={e=>update(row.id,"duePay",e.target.value)}/></div></label>
        <label className="monthly-wage-note"><span>情况说明</span><input aria-label={`${row.wageMonth} 工资调整说明`} value={row.note} placeholder="例如：事假 2 天、病假工资" onChange={e=>update(row.id,"note",e.target.value)}/></label>
        <div className="monthly-wage-result"><small>当前欠薪</small><strong>¥ {money(Number(row.arrears||0))}</strong>{adjusted?<button type="button" aria-label={`恢复 ${row.wageMonth} 系统预填工资`} onClick={()=>setRows(current=>current.map(item=>{if(item.id!==row.id)return item;const restored={...item,wageDeduction:0,duePay:systemDue,arrears:wageArrears({...item,duePay:systemDue})};return {...restored,status:rowSettlementStatus(restored)};}))}>恢复预填</button>:<span>系统预填</span>}</div>
      </article>})}</div>
      <p className="monthly-wage-footnote">系统先生成当月基础应发，再减去“请假等工资扣款”；当前累计扣款 ¥ {money(totals.deduction)}。自然日折算与扣款口径仍应以劳动合同、工资制度、考勤和工资表为准，修改会同步更新欠薪、备份、CSV 与报告。</p>
    </section>}
    <section className="settlement-overview" aria-label="权益履行与资金去向">
      <header><div><p className="eyebrow">SETTLEMENT ALLOCATION / 履行分配</p><h2>权益履行总额与资金去向</h2></div><p>工资表已扣金额先抵扣个人应缴；仅将个人尚差部分从未付税前工资中预计划转，避免重复扣款。</p></header>
      <div className="settlement-kpis">
        <article><span>权益履行总额</span><strong>¥ {money(rightsFulfillmentTotal)}</strong><small>单位为完整履行本次测算项目需要承担或划转的总额</small></article>
        <article><span>工资中待划个人差额</span><strong>¥ {money(personalContributionTotal)}</strong><small>社保 ¥ {money(totals.personalSocial)} · 公积金 ¥ {money(totals.personalFund)}</small></article>
        <article><span>预计个人实际取得</span><strong>¥ {money(expectedPersonalActual)}</strong><small>支付给本人的预计金额，尚未扣除个人所得税</small></article>
      </div>
      <div className="fund-flow" aria-label="资金去向明细">
        <div><b>01</b><span>支付给本人</span><strong>¥ {money(expectedPersonalActual)}</strong><small>税前欠薪扣个人应缴后，加其他直接支付项目</small></div>
        <div><b>02</b><span>缴入社保</span><strong>¥ {money(toSocialAccount)}</strong><small>个人应缴 ¥ {money(totals.personalSocial)} + 公司尚欠 ¥ {money(socialEnabled?totals.social:0)}</small></div>
        <div><b>03</b><span>缴入公积金</span><strong>¥ {money(toFundAccount)}</strong><small>个人应缴 ¥ {money(totals.personalFund)} + 公司尚欠 ¥ {money(fundEnabled?totals.fund:0)}</small></div>
      </div>
      <div className="contribution-reconciliation-summary" aria-label="社保和公积金补缴明细汇总">
        <header><div><span>缴费账户预计应补明细</span><strong>¥ {money(contributionAccountTopUpTotal)}</strong></div><small>公司少缴 + 个人少缴；个人已从工资表扣除的金额不再重复计算</small></header>
        <div className="reconciliation-row reconciliation-head"><span>账户 / 承担方</span><span>应缴</span><span>实缴或已扣</span><span>少缴</span></div>
        {socialEnabled&&<><div className="reconciliation-row"><b>社保 · 公司</b><span>¥ {money(totals.socialExpected)}</span><span>¥ {money(totals.socialActual)}</span><strong>¥ {money(totals.social)}</strong></div><div className="reconciliation-row"><b>社保 · 个人</b><span>¥ {money(totals.personalSocialExpected)}</span><span>¥ {money(totals.personalSocialActual)}</span><strong>¥ {money(totals.personalSocialGap)}</strong></div><div className="reconciliation-subtotal"><span>社保账户应补合计</span><strong>¥ {money(socialAccountTopUpTotal)}</strong></div></>}
        {fundEnabled&&<><div className="reconciliation-row"><b>公积金 · 单位</b><span>¥ {money(totals.fundExpected)}</span><span>¥ {money(totals.fundActual)}</span><strong>¥ {money(totals.fund)}</strong></div><div className="reconciliation-row"><b>公积金 · 个人</b><span>¥ {money(totals.personalFundExpected)}</span><span>¥ {money(totals.personalFundActual)}</span><strong>¥ {money(totals.personalFundGap)}</strong></div><div className="reconciliation-subtotal"><span>公积金账户应补合计</span><strong>¥ {money(fundAccountTopUpTotal)}</strong></div></>}
      </div>
      <p className="settlement-note">工资表个人扣款只能作为反推申报基数和“已扣金额”的线索，不等同于已经划入官方账户；最终仍应以社保、公积金官方明细核对。若未付工资不足以覆盖个人少缴部分，超出部分不会从“预计个人实际取得”中继续倒扣，但会保留在账户应补合计中。</p>
    </section>
    <section className="metrics guided-metrics" aria-label="测算汇总">
      {wageEnabled&&<article><span className="metric-icon wage">工</span><div><small>税前欠薪（个人应缴前）</small><strong>¥ {money(totals.arrears)}</strong><p className="wage-period"><span><b>实际欠薪期间</b><time>{wageArrearsPeriod}</time></span><span>{wageArrearsMonths.length ? `共 ${wageArrearsMonths.length} 个欠薪月份` : "以最终逐月明细为准"}<br/>占权益履行总额 {percent(rightsFulfillmentTotal ? totals.arrears / rightsFulfillmentTotal * 100 : 0)}%</span></p></div></article>}
      {socialEnabled&&<article><span className="metric-icon social">社</span><div><small>社保账户预计应补合计</small><strong>¥ {money(socialAccountTopUpTotal)}</strong><p>公司少缴 ¥ {money(totals.social)} · 个人少缴 ¥ {money(totals.personalSocialGap)}<br/>公司应缴/实缴 ¥ {money(totals.socialExpected)} / ¥ {money(totals.socialActual)}</p></div></article>}
      {fundEnabled&&<article><span className="metric-icon fund">积</span><div><small>公积金账户预计应补合计</small><strong>¥ {money(fundAccountTopUpTotal)}</strong><p>单位少缴 ¥ {money(totals.fund)} · 个人少缴 ¥ {money(totals.personalFundGap)}<br/>单位应缴/实缴 ¥ {money(totals.fundExpected)} / ¥ {money(totals.fundActual)}</p></div></article>}
      {doublePayEnabled&&<article><span className="metric-icon double">2×</span><div><small>未续签双倍工资差额</small><strong>¥ {money(totals.double)}</strong><p>{effectiveDoubleRule.enabled ? "已自动启用 · 最多支持 11 个月" : "尚未满足超期 1 个月"}</p></div></article>}
      {reimbursementEnabled&&<article><span className="metric-icon reimbursement">报</span><div><small>尚未支付的报销</small><strong>¥ {money(Number(setup.reimbursementAmount||0))}</strong><p>{setup.reimbursementIncluded?"已计入权益履行总额":"仅在报告中记录，未计入总额"}{setup.reimbursementNote&&<><br/>{setup.reimbursementNote}</>}</p></div></article>}
      {annualLeaveEnabled&&<article><span className="metric-icon annual">年</span><div><small>未休年假额外补偿</small><strong>¥ {money(annualLeaveTotal)}</strong><p>{annualLeaveUnusedDays} 天 · 日工资 ¥ {money(dailyWage(effectiveAnnualLeavePay))}<br/>{setup.annualLeaveWrittenWaiver?"已按书面主动放弃处理":"按额外 200% 计入"}</p></div></article>}
      {overtimeEnabled&&<article><span className="metric-icon overtime">加</span><div><small>加班工资</small><strong>¥ {money(overtimeTotal)}</strong><p>工作日 ¥ {money(overtimeBreakdown.weekday)} · 休息日 ¥ {money(overtimeBreakdown.restDay)}<br/>法定节假日 ¥ {money(overtimeBreakdown.holiday)}</p></div></article>}
      {compTimeEnabled&&<article><span className="metric-icon comptime">休</span><div><small>休息日加班未补休</small><strong>¥ {money(compTimeTotal)}</strong><p>{percent(setup.outstandingCompTimeDays)} 天 · 按日工资 200% 测算</p></div></article>}
      {terminationEnabled&&<article><span className="metric-icon termination">N</span><div><small>离职经济补偿</small><strong>¥ {money(terminationTotal)}</strong><p>{setup.terminationType==="forced"?"被迫离职 N":`裁员/公司解除 N+${terminationBreakdown.extraMonths}`} · N={percent(terminationBreakdown.appliedN)}<br/>N 部分 ¥ {money(terminationBreakdown.economic)}{terminationBreakdown.extra>0&&` · X 部分 ¥ ${money(terminationBreakdown.extra)}`}</p></div></article>}
      {workInjuryEnabled&&<article className={`injury-result-card ${workInjuryResult.level}`}><span className="metric-icon injury">伤</span><div><small>工伤情况初筛 · 不计入合计</small><strong>{workInjuryResult.title}</strong><p>{workInjuryResult.kindLabel}<br/>{workInjuryResult.workerDeadline?`个人通常最迟申请日 ${workInjuryResult.workerDeadline}`:"填写事故日期可显示申报期限"}</p></div></article>}
      {wageEnabled&&<article className="settled"><span className="metric-icon paid">✓</span><div><small>后续补发工资</small><strong>¥ {money(totals.paid)}</strong></div></article>}
    </section>

    {doublePayEnabled&&<section className={`rule-card ${effectiveDoubleRule.enabled ? "enabled" : ""}`}>
      <div className="rule-title"><span className="rule-badge">2×</span><div><p className="eyebrow">DOUBLE PAY RULE / 未续签双倍工资</p><h2>合同期限与超期用工自动判定</h2></div><div className={`auto-rule ${effectiveDoubleRule.enabled ? "on" : ""}`}><b>{effectiveDoubleRule.enabled ? "已自动启用" : "等待满足条件"}</b><small>无需手动开关</small></div></div>
      <div className="rule-fields">
        <label><span>劳动合同期满日</span><div className="rule-date-value">{setup.contractEnd || "未填写"}</div><small>即合同上写的最后一天，可返回引导问题修改</small></label>
        <span className="rule-arrow">→</span>
        <label><span>超期持续用工截止日</span><div className="rule-date-value">{setup.cutoffDate || "未填写"}</div><small>系统以计薪截止日期作为持续用工截止日</small></label>
        <div className="rule-result"><span>规则测算结果</span><strong>¥ {money(totals.double)}</strong><small>{(() => { const end = atMidnight(effectiveDoubleRule.contractEnd); const until = atMidnight(effectiveDoubleRule.continuedUntil); if (!end || !until) return "请先填写合同期满日并确认计薪截止日期"; const start = addDays(end,1); if (!effectiveDoubleRule.enabled) return `持续用工尚未满 1 个月，满月判定日为 ${dateLabel(addDays(addMonths(start,1),-1))}`; return `已从 ${dateLabel(start)} 起计入，最迟至 ${dateLabel(addDays(addMonths(start,11),-1))}`; })()}</small></div>
      </div>
      <p className="rule-note"><b>自动规则：</b>计薪截止日显示劳动关系在合同期满后仍持续存在，且从期满次日起达到 1 个月时，系统自动开启双倍工资，并追溯至期满次日计算额外一倍；不足整月按该月工作日比例折算，累计最多 11 个月。工资基数取明细中的“合同月薪”。</p>
    </section>}

    <section className="exceptions-card" aria-label="异常月份摘要">
      <div className="exceptions-head"><div><p className="eyebrow">EXCEPTION SUMMARY / 异常项目</p><h2>{exceptionCount} 项需要重点核对</h2></div><strong>¥ {money(rightsFulfillmentTotal)}</strong></div>
      {exceptionCount ? <div className="exception-list">{exceptionRows.map(row=><div className="exception-row" key={row.id}><b>{row.wageMonth || row.payDate || "未命名月份"}</b><span>{wageEnabled&&Number(row.arrears||0)>0&&<i>欠薪</i>}{socialEnabled&&socialDueFor(row)>0&&<i>社保</i>}{fundEnabled&&fundDueFor(row)>0&&<i>公积金</i>}{doublePayEnabled&&Number(doubleById.get(row.id)||0)>0&&<i>双倍工资</i>}</span><strong>¥ {money(rowClaimTotal(row))}</strong></div>)}
        {hasAnnualLeaveException&&<div className="exception-row"><b>未休年假</b><span><i>年假</i></span><strong>¥ {money(annualLeaveTotal)}</strong></div>}
        {hasOvertimeException&&<div className="exception-row"><b>加班工资</b><span><i>加班</i></span><strong>¥ {money(overtimeTotal)}</strong></div>}
        {hasCompTimeException&&<div className="exception-row"><b>调休未兑现</b><span><i>未补休</i></span><strong>¥ {money(compTimeTotal)}</strong></div>}
        {hasTerminationException&&<div className="exception-row"><b>离职经济补偿</b><span><i>{setup.terminationType==="forced"?"N":`N+${terminationBreakdown.extraMonths}`}</i></span><strong>¥ {money(terminationTotal)}</strong></div>}
        {hasReimbursementException&&<div className="exception-row reimbursement-exception"><b>报销费用</b><span><i>报销</i><em>{setup.reimbursementIncluded?"计入合计":"仅记录"}</em></span><strong>¥ {money(Number(setup.reimbursementAmount||0))}</strong></div>}</div> : <p className="empty-exceptions">当前条件下没有测算出欠款，请返回检查填写内容。</p>}
    </section>

    <section className="action-plan-card" aria-label="根据测算生成的下一步行动方案">
      <header className="action-plan-head"><div><p className="eyebrow">NEXT ACTION / 下一步行动</p><h2>系统已按当前情况自动分流</h2></div><span>无需重复描述经过</span></header>
      <div className="action-plan-lead"><small>当前建议</small><strong>{rightsPlan.headline}</strong><p>{rightsPlan.summary}</p></div>
      <div className="action-route-grid">{rightsPlan.routes.map((route,index)=><article key={route.id} className={`action-route ${route.tone}`}>
        <div><span>{String(index+1).padStart(2,"0")}</span><b>{route.badge}</b></div>
        <small>{route.suitable}</small><h3>{route.title}</h3><p>{route.description}</p>
        <ol>{route.steps.map((step:string)=><li key={step}>{step}</li>)}</ol>
        <p className="route-caution">{route.caution}</p>
      </article>)}</div>
      <details className="evidence-plan"><summary>查看本案证据清单 <span>{rightsPlan.evidence.length} 项</span></summary><ul>{rightsPlan.evidence.map((item:string)=><li key={item}>{item}</li>)}</ul><p>尽量保存官方PDF、盖章明细及聊天、邮件、录音的原始文件，不只保留裁剪后的截图。</p></details>
    </section>

    <section className="precision-card">
      <div><div><p className="eyebrow">PRECISION LEDGER / 精算底稿</p><h2>需要逐月复核时再展开</h2></div><button className="back" onClick={()=>setPrecisionOpen(open=>!open)}>{precisionOpen?"收起精算明细":"查看精算明细"}</button></div>
      <p>精算明细仅用于复核、修正特殊月份和导出底稿；日常测算不需要逐格填写。</p>
    </section>

    {precisionOpen&&<section className="sheet">
      <div className="sheet-head"><div><p className="eyebrow">MONTHLY LEDGER / 月度台账</p><h2>欠薪与补缴明细</h2></div><div className="tools"><label className="search">⌕<input aria-label="搜索月份或备注" placeholder="搜索月份或备注" value={query} onChange={e => setQuery(e.target.value)}/></label><div className="filters">{(["全部","未结清","已结清"] as const).map(x => <button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</div><button className="add" onClick={addRow}>＋ 新增月份</button></div></div>
	      <div className="table-wrap"><table><thead><tr>{fields.map((f,i) => <th key={`${f.key}-${i}`} style={{minWidth:f.width}}>{f.group && <span>{f.group}</span>}{f.label}</th>)}<th className="double-col"><span>未续签</span>双倍工资差额</th><th className="sticky-right">本月权益履行</th><th className="sticky-right action-col"></th></tr></thead>
	      <tbody>{visible.map(r => { const status=rowSettlementStatus(r); return <tr key={r.id} className={status === "未结清" ? "open" : ""}>{fields.map((f,i) => <td key={`${String(f.key)}-${i}`}>
        {f.key === "status" ? <output aria-label={`${r.payDate}结清状态`} className={status === "未结清" ? "status open" : "status"}>{status}</output>
        : f.key === "socialDue" || f.key === "fundDue" ? <div className="calculated-cell"><b>¥ {money(f.key === "socialDue" ? socialDueFor(r) : fundDueFor(r))}</b><small>自动计算</small></div>
        : <input aria-label={`${r.payDate}${f.label}`} className={f.key === "wageMonth" || f.key === "note" || f.key === "payDate" ? "text" : "number"} type={f.key === "wageMonth" ? "month" : f.key === "note" || f.key === "payDate" ? "text" : "number"} step="0.01" value={r[f.key]} onChange={e=>update(r.id,f.key,e.target.value)}/>}</td>)}
        <td className={`double-value ${doublePayEnabled&&(doubleById.get(r.id) || 0) > 0 ? "active" : ""}`}>¥ {money(doublePayEnabled ? doubleById.get(r.id) || 0 : 0)}</td>
        <td className="row-total sticky-right">¥ {money(rowClaimTotal(r))}</td><td className="sticky-right action-col"><button aria-label={`删除${r.payDate}`} className="delete" onClick={()=>remove(r.id)}>×</button></td></tr>})}</tbody>
	      <tfoot><tr>{fields.map((f,i) => <td key={`${String(f.key)}-total`}>{i === 0 ? "总计" : f.key === "normalPay" ? `¥ ${money(totals.normal)}` : f.key === "paid" ? `¥ ${money(totals.paid)}` : f.key === "arrears" ? `¥ ${money(totals.arrears)}` : f.key === "socialPaid" ? `¥ ${money(totals.socialActual)}` : f.key === "socialDue" ? `¥ ${money(totals.social)}` : f.key === "fundPaid" ? `¥ ${money(totals.fundActual)}` : f.key === "fundDue" ? `¥ ${money(totals.fund)}` : ""}</td>)}<td>¥ {money(totals.double)}</td><td className="sticky-right">¥ {money(rightsFulfillmentTotal)}</td><td className="sticky-right action-col"></td></tr></tfoot></table></div>
      <div className="sheet-foot"><span>显示 {visible.length} / {rows.length} 条记录 · 修改后请保存</span><span><i></i> 可编辑单元格 <b>总计另包含已选的年假、加班、未补休、离职补偿及报销项目</b></span></div>
    </section>}
    </>}

    <section className="print-report" aria-label="工资、社保及劳动权益欠款测算报告">
      <article className="report-sheet">
        <header className="report-masthead">
          <div><strong>薪资计算器</strong><span>WAGE &amp; BENEFITS CALCULATION</span></div>
          <dl><div><dt>报告编号</dt><dd>{reportNumber}</dd></div><div><dt>报告状态</dt><dd>测算底稿</dd></div></dl>
        </header>

        <section className="report-title-block">
          <p className="report-kicker">系统生成报告 · SYSTEM GENERATED REPORT</p>
          <h1>工资、社会保险与劳动权益<br/>欠款测算报告</h1>
          <p className="report-deck">基于用户填报的任职、工资、缴费、休假、加班、离职补偿、工伤情况及报销信息，对当前尚欠项目和辅助初筛信息进行结构化汇总。金额以人民币列示。</p>
        </section>

        <dl className="report-meta">
          <div><dt>任职状态</dt><dd>{setup.employmentStatus==="active"?"当前在职":"已经离职"}</dd></div>
          <div><dt>测算期间</dt><dd>{rows.length} 个月</dd></div>
          <div><dt>入职日期</dt><dd>{setup.employmentDate||"—"}</dd></div>
          <div><dt>计薪截止日期</dt><dd>{setup.cutoffDate||"—"}</dd></div>
        </dl>

        <section className="report-executive" aria-label="权益履行总额">
          <div><span>权益履行总额</span><p>个人应缴部分从税前欠薪中预计划转，不在总额中重复相加。{reimbursementEnabled?(setup.reimbursementIncluded?" 已包含用户填报的报销金额。":` 未包含仅作记录的报销金额 ¥ ${money(Number(setup.reimbursementAmount||0))}。`):""}</p></div>
          <strong><small>¥</small>{money(rightsFulfillmentTotal)}</strong>
        </section>

        <section className="report-allocation" aria-label="资金去向">
          <header><div><span>工资中待划个人差额</span><strong>¥ {money(personalContributionTotal)}</strong><small>社保 ¥ {money(totals.personalSocial)} · 公积金 ¥ {money(totals.personalFund)}</small></div><p>资金去向</p></header>
          <div><article><span>支付给本人</span><strong>¥ {money(expectedPersonalActual)}</strong></article><article><span>缴入社保</span><strong>¥ {money(toSocialAccount)}</strong></article><article><span>缴入公积金</span><strong>¥ {money(toFundAccount)}</strong></article></div>
          <p>预计个人实际取得未扣个人所得税。缴费基数暂按工资推定，需结合本人上年度月平均工资、新入职起薪月工资及当地上下限修正。</p>
        </section>

        <section className="report-section report-contribution-reconciliation">
          <header><span className="report-section-index">缴</span><div><h2>社保与公积金补缴明细</h2><p>公司/单位与个人分别核算</p></div></header>
          <table className="report-summary-table"><thead><tr><th>账户与承担方</th><th>应缴</th><th>实缴或工资表已扣</th><th>少缴</th></tr></thead><tbody>
            {socialEnabled&&<><tr><td>社保 · 公司</td><td>¥ {money(totals.socialExpected)}</td><td>¥ {money(totals.socialActual)}</td><td>¥ {money(totals.social)}</td></tr><tr><td>社保 · 个人</td><td>¥ {money(totals.personalSocialExpected)}</td><td>¥ {money(totals.personalSocialActual)}</td><td>¥ {money(totals.personalSocialGap)}</td></tr><tr className="report-supplement-row"><td colSpan={3}>社保账户预计应补合计</td><td>¥ {money(socialAccountTopUpTotal)}</td></tr></>}
            {fundEnabled&&<><tr><td>公积金 · 单位</td><td>¥ {money(totals.fundExpected)}</td><td>¥ {money(totals.fundActual)}</td><td>¥ {money(totals.fund)}</td></tr><tr><td>公积金 · 个人</td><td>¥ {money(totals.personalFundExpected)}</td><td>¥ {money(totals.personalFundActual)}</td><td>¥ {money(totals.personalFundGap)}</td></tr><tr className="report-supplement-row"><td colSpan={3}>公积金账户预计应补合计</td><td>¥ {money(fundAccountTopUpTotal)}</td></tr></>}
          </tbody><tfoot><tr><th colSpan={3}>两个账户预计应补总额</th><td>¥ {money(contributionAccountTopUpTotal)}</td></tr></tfoot></table>
          <p className="report-note">工资表扣款用于反推实际基数并抵扣个人应缴，但不证明款项已进入个人官方账户；请以官方缴费、缴存明细复核。</p>
        </section>

        <section className="report-section report-composition">
          <header><span className="report-section-index">01</span><div><h2>权益构成</h2><p>按本次选择的测算事项汇总</p></div></header>
          <table className="report-summary-table">
            <thead><tr><th>项目</th><th>计算口径</th><th>金额（人民币）</th></tr></thead>
            <tbody>
              {wageEnabled&&<tr><td>税前欠薪（个人应缴前）</td><td>{wageArrearsMonths.length?`${wageArrearsPeriod}（${wageArrearsMonths.length}个月）${monthlyWageAdjustedCount?`；${monthlyWageAdjustedCount}个月调整，含请假等扣款 ¥ ${money(totals.deduction)}`:"；首尾月按自然日在职比例预填"}`:"当前未形成欠薪"}</td><td>¥ {money(totals.arrears)}</td></tr>}
              {socialEnabled&&<tr><td>社保公司尚欠补缴</td><td>社保公司承担部分</td><td>¥ {money(totals.social)}</td></tr>}
              {fundEnabled&&<tr><td>公积金公司尚欠补缴</td><td>单位缴存部分</td><td>¥ {money(totals.fund)}</td></tr>}
              {doublePayEnabled&&<tr><td>未续签双倍工资差额</td><td>满足条件后最多 11 个月</td><td>¥ {money(totals.double)}</td></tr>}
              {annualLeaveEnabled&&<tr><td>未休年假额外补偿</td><td>{annualLeaveUnusedDays} 天 × 日工资 × 200%</td><td>¥ {money(annualLeaveTotal)}</td></tr>}
              {overtimeEnabled&&<tr><td>加班工资</td><td>工作日 150% / 休息日 200% / 法定节假日 300%</td><td>¥ {money(overtimeTotal)}</td></tr>}
              {compTimeEnabled&&<tr><td>休息日加班未补休</td><td>{percent(setup.outstandingCompTimeDays)} 天 × 日工资 × 200%</td><td>¥ {money(compTimeTotal)}</td></tr>}
              {terminationEnabled&&<tr><td>离职经济补偿</td><td>{setup.terminationType==="forced"?`N=${percent(terminationBreakdown.appliedN)}`:`N=${percent(terminationBreakdown.appliedN)} + X=${terminationBreakdown.extraMonths}`}</td><td>¥ {money(terminationTotal)}</td></tr>}
              {workInjuryEnabled&&<tr className="report-supplement-row"><td>工伤情况初筛</td><td>{workInjuryResult.title}</td><td>不计入合计</td></tr>}
              {reimbursementEnabled&&<tr><td>报销欠款</td><td>{setup.reimbursementIncluded?"计入本次合计":"仅作记录，不计入合计"}</td><td>¥ {money(Number(setup.reimbursementAmount||0))}</td></tr>}
              {personalContributionTotal>0&&<tr className="report-supplement-row"><td>工资中待划个人差额</td><td>已扣金额先抵扣，仅将剩余差额从税前欠薪划转</td><td>¥ {money(personalContributionTotal)}</td></tr>}
              {wageEnabled&&totals.paid>0&&<tr className="report-supplement-row"><td>后续补发工资</td><td>参考信息，不重复计入</td><td>¥ {money(totals.paid)}</td></tr>}
            </tbody>
            <tfoot><tr><th colSpan={2}>权益履行总额</th><td>¥ {money(rightsFulfillmentTotal)}</td></tr></tfoot>
          </table>
        </section>

        <div className="report-detail-grid">
          <section className="report-section report-rule">
            <header><span className="report-section-index">02</span><div><h2>双倍工资测算</h2><p>合同期满后持续用工</p></div></header>
            <dl className="report-data-list"><div><dt>劳动合同期满日</dt><dd>{setup.contractEnd||"未选择该事项"}</dd></div><div><dt>持续用工截止日</dt><dd>{setup.cutoffDate||"—"}</dd></div><div><dt>测算结果</dt><dd>¥ {money(doublePayEnabled?totals.double:0)}</dd></div></dl>
            <p className="report-note">{doublePayEnabled?"持续用工满 1 个月后，从合同期满次日起测算额外一倍工资，累计最多 11 个月。":"本次未选择未续签双倍工资事项。"}</p>
          </section>

          <section className="report-section report-reimbursement">
            <header><span className="report-section-index">03</span><div><h2>报销信息</h2><p>用户填报，凭证待核验</p></div></header>
            <dl className="report-data-list"><div><dt>报销金额</dt><dd>¥ {money(reimbursementEnabled?Number(setup.reimbursementAmount||0):0)}</dd></div><div><dt>报销口径</dt><dd>{reimbursementEnabled?(setup.reimbursementIncluded?"计入本次合计":"仅在报告中记录"):"未选择报销事项"}</dd></div><div><dt>事项说明</dt><dd>{reimbursementEnabled?(setup.reimbursementNote||"用户未填写说明"):"—"}</dd></div></dl>
            <p className="report-note">本报告不核验发票、审批单或支付凭证。</p>
          </section>
        </div>

        {workInjuryEnabled&&<section className="report-section report-work-injury">
          <header><span className="report-section-index">04</span><div><h2>工伤情况初筛</h2><p>典型情形与申报期限提示，不构成工伤认定</p></div></header>
          <dl className="report-data-list report-injury-list"><div><dt>用户选择情形</dt><dd>{workInjuryResult.kindLabel}</dd></div><div><dt>初筛结果</dt><dd>{workInjuryResult.title}</dd></div><div><dt>单位通常申请期限</dt><dd>{workInjuryResult.employerDeadline||"事故后 30 日内"}</dd></div><div><dt>个人通常申请期限</dt><dd>{workInjuryResult.workerDeadline||"事故后 1 年内"}</dd></div><div><dt>单位申报情况</dt><dd>{setup.workInjuryEmployerApplied==="yes"?"已申请":setup.workInjuryEmployerApplied==="no"?"未申请":"不清楚"}</dd></div></dl>
          <p className="report-note">{workInjuryResult.explanation} {workInjuryFilingNote} 依据《工伤保险条例》第 14、15、17、18 条进行初筛；最终以社会保险行政部门的工伤认定决定、劳动能力鉴定和有效证据为准。</p>
        </section>}

        <section className="report-section report-methodology">
          <header><span className="report-section-index">{workInjuryEnabled?"05":"04"}</span><div><h2>报告说明</h2><p>数据来源与使用范围</p></div></header>
          <dl><div><dt>数据来源</dt><dd>用户填报及本地测算明细</dd></div><div><dt>生成方式</dt><dd>系统自动测算</dd></div><div><dt>使用范围</dt><dd>复核、沟通与证据整理参考</dd></div></dl>
        </section>

        <section className="report-section report-rights-plan">
          <header><span className="report-section-index">{workInjuryEnabled?"06":"05"}</span><div><h2>维权路径建议</h2><p>全国通用程序框架，具体受理窗口以所在地公开办事指南为准</p></div></header>
          <div className="report-route-intro">
            <span>根据本次填报自动生成</span>
            <strong>{rightsPlan.headline}</strong>
            <p>{rightsPlan.summary} 以下内容不改变本报告任何测算金额，也不替代主管机关核定、仲裁裁决或个案法律意见。</p>
          </div>
          <table className="report-route-table">
            <thead><tr><th>建议路径</th><th>当前适用原因</th><th>行动与程序边界</th></tr></thead>
            <tbody>{rightsPlan.routes.map(route=><tr key={route.id}><td><b>{route.title}</b><small>{route.badge}</small></td><td>{route.suitable}</td><td>{route.description} 建议步骤：{route.steps.join("；")}。{route.caution}</td></tr>)}</tbody>
          </table>
          <div className="report-action-order">
            <span>建议顺序</span>
            <ol><li><b>固定证据</b> {rightsPlan.evidence.join("；")}。</li><li><b>书面留痕</b> 催告不是全国统一法定前置程序，但可用于固定主张、单位答复和送达事实；不要填写与实际解除理由冲突的普通辞职文件。</li><li><b>按路径办理</b> 补缴请求与劳动报酬、解除补偿争议分别进入对应程序；各地受理部门和材料要求以公开办事指南为准。</li></ol>
          </div>
          <p className="report-route-basis">主要全国性依据：《劳动保障监察条例》《劳动争议调解仲裁法》《劳动合同法》《社会保险法》《住房公积金管理条例》《工伤保险条例》《民事诉讼法》《刑法》《法律援助法》、拒不支付劳动报酬刑事案件司法解释及最高人民法院劳动争议司法解释（二）。本节为程序导航，不替代受理机关的管辖判断、刑事立案判断或个案法律意见。</p>
        </section>

        <p className="report-disclaimer">重要说明：本报告仅作为测算底稿，不构成法律意见、工伤认定或缴费核定结论。离职原因、解除程序、经济补偿资格、工伤认定、年假资格、加班工资基数、工时制度、仲裁时效及最终金额，均以有效证据、当地裁审口径、参保地现行政策及法定程序认定为准。</p>
        <footer className="report-footer"><span>{reportNumber}</span><span>薪资计算器 · 系统生成</span><span>报告末页</span></footer>
      </article>
    </section>

    <footer><span>薪资计算器</span><p>测算与初筛结果仅供核对参考，工资、缴费、工伤、年假、加班、调休及例外情形请以有效证据、法定认定程序和当地裁审口径为准。</p><button onClick={() => { if(confirm("加载示例会替换当前页面数据，是否继续？")) { setRows(exampleRows); setDoubleRule(defaultRule); setSetup({...defaultSetup,employmentStatus:"departed",employmentDate:"2025-06-01",departureDate:"2026-07-10",cutoffDate:"2026-07-10",contractStart:"2025-06-01",contractEnd:"2026-06-10",contractPay:20000,arrearsStartMonth:"2026-02",firstArrearsPaidRate:30,socialHasPaid:true,socialActualBase:4986,socialPaidStartMonth:"2025-06",socialPaidEndMonth:"2026-07",socialBase:20000,fundHasPaid:true,fundPaid:250,fundPaidStartMonth:"2025-06",fundPaidEndMonth:"2026-07",fundBase:20000,fundRate:11.756}); setSelectedClaims(["wage","social","fund","doublePay"]); setFlowStep("results"); setPrecisionOpen(false); setCaseName("示例：欠薪与补缴测算"); } }}>加载示例数据</button></footer>
  </main>;
}
