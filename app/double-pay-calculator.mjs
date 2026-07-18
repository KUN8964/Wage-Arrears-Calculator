import { parseIsoDateLocal } from "./date-utils.mjs";
import { roundMoney } from "./money-utils.mjs";

export const addCalendarDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const addCalendarMonths = (date, months) => {
  const targetMonth = date.getMonth() + months;
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  return new Date(date.getFullYear(), targetMonth, Math.min(date.getDate(), lastDay));
};

export const oneYearContractEndFor = startValue => {
  const start = parseIsoDateLocal(startValue);
  if (!start) return "";
  const anniversary = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  const end = addCalendarDays(anniversary, -1);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
};

const weekdayCount = (start, endExclusive) => {
  let count = 0;
  for (let day = new Date(start); day < endExclusive; day = addCalendarDays(day, 1)) {
    if (day.getDay() !== 0 && day.getDay() !== 6) count++;
  }
  return count;
};

export const doublePayForMonth = (row, rule) => {
  const contractEnd = parseIsoDateLocal(rule?.contractEnd);
  const continuedUntil = parseIsoDateLocal(rule?.continuedUntil);
  if (!rule?.enabled || !contractEnd || !continuedUntil || !/^\d{4}-\d{2}$/.test(row?.wageMonth)) return 0;
  const eligibleStart = addCalendarDays(contractEnd, 1);
  if (addCalendarDays(continuedUntil, 1) < addCalendarMonths(eligibleStart, 1)) return 0;
  const capExclusive = addCalendarMonths(eligibleStart, 11);
  const continuedEndExclusive = addCalendarDays(continuedUntil, 1);
  const workEndExclusive = continuedEndExclusive < capExclusive ? continuedEndExclusive : capExclusive;
  const [year, month] = row.wageMonth.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const overlapStart = monthStart > eligibleStart ? monthStart : eligibleStart;
  const overlapEnd = monthEnd < workEndExclusive ? monthEnd : workEndExclusive;
  if (overlapEnd <= overlapStart) return 0;
  const monthWorkdays = weekdayCount(monthStart, monthEnd);
  return monthWorkdays
    ? roundMoney(Number(row.contractPay || 0) * weekdayCount(overlapStart, overlapEnd) / monthWorkdays)
    : 0;
};

export const automaticDoubleRuleFor = (setup, fallback = {enabled:false,contractEnd:"",continuedUntil:""}) => {
  if (!setup?.contractEnd || !setup?.cutoffDate) return fallback;
  const contractEnd = parseIsoDateLocal(setup.contractEnd);
  const continuedUntil = parseIsoDateLocal(setup.cutoffDate);
  if (!contractEnd || !continuedUntil) return {enabled:false,contractEnd:"",continuedUntil:""};
  const eligibleStart = addCalendarDays(contractEnd, 1);
  return {
    contractEnd:setup.contractEnd,
    continuedUntil:setup.cutoffDate,
    enabled:addCalendarDays(continuedUntil, 1) >= addCalendarMonths(eligibleStart, 1),
  };
};
