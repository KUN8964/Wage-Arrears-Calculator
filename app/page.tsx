"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_SOCIAL_RATES, declaredBaseFromPaidAmount, socialContributionForMonth, totalEmployerRate } from "./contribution-calculator.mjs";
import { annualLeaveCompensation, compTimeCompensation, currentYearEmploymentDays, dailyWage, overtimeCompensation, proratedAnnualLeaveDays, statutoryAnnualLeaveDays } from "./leave-overtime-calculator.mjs";

type Row = {
  id: number;
  wageMonth: string;
  payDate: string;
  normalPay: number;
  note: string;
  paid: number;
  status: "已结清" | "未结清";
  duePay: number;
  arrears: number;
  contractPay: number;
  socialPaid: number;
  socialBase: number;
  socialRate: number;
  socialDue: number;
  fundPaid: number;
  fundBase: number;
  fundRate: number;
  fundDue: number;
};

type DoublePayRule = { enabled: boolean; contractEnd: string; continuedUntil: string };
const defaultRule: DoublePayRule = { enabled: false, contractEnd: "", continuedUntil: "" };
type Claim = "wage" | "social" | "fund" | "doublePay" | "reimbursement" | "annualLeave" | "overtime" | "compTime";
type FlowStep = "basic" | "scenario" | "questions" | "review" | "results";
type SocialRates = { pension: number; unemployment: number; injury: number; maternity: number; medical: number };
type QuickSetup = {
  employmentDate: string; cutoffDate: string; contractStart: string; contractEnd: string; contractPay: number;
  arrearsStartMonth: string; firstArrearsPaidRate: number;
  socialHasPaid: boolean; socialPaid: number; socialActualBase: number; socialPaidStartMonth: string; socialPaidEndMonth: string; socialBase: number; socialRate: number;
  socialPensionRate: number; socialUnemploymentRate: number; socialInjuryRate: number; socialMaternityRate: number; socialMedicalRate: number;
  fundHasPaid: boolean; fundPaid: number; fundPaidStartMonth: string; fundPaidEndMonth: string; fundBase: number; fundRate: number;
  reimbursementAmount: number; reimbursementNote: string; reimbursementIncluded: boolean;
  annualLeaveWorkYears: number; annualLeaveTakenDays: number; annualLeavePriorUnusedDays: number; annualLeaveAveragePay: number; annualLeaveWrittenWaiver: boolean;
  overtimeWageBase: number; weekdayOvertimeHours: number; restDayOvertimeHours: number; holidayOvertimeHours: number;
  compTimeWageBase: number; outstandingCompTimeDays: number; restDayClaimsDistinct: boolean;
};
type LegacyQuickSetup = Partial<QuickSetup> & { startMonth?: string; endMonth?: string; duePay?: number; actualPay?: number };
const defaultSetup: QuickSetup = {
  employmentDate: "", cutoffDate: "", contractStart: "", contractEnd: "", contractPay: 0,
  arrearsStartMonth: "", firstArrearsPaidRate: 0,
  socialHasPaid: false, socialPaid: 0, socialActualBase: 0, socialPaidStartMonth: "", socialPaidEndMonth: "", socialBase: 0, socialRate: 28.9,
  socialPensionRate: DEFAULT_SOCIAL_RATES.pension, socialUnemploymentRate: DEFAULT_SOCIAL_RATES.unemployment,
  socialInjuryRate: DEFAULT_SOCIAL_RATES.injury, socialMaternityRate: DEFAULT_SOCIAL_RATES.maternity, socialMedicalRate: DEFAULT_SOCIAL_RATES.medical,
  fundHasPaid: false, fundPaid: 0, fundPaidStartMonth: "", fundPaidEndMonth: "", fundBase: 0, fundRate: 5,
  reimbursementAmount: 0, reimbursementNote: "", reimbursementIncluded: true,
  annualLeaveWorkYears: 1, annualLeaveTakenDays: 0, annualLeavePriorUnusedDays: 0, annualLeaveAveragePay: 0, annualLeaveWrittenWaiver: false,
  overtimeWageBase: 0, weekdayOvertimeHours: 0, restDayOvertimeHours: 0, holidayOvertimeHours: 0,
  compTimeWageBase: 0, outstandingCompTimeDays: 0, restDayClaimsDistinct: false,
};
const claimOptions: { key: Claim; title: string; copy: string; mark: string }[] = [
  {key:"wage",title:"工资少发或未发",copy:"从欠薪开始月自动计算",mark:"欠"},
  {key:"social",title:"社保少缴或未缴",copy:"计算公司部分尚欠差额",mark:"社"},
  {key:"fund",title:"公积金少缴或未缴",copy:"实缴金额先抵扣应缴",mark:"积"},
  {key:"doublePay",title:"合同到期仍在工作",copy:"满一个月自动双倍计薪",mark:"2×"},
  {key:"reimbursement",title:"报销费用未支付",copy:"可计入合计或仅在报告记录",mark:"报"},
  {key:"annualLeave",title:"未休年假折现",copy:"按工龄和离职当年天数折算",mark:"年"},
  {key:"overtime",title:"加班工资未支付",copy:"工作日、休息日和法定节假日分开算",mark:"加"},
  {key:"compTime",title:"调休尚未兑现",copy:"只计算休息日加班尚未补休",mark:"休"},
];

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
].map(([id,payDate,normalPay,note,paid,status,duePay,arrears,contractPay,_legacySocialPaid,socialActualBase,_legacySocialDue,fundPaid,fundBase,fundDue], index) => {
  const start = new Date(2025, 5 + Math.max(0, index - 1), 1);
  const wageMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  const targetBase = Number(contractPay || 0);
  const social = socialContributionForMonth({expectedBase:targetBase,actualBase:Number(socialActualBase||0),rates:DEFAULT_SOCIAL_RATES});
  return { id, wageMonth, payDate, normalPay, note, paid, status, duePay, arrears, contractPay, socialPaid:social.actual, socialBase:targetBase, socialRate:social.rate, socialDue:social.gap, fundPaid, fundBase:targetBase, fundRate:targetBase ? (Number(fundDue)+Number(fundPaid))/targetBase*100 : 0, fundDue } as Row;
});

const blankRow = (): Row => ({ id: Date.now(), wageMonth:"", payDate:"", normalPay:0, note:"", paid:0, status:"未结清", duePay:0, arrears:0, contractPay:0, socialPaid:0, socialBase:0, socialRate:0, socialDue:0, fundPaid:0, fundBase:0, fundRate:0, fundDue:0 });

const socialDueFor = (row: Row) => Math.max(0, Number(row.socialBase || 0) * Number(row.socialRate || 0) / 100 - Number(row.socialPaid || 0));
const fundDueFor = (row: Row) => Math.max(0, Number(row.fundBase || 0) * Number(row.fundRate || 0) / 100 - Number(row.fundPaid || 0));
const monthCountBetween = (startValue: string, endValue: string) => {
  const start = atMidnight(startValue), end = atMidnight(endValue);
  if (!start || !end || end < start) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
};
const monthIsWithin = (month: string, startMonth: string, endMonth: string) => Boolean(month && startMonth && endMonth && month >= startMonth && month <= endMonth);
const paidMonthsWithin = (employmentDate: string, cutoffDate: string, paidStart: string, paidEnd: string) => {
  if (!employmentDate || !cutoffDate || !paidStart || !paidEnd || paidStart > paidEnd) return 0;
  const start = paidStart > employmentDate.slice(0,7) ? paidStart : employmentDate.slice(0,7);
  const end = paidEnd < cutoffDate.slice(0,7) ? paidEnd : cutoffDate.slice(0,7);
  return start <= end ? monthCountBetween(`${start}-01`, `${end}-01`) : 0;
};
const normalizeRow = (row: Row, index = 0): Row => {
  if (row.socialRate != null && row.fundRate != null) return row;
  const fallback = exampleRows[Math.min(index, exampleRows.length - 1)] || blankRow();
  const socialBase = Number(row.contractPay || row.socialBase || 0);
  const fundBase = Number(row.contractPay || row.fundBase || 0);
  return {
    ...fallback, ...row, socialBase, fundBase,
    socialRate: socialBase ? (Number(row.socialDue || 0) + Number(row.socialPaid || 0)) / socialBase * 100 : 0,
    fundRate: fundBase ? (Number(row.fundDue || 0) + Number(row.fundPaid || 0)) / fundBase * 100 : 0,
  };
};

const money = (value: number) => value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const percent = (value: number) => value.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const atMidnight = (value: string) => value ? new Date(`${value}T00:00:00`) : null;
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const addMonths = (date: Date, months: number) => {
  const targetMonth = date.getMonth() + months;
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  return new Date(date.getFullYear(), targetMonth, Math.min(date.getDate(), lastDay));
};
const dateLabel = (date: Date | null) => date ? date.toLocaleDateString("zh-CN") : "—";
const normalizeSetup = (old: LegacyQuickSetup = {}): QuickSetup => {
  const oldEnd = old.endMonth ? new Date(Number(old.endMonth.slice(0,4)), Number(old.endMonth.slice(5,7)), 0) : null;
  const employmentDate = old.employmentDate || (old.startMonth ? `${old.startMonth}-01` : "");
  const cutoffDate = old.cutoffDate || (oldEnd ? `${oldEnd.getFullYear()}-${String(oldEnd.getMonth()+1).padStart(2,"0")}-${String(oldEnd.getDate()).padStart(2,"0")}` : "");
  const {startMonth: _startMonth, endMonth: _endMonth, duePay: _duePay, actualPay: _actualPay, ...current} = old;
  const rates: SocialRates = {
    pension:Number(old.socialPensionRate ?? DEFAULT_SOCIAL_RATES.pension), unemployment:Number(old.socialUnemploymentRate ?? DEFAULT_SOCIAL_RATES.unemployment),
    injury:Number(old.socialInjuryRate ?? DEFAULT_SOCIAL_RATES.injury), maternity:Number(old.socialMaternityRate ?? DEFAULT_SOCIAL_RATES.maternity), medical:Number(old.socialMedicalRate ?? DEFAULT_SOCIAL_RATES.medical),
  };
  const socialRate = totalEmployerRate(rates);
  const socialActualBase = Number(old.socialActualBase||0) || declaredBaseFromPaidAmount(Number(old.socialPaid||0), rates);
  return {...defaultSetup, ...current, employmentDate, cutoffDate, contractStart:old.contractStart || employmentDate, socialActualBase, socialRate,
    socialPensionRate:rates.pension, socialUnemploymentRate:rates.unemployment, socialInjuryRate:rates.injury, socialMaternityRate:rates.maternity, socialMedicalRate:rates.medical,
    fundRate:Number(old.fundRate||0)>0?Number(old.fundRate):5, socialHasPaid:old.socialHasPaid ?? Number(old.socialPaid||0)>0, fundHasPaid:old.fundHasPaid ?? Number(old.fundPaid||0)>0};
};
const todayInputValue = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; };
const weekdayCount = (start: Date, endExclusive: Date) => {
  let count = 0;
  for (let day = new Date(start); day < endExclusive; day = addDays(day, 1)) if (day.getDay() !== 0 && day.getDay() !== 6) count++;
  return count;
};

function doublePayForRow(row: Row, rule: DoublePayRule) {
  const contractEnd = atMidnight(rule.contractEnd);
  const continuedUntil = atMidnight(rule.continuedUntil);
  if (!rule.enabled || !contractEnd || !continuedUntil || !/^\d{4}-\d{2}$/.test(row.wageMonth)) return 0;
  const eligibleStart = addDays(contractEnd, 1);
  if (addDays(continuedUntil, 1) < addMonths(eligibleStart, 1)) return 0;
  const capExclusive = addMonths(eligibleStart, 11);
  const continuedEndExclusive = addDays(continuedUntil, 1);
  const workEndExclusive = continuedEndExclusive < capExclusive ? continuedEndExclusive : capExclusive;
  const [year, month] = row.wageMonth.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const overlapStart = monthStart > eligibleStart ? monthStart : eligibleStart;
  const overlapEnd = monthEnd < workEndExclusive ? monthEnd : workEndExclusive;
  if (overlapEnd <= overlapStart) return 0;
  const monthWorkdays = weekdayCount(monthStart, monthEnd);
  return monthWorkdays ? Number(row.contractPay || 0) * weekdayCount(overlapStart, overlapEnd) / monthWorkdays : 0;
}

function automaticDoubleRuleFor(setup: QuickSetup, fallback: DoublePayRule): DoublePayRule {
  if (!setup.contractEnd || !setup.cutoffDate) return fallback;
  const contractEnd = atMidnight(setup.contractEnd), continuedUntil = atMidnight(setup.cutoffDate);
  if (!contractEnd || !continuedUntil) return defaultRule;
  const eligibleStart = addDays(contractEnd, 1);
  return { contractEnd:setup.contractEnd, continuedUntil:setup.cutoffDate, enabled:addDays(continuedUntil, 1) >= addMonths(eligibleStart, 1) };
}

const fields: { key: keyof Row; label: string; group?: string; width?: number }[] = [
  {key:"wageMonth",label:"工资所属月",width:112}, {key:"payDate",label:"实际发薪日",width:126}, {key:"normalPay",label:"已发工资",width:116},
  {key:"note",label:"备注",width:178}, {key:"paid",label:"后续补发",width:108},
  {key:"status",label:"结清状态",width:100}, {key:"duePay",label:"应发薪水",width:110},
  {key:"arrears",label:"欠薪",width:108}, {key:"contractPay",label:"合同月薪",width:110},
  {key:"socialPaid",label:"公司实际已缴",group:"社保",width:112}, {key:"socialBase",label:"应缴基数",group:"社保",width:105}, {key:"socialRate",label:"公司比例(%)",group:"社保",width:104},
  {key:"socialDue",label:"尚欠补缴金额",group:"社保",width:122}, {key:"fundPaid",label:"公司实际已缴",group:"公积金",width:112},
  {key:"fundBase",label:"应缴基数",group:"公积金",width:105}, {key:"fundRate",label:"公司比例(%)",group:"公积金",width:104}, {key:"fundDue",label:"尚欠补缴金额",group:"公积金",width:122},
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
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSetup(current => current.cutoffDate ? current : {...current,cutoffDate:todayInputValue()});
    const cached = localStorage.getItem("xinbao-rows");
    if (cached) try {
      const parsed = JSON.parse(cached) as Row[];
      setRows(parsed.map((row, index) => normalizeRow({ ...row, wageMonth: row.wageMonth || exampleRows[index]?.wageMonth || "" } as Row, index)));
    } catch { /* use seed data */ }
    const cachedRule = localStorage.getItem("xinbao-double-rule");
    let restoredRule = defaultRule;
    if (cachedRule) try { restoredRule = {...defaultRule, ...JSON.parse(cachedRule)}; setDoubleRule(restoredRule); } catch { /* use defaults */ }
    const cachedMeta = localStorage.getItem("xinbao-meta");
    if (cachedMeta) try {
      const meta = JSON.parse(cachedMeta), old = meta.setup || {};
      setCaseName(meta.caseName || "我的欠款测算");
      setSetup(normalizeSetup({...old, contractEnd:old.contractEnd || restoredRule.contractEnd, cutoffDate:old.cutoffDate || restoredRule.continuedUntil}));
      setSelectedClaims(Array.isArray(meta.selectedClaims) ? meta.selectedClaims : ["wage","social","fund","doublePay"]);
      setFlowStep(meta.flowStep || "results");
    } catch { /* use defaults */ }
  }, []);

  const wageEnabled=selectedClaims.includes("wage"), socialEnabled=selectedClaims.includes("social"), fundEnabled=selectedClaims.includes("fund"), doublePayEnabled=selectedClaims.includes("doublePay"), reimbursementEnabled=selectedClaims.includes("reimbursement"), annualLeaveEnabled=selectedClaims.includes("annualLeave"), overtimeEnabled=selectedClaims.includes("overtime"), compTimeEnabled=selectedClaims.includes("compTime");
  const inferredEmploymentMonth=setup.employmentDate.slice(0,7);
  const effectiveSocialStart=setup.socialPaidStartMonth || inferredEmploymentMonth;
  const effectiveFundStart=setup.fundPaidStartMonth || inferredEmploymentMonth;
  const effectiveDoubleRule = useMemo(() => doublePayEnabled ? automaticDoubleRuleFor(setup, doubleRule) : defaultRule, [setup, doubleRule, doublePayEnabled]);
  const doubleById = useMemo(() => new Map(rows.map(row => [row.id, doublePayForRow(row, effectiveDoubleRule)])), [rows, effectiveDoubleRule]);
  const totals = useMemo(() => rows.reduce((a, r) => ({
    normal: a.normal + Number(r.normalPay || 0), paid: a.paid + Number(r.paid || 0),
    arrears: a.arrears + Number(r.arrears || 0), social: a.social + socialDueFor(r),
    fund: a.fund + fundDueFor(r), double: a.double + Number(doubleById.get(r.id) || 0),
    socialActual:a.socialActual+Number(r.socialPaid||0), socialExpected:a.socialExpected+Number(r.socialBase||0)*Number(r.socialRate||0)/100,
    fundActual:a.fundActual+Number(r.fundPaid||0), fundExpected:a.fundExpected+Number(r.fundBase||0)*Number(r.fundRate||0)/100,
  }), {normal:0,paid:0,arrears:0,social:0,fund:0,double:0,socialActual:0,socialExpected:0,fundActual:0,fundExpected:0}), [rows, doubleById]);
  const reimbursementTotal = reimbursementEnabled&&setup.reimbursementIncluded ? Number(setup.reimbursementAmount||0) : 0;
  const rowClaimTotal = (row: Row) => (wageEnabled ? Number(row.arrears || 0) : 0) + (socialEnabled ? socialDueFor(row) : 0) + (fundEnabled ? fundDueFor(row) : 0) + (doublePayEnabled ? Number(doubleById.get(row.id) || 0) : 0);
  const openRows = rows.filter(r => r.status === "未结清").length;
  const socialMonths = rows.filter(r => socialDueFor(r) > 0).length;
  const fundMonths = rows.filter(r => fundDueFor(r) > 0).length;
  const socialPaidMonths = rows.filter(r => Number(r.socialPaid || 0) > 0).length;
  const fundPaidMonths = rows.filter(r => Number(r.fundPaid || 0) > 0).length;
  const setupMonths = monthCountBetween(setup.employmentDate, setup.cutoffDate);
  const socialRates: SocialRates = {pension:Number(setup.socialPensionRate||0),unemployment:Number(setup.socialUnemploymentRate||0),injury:Number(setup.socialInjuryRate||0),maternity:Number(setup.socialMaternityRate||0),medical:Number(setup.socialMedicalRate||0)};
  const effectiveSocialRate = socialEnabled ? totalEmployerRate(socialRates) : 0;
  const effectiveSocialActualBase = socialEnabled&&setup.socialHasPaid ? Number(setup.socialActualBase||0) : 0;
  const setupSocialPaidMonths = socialEnabled&&setup.socialHasPaid&&effectiveSocialActualBase>0 ? paidMonthsWithin(setup.employmentDate,setup.cutoffDate,effectiveSocialStart,setup.socialPaidEndMonth) : 0;
  const setupFundPaidMonths = fundEnabled&&setup.fundHasPaid&&Number(setup.fundPaid||0)>0 ? paidMonthsWithin(setup.employmentDate,setup.cutoffDate,effectiveFundStart,setup.fundPaidEndMonth) : 0;
  const effectiveSocialBase = socialEnabled ? Number(setup.socialBase||setup.contractPay||0) : 0;
  const effectiveFundBase = fundEnabled ? Number(setup.fundBase||setup.contractPay||0) : 0;
  const inferredFundPaidRate = effectiveFundBase&&setup.fundHasPaid ? Number(setup.fundPaid||0)/effectiveFundBase*100 : 0;
  const effectiveFundRate = fundEnabled ? Math.max(inferredFundPaidRate,Number(setup.fundRate||5)) : 0;
  const setupSocialMonthly = socialContributionForMonth({expectedBase:effectiveSocialBase,actualBase:effectiveSocialActualBase,rates:socialRates});
  const setupSocialExpectedMonthly = setupSocialMonthly.expected;
  const setupSocialActualMonthly = setupSocialMonthly.actual;
  const setupFundExpectedMonthly = effectiveFundBase*effectiveFundRate/100;
  const setupSocialDue = setupSocialMonthly.gap*setupSocialPaidMonths + setupSocialExpectedMonthly*Math.max(0,setupMonths-setupSocialPaidMonths);
  const setupFundDue = Math.max(0,setupFundExpectedMonthly-Number(setup.fundPaid||0))*setupFundPaidMonths + setupFundExpectedMonthly*Math.max(0,setupMonths-setupFundPaidMonths);
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
  const grandTotal=(wageEnabled?totals.arrears:0)+(socialEnabled?totals.social:0)+(fundEnabled?totals.fund:0)+(doublePayEnabled?totals.double:0)+reimbursementTotal+annualLeaveTotal+overtimeTotal+compTimeTotal;
  const needsRestDayDistinctConfirmation=overtimeEnabled&&compTimeEnabled&&Number(setup.restDayOvertimeHours)>0&&Number(setup.outstandingCompTimeDays)>0;
  const visible = rows.filter(r => (filter === "全部" || r.status === filter) && `${r.payDate}${r.note}`.includes(query));
  const basicReady=Boolean(setup.employmentDate&&setup.cutoffDate&&Number(setup.contractPay)>0&&setup.employmentDate<=setup.cutoffDate);
  const questionsReady=Boolean(selectedClaims.length&&(!wageEnabled||setup.arrearsStartMonth)&&(!doublePayEnabled||setup.contractEnd)&&(!socialEnabled||(effectiveSocialRate>0&&(!setup.socialHasPaid||(effectiveSocialActualBase>0&&setup.socialPaidEndMonth))))&&(!fundEnabled||(Number(setup.fundRate)>0&&(!setup.fundHasPaid||(Number(setup.fundPaid)>0&&setup.fundPaidEndMonth))))&&(!reimbursementEnabled||Number(setup.reimbursementAmount)>0)&&(!annualLeaveEnabled||Number(setup.annualLeaveWorkYears)>=1)&&(!overtimeEnabled||(Number(setup.weekdayOvertimeHours)>0||Number(setup.restDayOvertimeHours)>0||Number(setup.holidayOvertimeHours)>0))&&(!compTimeEnabled||Number(setup.outstandingCompTimeDays)>0)&&(!needsRestDayDistinctConfirmation||setup.restDayClaimsDistinct));
  const exceptionRows=rows.filter(r=>rowClaimTotal(r)>0);
  const hasReimbursementException=reimbursementEnabled&&Number(setup.reimbursementAmount)>0;
  const hasAnnualLeaveException=annualLeaveEnabled&&annualLeaveTotal>0;
  const hasOvertimeException=overtimeEnabled&&overtimeTotal>0;
  const hasCompTimeException=compTimeEnabled&&compTimeTotal>0;
  const exceptionCount=exceptionRows.length+(hasReimbursementException?1:0)+(hasAnnualLeaveException?1:0)+(hasOvertimeException?1:0)+(hasCompTimeException?1:0);
  const reportMonth=setup.cutoffDate ? setup.cutoffDate.slice(0,7) : "—";
  const reportNumber=`WBC-${(setup.cutoffDate||todayInputValue()).slice(0,7).replace("-","")}-${String(Math.max(1,rows.length)).padStart(3,"0")}`;
  const toggleClaim=(claim:Claim)=>setSelectedClaims(current=>current.includes(claim)?current.filter(x=>x!==claim):[...current,claim]);
  const closeClaim=(claim:Claim)=>setSelectedClaims(current=>current.filter(item=>item!==claim));

  const update = (id: number, key: keyof Row, value: string) => setRows(prev => prev.map(r => r.id === id ? {
    ...r, [key]: key === "wageMonth" || key === "payDate" || key === "note" || key === "status" ? value : Number(value),
    ...(["duePay","normalPay","paid"].includes(String(key)) ? { arrears: Math.max(0, Number(key === "duePay" ? value : r.duePay) - Number(key === "normalPay" ? value : r.normalPay) - Number(key === "paid" ? value : r.paid)) } : {})
  } : r));

  const rowsWithComputedGaps = () => rows.map(r => ({...r, socialDue:socialDueFor(r), fundDue:fundDueFor(r)}));
  const save = () => { const persistedSetup={...setup,socialPaid:setupSocialActualMonthly,socialRate:effectiveSocialRate}; localStorage.setItem("xinbao-rows", JSON.stringify(rowsWithComputedGaps())); localStorage.setItem("xinbao-double-rule", JSON.stringify(effectiveDoubleRule)); localStorage.setItem("xinbao-meta", JSON.stringify({caseName,setup:persistedSetup,selectedClaims,flowStep})); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  const printReport = () => window.print();
  const addRow = () => setRows(prev => [...prev, { ...(prev[prev.length - 1] || blankRow()), id: Date.now(), wageMonth:"", payDate:"", normalPay:0, note:"新增欠薪月份", paid:0, status:"未结清", duePay:Number(setup.contractPay || 0), arrears:Number(setup.contractPay || 0), contractPay:Number(setup.contractPay || 0), socialPaid:0, socialBase:effectiveSocialBase, socialRate:effectiveSocialRate, fundPaid:0, fundBase:effectiveFundBase, fundRate:effectiveFundRate }]);
  const remove = (id: number) => setRows(prev => prev.filter(r => r.id !== id));
  const exportCsv = () => {
    const header = [...fields.map(f => `${f.group ? f.group + "-" : ""}${f.label}`), "未续签双倍工资差额", "合计欠款"];
    const body = rows.map(r => [...fields.map(f => String(f.key === "socialDue" ? socialDueFor(r) : f.key === "fundDue" ? fundDueFor(r) : r[f.key])), String(doublePayEnabled ? doubleById.get(r.id) || 0 : 0), String(rowClaimTotal(r))]);
    const csv = "\ufeff" + [header, ...body].map(line => line.map(v => `"${v.replaceAll('"','""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"})); a.download = "薪资计算器明细.csv"; a.click();
  };
  const exportData = () => {
    const data = JSON.stringify({ version:8, caseName, setup:{...setup,socialPaid:setupSocialActualMonthly,socialRate:effectiveSocialRate}, selectedClaims, flowStep, doubleRule:effectiveDoubleRule, rows:rowsWithComputedGaps() }, null, 2);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], {type:"application/json"})); a.download = `${caseName || "欠款测算"}.json`; a.click();
  };
  const importData = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const data = JSON.parse(String(reader.result)); if (!Array.isArray(data.rows)) throw new Error(); const importedRule={...defaultRule,...data.doubleRule}; setRows(data.rows.map((row:Row,index:number)=>normalizeRow(row,index))); setDoubleRule(importedRule); setSetup(normalizeSetup({...data.setup,contractEnd:data.setup?.contractEnd||importedRule.contractEnd,cutoffDate:data.setup?.cutoffDate||importedRule.continuedUntil})); setSelectedClaims(Array.isArray(data.selectedClaims)?data.selectedClaims:["wage","social","fund","doublePay"]); setFlowStep("results"); setCaseName(data.caseName || "导入的欠款测算"); } catch { alert("文件无法识别，请选择由本计算器导出的 JSON 文件。"); } };
    reader.readAsText(file);
  };
  const generateRows = () => {
    if (!setup.employmentDate || !setup.cutoffDate) return alert("请先填写入职日期和统计截止日期。");
    const startDate=atMidnight(setup.employmentDate), endDate=atMidnight(setup.cutoffDate);
    if (!startDate || !endDate) return alert("日期格式无法识别，请重新选择。");
    const sy=startDate.getFullYear(), sm=startDate.getMonth()+1, count=monthCountBetween(setup.employmentDate,setup.cutoffDate);
    if (count < 1 || count > 60) return alert("测算期间需为 1—60 个月。");
    if (!selectedClaims.length) return alert("请至少选择一项需要测算的事项。");
    if (doublePayEnabled && !setup.contractEnd) return alert("请填写劳动合同期满日。");
    if (setup.employmentDate && setup.contractEnd && setup.employmentDate > setup.contractEnd) return alert("合同期满日不能早于入职日期。");
    const firstMonth=`${sy}-${String(sm).padStart(2,"0")}`, lastMonth=`${endDate.getFullYear()}-${String(endDate.getMonth()+1).padStart(2,"0")}`;
    if (wageEnabled && !setup.arrearsStartMonth) return alert("请填写开始欠薪月份。");
    if (wageEnabled && setup.arrearsStartMonth && (setup.arrearsStartMonth < firstMonth || setup.arrearsStartMonth > lastMonth)) return alert("开始欠薪月份需位于入职月份和统计截止月份之间。");
    if (reimbursementEnabled && Number(setup.reimbursementAmount||0)<=0) return alert("请填写尚未支付的报销金额。");
    if (annualLeaveEnabled && Number(setup.annualLeaveWorkYears||0)<1) return alert("累计工作满 1 年后才享受法定年休假，请核对累计工作年限。");
    if (overtimeEnabled && Number(setup.weekdayOvertimeHours||0)<=0 && Number(setup.restDayOvertimeHours||0)<=0 && Number(setup.holidayOvertimeHours||0)<=0) return alert("请至少填写一类尚未支付的加班时数。");
    if (compTimeEnabled && Number(setup.outstandingCompTimeDays||0)<=0) return alert("请填写休息日加班尚未补休的天数。");
    if (needsRestDayDistinctConfirmation && !setup.restDayClaimsDistinct) return alert("请确认加班工资与调休折现不是同一批休息日加班，避免重复计算。");
    if (socialEnabled && effectiveSocialRate<=0) return alert("请至少填写一项五险公司费率。");
    if (fundEnabled && Number(setup.fundRate||0)<=0) return alert("请填写当地最低公积金单位比例。");
    const paidPeriods = [
      {enabled:socialEnabled&&setup.socialHasPaid,label:"社保",amount:effectiveSocialActualBase,start:effectiveSocialStart,end:setup.socialPaidEndMonth},
      {enabled:fundEnabled&&setup.fundHasPaid,label:"公积金",amount:Number(setup.fundPaid||0),start:effectiveFundStart,end:setup.fundPaidEndMonth},
    ];
    for (const period of paidPeriods) {
      if (!period.enabled) continue;
      if ((period.start && !period.end) || (!period.start && period.end) || (period.amount > 0 && (!period.start || !period.end))) return alert(`请完整填写${period.label}公司实际缴纳的开始月份和截止月份。`);
      if (period.start && (period.start > period.end || period.start < firstMonth || period.end > lastMonth)) return alert(`${period.label}公司实际缴纳期间需位于入职月份和统计截止月份之间。`);
    }
    const firstPaidRate=Math.min(100,Math.max(0,Number(setup.firstArrearsPaidRate||0)));
    const generated = Array.from({length:count}, (_,i) => {
      const date = new Date(sy, sm - 1 + i, 1), wageMonth = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
      const due = Number(setup.contractPay || 0), beforeArrears=!wageEnabled || wageMonth < setup.arrearsStartMonth, firstArrears=wageEnabled&&wageMonth === setup.arrearsStartMonth;
      const actual = beforeArrears ? due : firstArrears ? due*firstPaidRate/100 : 0;
      const arrears=Math.max(0,due-actual);
      const socialPaid=socialEnabled&&setup.socialHasPaid&&monthIsWithin(wageMonth,effectiveSocialStart,setup.socialPaidEndMonth)?setupSocialActualMonthly:0, socialBase=effectiveSocialBase, socialRate=effectiveSocialRate;
      const fundPaid=fundEnabled&&setup.fundHasPaid&&monthIsWithin(wageMonth,effectiveFundStart,setup.fundPaidEndMonth)?Number(setup.fundPaid||0):0, fundBase=effectiveFundBase, fundRate=effectiveFundRate;
      const socialDue=Math.max(0,socialBase*socialRate/100-socialPaid), fundDue=Math.max(0,fundBase*fundRate/100-fundPaid);
      const note=beforeArrears ? `${date.getMonth()+1}月工资已正常发放` : firstArrears ? `首个欠薪月，已发${firstPaidRate}%` : `${date.getMonth()+1}月工资默认未发`;
      return { id:Date.now()+i, wageMonth, payDate:"", normalPay:actual, note, paid:0, status:arrears>0||socialDue>0||fundDue>0?"未结清":"已结清", duePay:due, arrears, contractPay:Number(setup.contractPay||0), socialPaid, socialBase, socialRate, socialDue, fundPaid, fundBase, fundRate, fundDue } as Row;
    });
    if (rows.some(r => r.wageMonth || r.duePay || r.normalPay) && !confirm("批量生成会替换当前明细，是否继续？")) return;
    setRows(generated);
    setFlowStep("results");
    setPrecisionOpen(false);
  };
  const newCase = () => { if (!confirm("新建测算会清空当前页面数据，建议先导出备份。是否继续？")) return; setRows([blankRow()]); setDoubleRule(defaultRule); setSetup({...defaultSetup,cutoffDate:todayInputValue()}); setSelectedClaims([]); setFlowStep("basic"); setPrecisionOpen(false); setCaseName("我的欠款测算"); localStorage.removeItem("xinbao-rows"); localStorage.removeItem("xinbao-double-rule"); localStorage.removeItem("xinbao-meta"); };

  return <main className="app-shell">
    <a className="skip-link" href="#calculator">跳到测算表单</a>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">薪</span><div><strong>薪资计算器</strong><small>免登录 · 本地保存 · 开箱即用</small></div></div>
      <div className="top-actions"><span className="safe">● 数据仅保存在本机</span><button className="ghost" onClick={newCase}>新建</button><button className="ghost" onClick={()=>importInput.current?.click()}>导入</button><button className="ghost" onClick={exportData}>备份</button><button className="ghost" onClick={exportCsv}>CSV</button>{flowStep==="results"&&<button className="ghost report-export" onClick={printReport}>导出报告</button>}<button className="primary" onClick={save}>{saved ? "已保存 ✓" : "保存"}</button><input ref={importInput} className="file-input" type="file" accept="application/json,.json" onChange={e=>{importData(e.target.files?.[0]);e.target.value=""}}/></div>
    </header>

    <section className="hero">
      <div><p className="eyebrow">WAGE & BENEFITS CALCULATOR / 薪资计算器</p><h1>工资与劳动权益，<br/><em>一表算清。</em></h1><p className="intro">无需注册登录。填写任职期间和实际发生事项，即可计算欠薪、社保、公积金、年假、加班、调休、未续签双倍工资及报销欠款，并导出测算报告。</p></div>
      <div className="grand-card">{flowStep === "results" ? <><span>当前合计欠款</span><strong><small>¥</small>{money(grandTotal)}</strong><div><b>{openRows} 个未结清月份</b><i>测算至 {rows.at(-1)?.wageMonth || "—"}</i></div></> : <><span>GUIDED MODE / 默认引导模式</span><strong>约 2 分钟</strong><div><b>只问与你有关的问题</b><i>无需登录</i></div></>}</div>
    </section>

    <section className="quick-card guided-card" id="calculator">
      <div className="guided-head">
        <div><p className="eyebrow">GUIDED CALCULATOR / 引导测算</p><h2>{flowStep==="basic"?"先填写三个基础事实":flowStep==="scenario"?"选择要计算的事项":flowStep==="questions"?"只回答与你有关的问题":flowStep==="review"?"核对事实与系统推定":"测算结果已生成"}</h2></div>
        <div className="stepper" aria-label="测算进度">{["basic","scenario","questions","review","results"].map((step,index)=><span key={step} className={flowStep===step?"active":(["basic","scenario","questions","review","results"].indexOf(flowStep)>index?"done":"")}>{index+1}</span>)}</div>
      </div>

      {flowStep==="basic"&&<div className="guided-step">
        <p className="step-intro">不需要先理解专业公式。告诉我们任职期间和月薪，下一步再选择发生了什么。</p>
        <div className="basic-fields">
          <label><span>入职日期</span><input type="date" value={setup.employmentDate} onChange={e=>setSetup(s=>({...s,employmentDate:e.target.value,contractStart:s.contractStart||e.target.value}))}/></label>
          <label><span>统计截止日期</span><input type="date" value={setup.cutoffDate} onChange={e=>setSetup(s=>({...s,cutoffDate:e.target.value}))}/><small>默认今天，也可改为离职或测算日期</small></label>
          <label className="salary-field"><span>合同月薪</span><div className="money-input salary-input"><input type="number" min="0" value={setup.contractPay||""} placeholder="例如 20,000" onChange={e=>setSetup(s=>({...s,contractPay:Number(e.target.value)}))}/><span className="salary-unit">元/月</span></div><small>劳动合同约定的税前月工资</small></label>
        </div>
        {setup.employmentDate&&setup.cutoffDate&&setup.employmentDate>setup.cutoffDate&&<p className="inline-error" role="alert">统计截止日期不能早于入职日期。</p>}
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
          {wageEnabled&&<article className="question-module"><header><b>欠</b><div><strong>工资少发或未发</strong><small>开始欠薪前按足额发放，之后默认未发</small></div></header><div className="module-fields"><label><span>从哪个月开始欠薪？</span><input type="month" value={setup.arrearsStartMonth} onChange={e=>setSetup(s=>({...s,arrearsStartMonth:e.target.value}))}/></label><label><span>首个欠薪月实际发了多少？</span><div className="rate-choices wage-rate-choices">{[0,30,50,100].map(rate=><button key={rate} className={setup.firstArrearsPaidRate===rate?"active":""} onClick={()=>setSetup(s=>({...s,firstArrearsPaidRate:rate}))}>{rate}%</button>)}<div className="money-input custom-rate-input"><i>%</i><input aria-label="首个欠薪月自定义已发比例" type="number" min="0" max="100" value={setup.firstArrearsPaidRate||""} onChange={e=>setSetup(s=>({...s,firstArrearsPaidRate:Number(e.target.value)}))}/></div></div></label></div></article>}
          {annualLeaveEnabled&&<article className="question-module rights-module">
            <header><b>年</b><div><strong>未休年假折现</strong><small>离职当年自动折算，正常工资已支付时只计额外 200%</small></div><button className="question-close" type="button" aria-label="关闭未休年假折现" onClick={()=>closeClaim("annualLeave")}>关闭此项</button></header>
            <div className="module-fields rights-fields">
              <label><span>累计工作年限</span><input type="number" min="0" step="0.1" value={setup.annualLeaveWorkYears||""} onChange={e=>setSetup(s=>({...s,annualLeaveWorkYears:Number(e.target.value)}))}/><small>包含在其他单位的累计工作时间</small></label>
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
              <label><span>工作日延时加班</span><div className="money-input unit-input"><input type="number" min="0" step="0.5" value={setup.weekdayOvertimeHours||""} onChange={e=>setSetup(s=>({...s,weekdayOvertimeHours:Number(e.target.value)}))}/><span>小时</span></div><small>按小时工资 × 150%</small></label>
              <label><span>休息日加班尚未补休</span><div className="money-input unit-input"><input type="number" min="0" step="0.5" value={setup.restDayOvertimeHours||""} onChange={e=>setSetup(s=>({...s,restDayOvertimeHours:Number(e.target.value)}))}/><span>小时</span></div><small>按小时工资 × 200%</small></label>
              <label><span>法定节假日加班</span><div className="money-input unit-input"><input type="number" min="0" step="0.5" value={setup.holidayOvertimeHours||""} onChange={e=>setSetup(s=>({...s,holidayOvertimeHours:Number(e.target.value)}))}/><span>小时</span></div><small>按小时工资 × 300%，不能用补休替代</small></label>
              <div className="rights-summary"><div><span>小时工资</span><strong>¥ {money(overtimeBreakdown.hourly)}</strong></div><div><span>工作日</span><strong>¥ {money(overtimeBreakdown.weekday)}</strong></div><div><span>休息日</span><strong>¥ {money(overtimeBreakdown.restDay)}</strong></div><div><span>法定节假日</span><strong>¥ {money(overtimeBreakdown.holiday)}</strong></div></div>
              <p className="rights-evidence">建议准备：考勤、排班、审批、工作成果、聊天记录及工资流水。实行综合计算工时或不定时工时的，计算口径可能不同。</p>
            </div>
          </article>}
          {compTimeEnabled&&<article className="question-module rights-module">
            <header><b>休</b><div><strong>调休尚未兑现</strong><small>仅计算休息日加班后仍未安排补休的部分</small></div><button className="question-close" type="button" aria-label="关闭调休尚未兑现" onClick={()=>closeClaim("compTime")}>关闭此项</button></header>
            <div className="module-fields rights-fields">
              <label><span>尚未补休的休息日加班</span><div className="money-input unit-input"><input type="number" min="0" step="0.5" value={setup.outstandingCompTimeDays||""} onChange={e=>setSetup(s=>({...s,outstandingCompTimeDays:Number(e.target.value)}))}/><span>天</span></div><small>按日工资 × 200% 测算</small></label>
              <label><span>调休折现月工资基数</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.compTimeWageBase||""} placeholder={`默认按合同月薪 ${setup.contractPay||0}`} onChange={e=>setSetup(s=>({...s,compTimeWageBase:Number(e.target.value)}))}/></div></label>
              <div className="legal-warning strong-warning">不得与“休息日加班工资”重复填写同一批加班；工作日延时和法定节假日加班也不能用调休替代。</div>
              {needsRestDayDistinctConfirmation&&<label className="check-line"><input type="checkbox" checked={setup.restDayClaimsDistinct} onChange={e=>setSetup(s=>({...s,restDayClaimsDistinct:e.target.checked}))}/><span>我确认两处填写的<strong>不是同一批休息日加班</strong></span></label>}
              <div className="rights-summary compact-summary"><div><span>日工资</span><strong>¥ {money(dailyWage(effectiveCompTimeBase))}</strong></div><div><span>尚未补休</span><strong>{percent(Number(setup.outstandingCompTimeDays||0))} 天</strong></div><div><span>折现金额</span><strong>¥ {money(compTimeTotal)}</strong></div></div>
            </div>
          </article>}
          {doublePayEnabled&&<article className="question-module"><header><b>2×</b><div><strong>合同到期后仍继续工作</strong><small>双倍工资只需要合同期满日，统计截止日已在第一步填写</small></div></header><div className="module-fields"><label><span>合同上写的最后一天</span><input type="date" value={setup.contractEnd} onChange={e=>setSetup(s=>({...s,contractEnd:e.target.value}))}/><small>也就是劳动合同期满日；不需要填写合同开始日</small></label></div></article>}
          {socialEnabled&&<article className="question-module">
            <header><b>社</b><div><strong>社保公司部分</strong><small>填写公司实际申报基数，系统按五险费率自动算出实缴和漏缴</small></div></header>
            <div className="has-paid"><span>公司实际缴纳过社保吗？</span><button className={!setup.socialHasPaid?"active":""} onClick={()=>setSetup(s=>({...s,socialHasPaid:false,socialPaid:0,socialActualBase:0,socialPaidEndMonth:""}))}>没有</button><button className={setup.socialHasPaid?"active":""} onClick={()=>setSetup(s=>({...s,socialHasPaid:true}))}>缴纳过</button></div>
            <div className="module-fields">
              <label><span>公司实际申报缴费基数</span><div className="money-input"><i>¥</i><input type="number" min="0" disabled={!setup.socialHasPaid} value={setup.socialActualBase||""} placeholder={setup.socialHasPaid?"例如 4,986":"未缴为 0"} onChange={e=>setSetup(s=>({...s,socialActualBase:Number(e.target.value)}))}/></div><small>可在社保缴费记录中查看“缴费工资”或“申报基数”</small></label>
              {setup.socialHasPaid&&<><label><span>最后缴到哪个月？</span><input type="month" value={setup.socialPaidEndMonth} onChange={e=>setSetup(s=>({...s,socialPaidEndMonth:e.target.value}))}/></label><label className="inferred"><span>从哪个月开始缴？ <em>系统推定</em></span><input type="month" value={effectiveSocialStart} onChange={e=>setSetup(s=>({...s,socialPaidStartMonth:e.target.value}))}/><small>根据入职月份推定，可修改</small></label></>}
              <div className="social-rates"><div className="social-rates-head"><span>五险公司费率（均可修改）</span><strong>合计 {percent(effectiveSocialRate)}%</strong></div><div className="social-rate-grid">{([
                ["养老保险","socialPensionRate"],["失业保险","socialUnemploymentRate"],["工伤保险","socialInjuryRate"],["生育保险","socialMaternityRate"],["医疗保险","socialMedicalRate"],
              ] as const).map(([label,key])=><label key={key}><span>{label}</span><div className="money-input compact"><i>%</i><input aria-label={`${label}公司费率`} type="number" min="0" max="100" step="0.1" value={setup[key] ?? ""} onChange={e=>setSetup(s=>({...s,[key]:Number(e.target.value)}))}/></div></label>)}</div><div className="rate-guide social-guide"><b>当前使用你提供截图中的参考比例</b><span>各地、年度和行业费率可能不同；医疗与生育合并征收的地区请按当地口径填写，避免重复计算。</span></div></div>
              <div className="rate-formula social-formula"><div><small>公司实际缴纳 = 实际申报基数 × 五险公司费率合计</small><strong>¥ {money(setupSocialActualMonthly)}</strong><span>¥ {money(effectiveSocialActualBase)} × {percent(effectiveSocialRate)}%</span></div><i>对比</i><div><small>应缴金额 = 应缴测算基数 × 五险公司费率合计</small><strong>¥ {money(setupSocialExpectedMonthly)}</strong><span>¥ {money(effectiveSocialBase)} × {percent(effectiveSocialRate)}%</span></div><i>差额</i><div className="applied"><small>每月少缴</small><strong>¥ {money(setupSocialMonthly.gap)}</strong><span>{setup.socialHasPaid?"已自动抵扣实际缴纳":"未缴月份按全额计算"}</span></div></div>
            </div>
            <details className="advanced-base"><summary>修改应缴测算基数</summary><label className="inferred"><span>依法应缴测算基数 <em>{setup.socialBase?"已修改":"合同月薪"}</em></span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.socialBase||""} placeholder={`默认按合同月薪 ${setup.contractPay||0}`} onChange={e=>setSetup(s=>({...s,socialBase:Number(e.target.value)}))}/></div><small>默认以合同月薪测算公司本应申报的基数；可按当地上下限或经办机构核定结果修改</small></label></details>
          </article>}
          {fundEnabled&&<article className="question-module">
            <header><b>积</b><div><strong>公积金公司部分</strong><small>只填实际金额，系统自动反推比例并按最低比例兜底</small></div></header>
            <div className="has-paid"><span>公司实际缴纳过公积金吗？</span><button className={!setup.fundHasPaid?"active":""} onClick={()=>setSetup(s=>({...s,fundHasPaid:false,fundPaid:0,fundPaidEndMonth:""}))}>没有</button><button className={setup.fundHasPaid?"active":""} onClick={()=>setSetup(s=>({...s,fundHasPaid:true}))}>缴纳过</button></div>
            <div className="module-fields">
              <label><span>公司实际每月缴纳金额</span><div className="money-input"><i>¥</i><input type="number" min="0" disabled={!setup.fundHasPaid} value={setup.fundPaid||""} placeholder={setup.fundHasPaid?"填写单位缴存金额":"未缴为 0"} onChange={e=>setSetup(s=>({...s,fundPaid:Number(e.target.value)}))}/></div><small>只填单位部分，不含个人缴存</small></label>
              {setup.fundHasPaid&&<><label><span>最后缴到哪个月？</span><input type="month" value={setup.fundPaidEndMonth} onChange={e=>setSetup(s=>({...s,fundPaidEndMonth:e.target.value}))}/></label><label className="inferred"><span>从哪个月开始缴？ <em>系统推定</em></span><input type="month" value={effectiveFundStart} onChange={e=>setSetup(s=>({...s,fundPaidStartMonth:e.target.value}))}/><small>根据入职月份推定，可修改</small></label></>}
              <label className="rate-field"><span>当地最低单位比例（可修改）</span><div className="rate-presets">{[5,7,10,12].map(rate=><button key={rate} className={setup.fundRate===rate?"active":""} onClick={()=>setSetup(s=>({...s,fundRate:rate}))}>{rate}%</button>)}</div><div className="money-input compact"><i>%</i><input type="number" min="0.01" max="100" step="0.1" value={setup.fundRate||""} onChange={e=>setSetup(s=>({...s,fundRate:Number(e.target.value)}))}/></div><div className="rate-guide"><b>单位缴存比例法定范围 5%–12%（普通情形）</b><span>默认最低 5%；如当地现行规则或获批情形不同，可手工修改。</span></div></label>
              <div className="rate-formula"><div><small>实际缴纳金额 ÷ 测算基数</small><strong>{percent(inferredFundPaidRate)}%</strong><span>反推实缴比例</span></div><i>与</i><div><small>当地最低比例</small><strong>{percent(Number(setup.fundRate||5))}%</strong><span>可手工修改</span></div><i>取高</i><div className="applied"><small>系统采用比例</small><strong>{percent(effectiveFundRate)}%</strong><span>{effectiveFundRate>inferredFundPaidRate?"已按最低比例兜底":"按实缴比例计算"}</span></div></div>
            </div>
            <details className="advanced-base"><summary>修改测算基数</summary><label className="inferred"><span>公积金测算基数 <em>{setup.fundBase?"已修改":"合同月薪"}</em></span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.fundBase||""} placeholder={`默认按合同月薪 ${setup.contractPay||0}`} onChange={e=>setSetup(s=>({...s,fundBase:Number(e.target.value)}))}/></div><small>未填写公司缴纳基数时，一律以合同月薪作为缺省测算基数；可在此修改，最终以缴存地核定为准</small></label></details>
          </article>}
          {reimbursementEnabled&&<article className="question-module reimbursement-module">
            <header><b>报</b><div><strong>报销费用未支付</strong><small>填写公司尚未支付的报销金额，可选择是否进入本次合计</small></div></header>
            <div className="module-fields reimbursement-fields">
              <label><span>尚未支付的报销金额</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.reimbursementAmount||""} placeholder="例如 3,680" onChange={e=>setSetup(s=>({...s,reimbursementAmount:Number(e.target.value)}))}/></div><small>填写你已经垫付、但公司尚未支付的金额</small></label>
              <label><span>报销事项说明（可选）</span><input value={setup.reimbursementNote} placeholder="例如：差旅、交通及客户招待费" onChange={e=>setSetup(s=>({...s,reimbursementNote:e.target.value}))}/><small>将显示在导出的测算报告中</small></label>
              <div className="reimbursement-policy" role="group" aria-label="报销金额计入口径"><span>这笔报销如何处理？</span><button className={setup.reimbursementIncluded?"active":""} aria-pressed={setup.reimbursementIncluded} onClick={()=>setSetup(s=>({...s,reimbursementIncluded:true}))}>计入本次合计</button><button className={!setup.reimbursementIncluded?"active":""} aria-pressed={!setup.reimbursementIncluded} onClick={()=>setSetup(s=>({...s,reimbursementIncluded:false}))}>仅在报告中记录</button></div>
            </div>
          </article>}
        </div>
        <div className="guided-actions"><button className="back" onClick={()=>setFlowStep("scenario")}>← 返回</button><button className="next" disabled={!questionsReady} onClick={()=>setFlowStep("review")}>下一步：核对推定 →</button></div>
      </div>}

      {flowStep==="review"&&<div className="guided-step review-step">
        <div className="review-grid"><article><span>你填写的事实</span><strong>{setup.employmentDate} 入职 · 月薪 ¥ {money(setup.contractPay)}</strong><p>统计至 {setup.cutoffDate}，共 {setupMonths} 个自然月</p></article><article><span>本次测算事项</span><strong>{claimOptions.filter(x=>selectedClaims.includes(x.key)).map(x=>x.title).join("、")}</strong><p>未选择的事项不会进入合计</p></article><article className="assumptions"><span>系统推定与计算依据</span><strong>{doublePayEnabled?`合同期满日 ${setup.contractEnd}`:"按本次所选事项计算"}</strong><p>{socialEnabled?`社保应缴基数 ¥ ${money(effectiveSocialBase)}，实缴基数 ¥ ${money(effectiveSocialActualBase)}，五险合计 ${percent(effectiveSocialRate)}%；`:""}{fundEnabled?`公积金 ¥ ${money(effectiveFundBase)} × ${percent(effectiveFundRate)}%；`:""}{annualLeaveEnabled?`年假 ${annualLeaveUnusedDays} 天 × 日工资 × 200%；`:""}{overtimeEnabled?`加班按 150% / 200% / 300%；`:""}{compTimeEnabled?`未补休 ${percent(setup.outstandingCompTimeDays)} 天 × 200%；`:""}{reimbursementEnabled?`报销 ¥ ${money(Number(setup.reimbursementAmount||0))}（${setup.reimbursementIncluded?"计入合计":"仅记录"}）`:""}</p></article></div>
        {(socialEnabled||fundEnabled)&&<div className="policy-warning"><b>缺省测算口径</b><span>{socialEnabled?"社保应缴基数未修改时按合同月薪，实际缴纳金额由公司申报基数乘以五险公司费率合计得出；五险费率可逐项修改。":""}{socialEnabled&&fundEnabled?" ":""}{fundEnabled?"公积金仍采用实缴金额反推比例与当地最低比例取高。":""}实际基数与比例以参保地现行规定和经办机构核定为准。</span></div>}
        <label className="review-name"><span>测算名称（可选）</span><input value={caseName} onChange={e=>setCaseName(e.target.value)} /></label>
        <div className="guided-actions"><button className="back" onClick={()=>setFlowStep("questions")}>← 返回修改</button><button className="next generate-result" onClick={generateRows}>确认并生成结果 →</button></div>
      </div>}

      {flowStep==="results"&&<div className="guided-step result-ready"><div><span>已按 {rows.length} 个月生成测算</span><strong>当前合计 ¥ {money(grandTotal)}</strong><small>可返回引导修改条件，或展开精算明细逐月调整</small></div><button className="back" onClick={()=>setFlowStep("questions")}>修改测算条件</button></div>}
    </section>

    {flowStep === "results" && <>
    <section className="metrics guided-metrics" aria-label="测算汇总">
      {wageEnabled&&<article><span className="metric-icon wage">工</span><div><small>欠薪合计</small><strong>¥ {money(totals.arrears)}</strong><p>占总欠款 {grandTotal ? (totals.arrears / grandTotal * 100).toFixed(1) : 0}%</p></div></article>}
      {socialEnabled&&<article><span className="metric-icon social">社</span><div><small>社保公司尚欠补缴</small><strong>¥ {money(totals.social)}</strong><p>实缴 {socialPaidMonths} 个月 · 尚欠 {socialMonths} 个月<br/>已缴 ¥ {money(totals.socialActual)} · 应缴 ¥ {money(totals.socialExpected)}</p></div></article>}
      {fundEnabled&&<article><span className="metric-icon fund">积</span><div><small>公积金公司尚欠补缴</small><strong>¥ {money(totals.fund)}</strong><p>实缴 {fundPaidMonths} 个月 · 尚欠 {fundMonths} 个月<br/>已缴 ¥ {money(totals.fundActual)} · 应缴 ¥ {money(totals.fundExpected)}</p></div></article>}
      {doublePayEnabled&&<article><span className="metric-icon double">2×</span><div><small>未续签双倍工资差额</small><strong>¥ {money(totals.double)}</strong><p>{effectiveDoubleRule.enabled ? "已自动启用 · 最多支持 11 个月" : "尚未满足超期 1 个月"}</p></div></article>}
      {reimbursementEnabled&&<article><span className="metric-icon reimbursement">报</span><div><small>尚未支付的报销</small><strong>¥ {money(Number(setup.reimbursementAmount||0))}</strong><p>{setup.reimbursementIncluded?"已计入当前合计":"仅在报告中记录，未计入合计"}{setup.reimbursementNote&&<><br/>{setup.reimbursementNote}</>}</p></div></article>}
      {annualLeaveEnabled&&<article><span className="metric-icon annual">年</span><div><small>未休年假额外补偿</small><strong>¥ {money(annualLeaveTotal)}</strong><p>{annualLeaveUnusedDays} 天 · 日工资 ¥ {money(dailyWage(effectiveAnnualLeavePay))}<br/>{setup.annualLeaveWrittenWaiver?"已按书面主动放弃处理":"按额外 200% 计入"}</p></div></article>}
      {overtimeEnabled&&<article><span className="metric-icon overtime">加</span><div><small>加班工资</small><strong>¥ {money(overtimeTotal)}</strong><p>工作日 ¥ {money(overtimeBreakdown.weekday)} · 休息日 ¥ {money(overtimeBreakdown.restDay)}<br/>法定节假日 ¥ {money(overtimeBreakdown.holiday)}</p></div></article>}
      {compTimeEnabled&&<article><span className="metric-icon comptime">休</span><div><small>休息日加班未补休</small><strong>¥ {money(compTimeTotal)}</strong><p>{percent(setup.outstandingCompTimeDays)} 天 · 按日工资 200% 测算</p></div></article>}
      {wageEnabled&&<article className="settled"><span className="metric-icon paid">✓</span><div><small>后续补发工资</small><strong>¥ {money(totals.paid)}</strong></div></article>}
    </section>

    {doublePayEnabled&&<section className={`rule-card ${effectiveDoubleRule.enabled ? "enabled" : ""}`}>
      <div className="rule-title"><span className="rule-badge">2×</span><div><p className="eyebrow">DOUBLE PAY RULE / 未续签双倍工资</p><h2>合同期限与超期用工自动判定</h2></div><div className={`auto-rule ${effectiveDoubleRule.enabled ? "on" : ""}`}><b>{effectiveDoubleRule.enabled ? "已自动启用" : "等待满足条件"}</b><small>无需手动开关</small></div></div>
      <div className="rule-fields">
        <label><span>劳动合同期满日</span><div className="rule-date-value">{setup.contractEnd || "未填写"}</div><small>即合同上写的最后一天，可返回引导问题修改</small></label>
        <span className="rule-arrow">→</span>
        <label><span>超期持续用工截止日</span><div className="rule-date-value">{setup.cutoffDate || "未填写"}</div><small>系统以统计截止日期作为持续用工截止日</small></label>
        <div className="rule-result"><span>规则测算结果</span><strong>¥ {money(totals.double)}</strong><small>{(() => { const end = atMidnight(effectiveDoubleRule.contractEnd); const until = atMidnight(effectiveDoubleRule.continuedUntil); if (!end || !until) return "请先填写合同期满日和统计截止日期"; const start = addDays(end,1); if (!effectiveDoubleRule.enabled) return `持续用工尚未满 1 个月，满月判定日为 ${dateLabel(addDays(addMonths(start,1),-1))}`; return `已从 ${dateLabel(start)} 起计入，最迟至 ${dateLabel(addDays(addMonths(start,11),-1))}`; })()}</small></div>
      </div>
      <p className="rule-note"><b>自动规则：</b>统计截止日显示劳动关系在合同期满后仍持续存在，且从期满次日起达到 1 个月时，系统自动开启双倍工资，并追溯至期满次日计算额外一倍；不足整月按该月工作日比例折算，累计最多 11 个月。工资基数取明细中的“合同月薪”。</p>
    </section>}

    <section className="exceptions-card" aria-label="异常月份摘要">
      <div className="exceptions-head"><div><p className="eyebrow">EXCEPTION SUMMARY / 异常项目</p><h2>{exceptionCount} 项需要重点核对</h2></div><strong>¥ {money(grandTotal)}</strong></div>
      {exceptionCount ? <div className="exception-list">{exceptionRows.slice(0,8).map(row=><div className="exception-row" key={row.id}><b>{row.wageMonth || row.payDate || "未命名月份"}</b><span>{wageEnabled&&Number(row.arrears||0)>0&&<i>欠薪</i>}{socialEnabled&&socialDueFor(row)>0&&<i>社保</i>}{fundEnabled&&fundDueFor(row)>0&&<i>公积金</i>}{doublePayEnabled&&Number(doubleById.get(row.id)||0)>0&&<i>双倍工资</i>}</span><strong>¥ {money(rowClaimTotal(row))}</strong></div>)}
        {hasAnnualLeaveException&&<div className="exception-row"><b>未休年假</b><span><i>年假</i></span><strong>¥ {money(annualLeaveTotal)}</strong></div>}
        {hasOvertimeException&&<div className="exception-row"><b>加班工资</b><span><i>加班</i></span><strong>¥ {money(overtimeTotal)}</strong></div>}
        {hasCompTimeException&&<div className="exception-row"><b>调休未兑现</b><span><i>未补休</i></span><strong>¥ {money(compTimeTotal)}</strong></div>}
        {hasReimbursementException&&<div className="exception-row reimbursement-exception"><b>报销费用</b><span><i>报销</i><em>{setup.reimbursementIncluded?"计入合计":"仅记录"}</em></span><strong>¥ {money(Number(setup.reimbursementAmount||0))}</strong></div>}</div> : <p className="empty-exceptions">当前条件下没有测算出欠款，请返回检查填写内容。</p>}
      {exceptionRows.length>8&&<p className="more-exceptions">另有 {exceptionRows.length-8} 个月，可在精算明细中查看。</p>}
    </section>

    <section className="precision-card">
      <div><div><p className="eyebrow">PRECISION LEDGER / 精算底稿</p><h2>需要逐月复核时再展开</h2></div><button className="back" onClick={()=>setPrecisionOpen(open=>!open)}>{precisionOpen?"收起精算明细":"查看精算明细"}</button></div>
      <p>精算明细仅用于复核、修正特殊月份和导出底稿；日常测算不需要逐格填写。</p>
    </section>

    {precisionOpen&&<section className="sheet">
      <div className="sheet-head"><div><p className="eyebrow">MONTHLY LEDGER / 月度台账</p><h2>欠薪与补缴明细</h2></div><div className="tools"><label className="search">⌕<input aria-label="搜索月份或备注" placeholder="搜索月份或备注" value={query} onChange={e => setQuery(e.target.value)}/></label><div className="filters">{(["全部","未结清","已结清"] as const).map(x => <button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</div><button className="add" onClick={addRow}>＋ 新增月份</button></div></div>
      <div className="table-wrap"><table><thead><tr>{fields.map((f,i) => <th key={`${f.key}-${i}`} style={{minWidth:f.width}}>{f.group && <span>{f.group}</span>}{f.label}</th>)}<th className="double-col"><span>未续签</span>双倍工资差额</th><th className="sticky-right">本月欠款</th><th className="sticky-right action-col"></th></tr></thead>
      <tbody>{visible.map(r => <tr key={r.id} className={r.status === "未结清" ? "open" : ""}>{fields.map((f,i) => <td key={`${String(f.key)}-${i}`}>
        {f.key === "status" ? <select aria-label={`${r.payDate}结清状态`} className={r.status === "未结清" ? "status open" : "status"} value={r.status} onChange={e=>update(r.id,f.key,e.target.value)}><option>已结清</option><option>未结清</option></select>
        : f.key === "socialDue" || f.key === "fundDue" ? <div className="calculated-cell"><b>¥ {money(f.key === "socialDue" ? socialDueFor(r) : fundDueFor(r))}</b><small>自动计算</small></div>
        : <input aria-label={`${r.payDate}${f.label}`} className={f.key === "wageMonth" || f.key === "note" || f.key === "payDate" ? "text" : "number"} type={f.key === "wageMonth" ? "month" : f.key === "note" || f.key === "payDate" ? "text" : "number"} step="0.001" value={r[f.key]} onChange={e=>update(r.id,f.key,e.target.value)}/>}</td>)}
        <td className={`double-value ${doublePayEnabled&&(doubleById.get(r.id) || 0) > 0 ? "active" : ""}`}>¥ {money(doublePayEnabled ? doubleById.get(r.id) || 0 : 0)}</td>
        <td className="row-total sticky-right">¥ {money(rowClaimTotal(r))}</td><td className="sticky-right action-col"><button aria-label={`删除${r.payDate}`} className="delete" onClick={()=>remove(r.id)}>×</button></td></tr>)}</tbody>
      <tfoot><tr>{fields.map((f,i) => <td key={`${String(f.key)}-total`}>{i === 0 ? "总计" : f.key === "normalPay" ? `¥ ${money(totals.normal)}` : f.key === "paid" ? `¥ ${money(totals.paid)}` : f.key === "arrears" ? `¥ ${money(totals.arrears)}` : f.key === "socialPaid" ? `¥ ${money(totals.socialActual)}` : f.key === "socialDue" ? `¥ ${money(totals.social)}` : f.key === "fundPaid" ? `¥ ${money(totals.fundActual)}` : f.key === "fundDue" ? `¥ ${money(totals.fund)}` : ""}</td>)}<td>¥ {money(totals.double)}</td><td className="sticky-right">¥ {money(grandTotal)}</td><td className="sticky-right action-col"></td></tr></tfoot></table></div>
      <div className="sheet-foot"><span>显示 {visible.length} / {rows.length} 条记录 · 修改后请保存</span><span><i></i> 可编辑单元格 <b>总计另包含已选的年假、加班、未补休及报销项目</b></span></div>
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
          <p className="report-deck">基于用户填报的任职、工资、缴费、休假、加班及报销信息，对当前尚欠项目进行结构化汇总。金额以人民币列示。</p>
        </section>

        <dl className="report-meta">
          <div><dt>测算月份</dt><dd>{reportMonth}</dd></div>
          <div><dt>测算期间</dt><dd>{rows.length} 个月</dd></div>
          <div><dt>入职日期</dt><dd>{setup.employmentDate||"—"}</dd></div>
          <div><dt>统计截止日期</dt><dd>{setup.cutoffDate||"—"}</dd></div>
        </dl>

        <section className="report-executive" aria-label="当前测算合计">
          <div><span>当前测算合计</span><p>{reimbursementEnabled?(setup.reimbursementIncluded?"已包含用户填报的报销金额":`未包含仅作记录的报销金额 ¥ ${money(Number(setup.reimbursementAmount||0))}`):"本次未选择报销事项"}</p></div>
          <strong><small>¥</small>{money(grandTotal)}</strong>
        </section>

        <section className="report-section report-composition">
          <header><span className="report-section-index">01</span><div><h2>欠款构成</h2><p>按本次选择的测算事项汇总</p></div></header>
          <table className="report-summary-table">
            <thead><tr><th>项目</th><th>计算口径</th><th>金额（人民币）</th></tr></thead>
            <tbody>
              {wageEnabled&&<tr><td>欠薪合计</td><td>{setup.arrearsStartMonth||"—"} 起</td><td>¥ {money(totals.arrears)}</td></tr>}
              {socialEnabled&&<tr><td>社保公司尚欠补缴</td><td>五险公司承担部分</td><td>¥ {money(totals.social)}</td></tr>}
              {fundEnabled&&<tr><td>公积金公司尚欠补缴</td><td>单位缴存部分</td><td>¥ {money(totals.fund)}</td></tr>}
              {doublePayEnabled&&<tr><td>未续签双倍工资差额</td><td>满足条件后最多 11 个月</td><td>¥ {money(totals.double)}</td></tr>}
              {annualLeaveEnabled&&<tr><td>未休年假额外补偿</td><td>{annualLeaveUnusedDays} 天 × 日工资 × 200%</td><td>¥ {money(annualLeaveTotal)}</td></tr>}
              {overtimeEnabled&&<tr><td>加班工资</td><td>工作日 150% / 休息日 200% / 法定节假日 300%</td><td>¥ {money(overtimeTotal)}</td></tr>}
              {compTimeEnabled&&<tr><td>休息日加班未补休</td><td>{percent(setup.outstandingCompTimeDays)} 天 × 日工资 × 200%</td><td>¥ {money(compTimeTotal)}</td></tr>}
              {reimbursementEnabled&&<tr><td>报销欠款</td><td>{setup.reimbursementIncluded?"计入本次合计":"仅作记录，不计入合计"}</td><td>¥ {money(Number(setup.reimbursementAmount||0))}</td></tr>}
              {wageEnabled&&totals.paid>0&&<tr className="report-supplement-row"><td>后续补发工资</td><td>参考信息，不重复计入</td><td>¥ {money(totals.paid)}</td></tr>}
            </tbody>
            <tfoot><tr><th colSpan={2}>当前测算合计</th><td>¥ {money(grandTotal)}</td></tr></tfoot>
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

        <section className="report-section report-methodology">
          <header><span className="report-section-index">04</span><div><h2>报告说明</h2><p>数据来源与使用范围</p></div></header>
          <dl><div><dt>数据来源</dt><dd>用户填报及本地测算明细</dd></div><div><dt>生成方式</dt><dd>系统自动测算</dd></div><div><dt>使用范围</dt><dd>复核、沟通与证据整理参考</dd></div></dl>
        </section>

        <p className="report-disclaimer">重要说明：本报告仅作为测算底稿，不构成法律意见或缴费核定结论。年假资格、加班工资基数、工时制度、仲裁时效及最终金额，均以有效证据、当地裁审口径、参保地现行政策及法定程序认定为准。</p>
        <footer className="report-footer"><span>{reportNumber}</span><span>薪资计算器 · 系统生成</span><span>第 1 页</span></footer>
      </article>
    </section>

    <footer><span>薪资计算器</span><p>测算结果仅供核对参考，工资、缴费、年假、加班、调休及例外情形请以有效证据和当地裁审口径为准。</p><button onClick={() => { if(confirm("加载示例会替换当前页面数据，是否继续？")) { setRows(exampleRows); setDoubleRule(defaultRule); setSetup({...defaultSetup,employmentDate:"2025-06-01",cutoffDate:"2026-07-10",contractStart:"2025-06-01",contractEnd:"2026-06-10",contractPay:20000,arrearsStartMonth:"2026-02",firstArrearsPaidRate:30,socialHasPaid:true,socialActualBase:4986,socialPaidStartMonth:"2025-06",socialPaidEndMonth:"2026-07",socialBase:20000,fundHasPaid:true,fundPaid:250,fundPaidStartMonth:"2025-06",fundPaidEndMonth:"2026-07",fundBase:20000,fundRate:11.756}); setSelectedClaims(["wage","social","fund","doublePay"]); setFlowStep("results"); setPrecisionOpen(false); setCaseName("示例：欠薪与补缴测算"); } }}>加载示例数据</button></footer>
  </main>;
}
