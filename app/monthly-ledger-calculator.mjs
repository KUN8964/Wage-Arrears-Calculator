import { parseIsoDateLocal } from "./date-utils.mjs";
import { monthlyEmploymentSpan, proratedMonthlyWage } from "./monthly-wage-calculator.mjs";
import { roundMoney } from "./money-utils.mjs";
import { contributionGap, rowSettlementStatus, wageArrears } from "./row-calculator.mjs";

const monthCountBetween = (startValue, endValue) => {
  const start = parseIsoDateLocal(startValue), end = parseIsoDateLocal(endValue);
  if (!start || !end || end < start) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
};

const monthIsWithin = (month, startMonth, endMonth) => Boolean(month && startMonth && endMonth && month >= startMonth && month <= endMonth);

export const generateMonthlyLedger = ({
  employmentDate = "",
  cutoffDate = "",
  contractPay = 0,
  wageEnabled = false,
  arrearsStartMonth = "",
  firstArrearsPaidRate = 0,
  social = {enabled:false,hasPaid:false,startMonth:"",endMonth:"",actualMonthly:0,actualBase:0,personalActualMonthly:0,base:0,rate:0},
  fund = {enabled:false,hasPaid:false,startMonth:"",endMonth:"",actualMonthly:0,actualBase:0,personalActualMonthly:0,base:0,rate:0},
  idStart = Date.now(),
} = {}) => {
  const startDate = parseIsoDateLocal(employmentDate);
  const count = monthCountBetween(employmentDate, cutoffDate);
  if (!startDate || count < 1 || count > 60) return [];
  const firstPaidRate = Math.min(100, Math.max(0, Number(firstArrearsPaidRate || 0)));

  return Array.from({length:count}, (_, index) => {
    const date = new Date(startDate.getFullYear(), startDate.getMonth() + index, 1);
    const wageMonth = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
    const duePay = proratedMonthlyWage({monthlyWage:contractPay,wageMonth,employmentDate,cutoffDate});
    const beforeArrears = !wageEnabled || wageMonth < arrearsStartMonth;
    const firstArrears = wageEnabled && wageMonth === arrearsStartMonth;
    const normalPay = beforeArrears ? duePay : firstArrears ? roundMoney(duePay * firstPaidRate / 100) : 0;
    const arrears = wageArrears({duePay,normalPay,paid:0});
    const socialPaidPeriod = social.enabled && social.hasPaid && monthIsWithin(wageMonth,social.startMonth,social.endMonth);
    const fundPaidPeriod = fund.enabled && fund.hasPaid && monthIsWithin(wageMonth,fund.startMonth,fund.endMonth);
    const socialPaid = socialPaidPeriod ? roundMoney(social.actualMonthly) : 0;
    const fundPaid = fundPaidPeriod ? roundMoney(fund.actualMonthly) : 0;
    const socialActualBase = socialPaidPeriod ? roundMoney(social.actualBase) : 0;
    const socialPersonalPaid = socialPaidPeriod ? roundMoney(social.personalActualMonthly) : 0;
    const fundActualBase = fundPaidPeriod ? roundMoney(fund.actualBase) : 0;
    const fundPersonalPaid = fundPaidPeriod ? roundMoney(fund.personalActualMonthly) : 0;
    const socialDue = contributionGap({base:social.base,rate:social.rate,paid:socialPaid});
    const fundDue = contributionGap({base:fund.base,rate:fund.rate,paid:fundPaid});
    const {employedDays,calendarDays} = monthlyEmploymentSpan({wageMonth,employmentDate,cutoffDate});
    const prorated = employedDays > 0 && employedDays < calendarDays;
    const wageNote = beforeArrears ? `${date.getMonth()+1}月工资已正常发放` : firstArrears ? `首个欠薪月，已发${firstPaidRate}%` : `${date.getMonth()+1}月工资默认未发`;
    const note = prorated ? `${wageNote}；按在职 ${employedDays}/${calendarDays} 个自然日预填` : wageNote;
    const row = {
      id:idStart+index,wageMonth,payDate:"",normalPay,note,paid:0,status:"未结清",duePay,arrears,contractPay:roundMoney(contractPay),wageDeduction:0,
      socialPaid,socialBase:Number(social.base||0),socialActualBase,socialPersonalPaid,socialRate:Number(social.rate||0),socialDue,
      fundPaid,fundBase:Number(fund.base||0),fundActualBase,fundPersonalPaid,fundRate:Number(fund.rate||0),fundDue,
    };
    return {...row,status:rowSettlementStatus(row)};
  });
};
