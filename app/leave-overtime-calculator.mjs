import { parseIsoDateUtc } from "./date-utils.mjs";
import { roundMoney, sumMoney } from "./money-utils.mjs";

const positive = value => Math.max(0, Number(value) || 0);

export const statutoryAnnualLeaveDays = cumulativeWorkYears => {
  const years = positive(cumulativeWorkYears);
  if (years < 1) return 0;
  if (years < 10) return 5;
  if (years < 20) return 10;
  return 15;
};

export const currentYearEmploymentDays = (employmentDate, cutoffDate) => {
  const employment = parseIsoDateUtc(employmentDate);
  const cutoff = parseIsoDateUtc(cutoffDate);
  if (!employment || !cutoff || cutoff < employment) return 0;
  const yearStart = new Date(Date.UTC(cutoff.getUTCFullYear(), 0, 1));
  const start = employment > yearStart ? employment : yearStart;
  return Math.floor((cutoff.getTime() - start.getTime()) / 86_400_000) + 1;
};

export const proratedAnnualLeaveDays = ({ employmentDate, cutoffDate, cumulativeWorkYears, takenDays = 0 }) => {
  const statutoryDays = statutoryAnnualLeaveDays(cumulativeWorkYears);
  const employedDays = currentYearEmploymentDays(employmentDate, cutoffDate);
  return Math.max(0, Math.floor(employedDays / 365 * statutoryDays - positive(takenDays)));
};

export const dailyWage = monthlyWage => roundMoney(positive(monthlyWage) / 21.75);
export const hourlyWage = monthlyWage => roundMoney(positive(monthlyWage) / 21.75 / 8);

export const annualLeaveCompensation = ({ averageMonthlyPay, unusedDays, writtenWaiver = false }) =>
  writtenWaiver ? 0 : roundMoney(positive(averageMonthlyPay) / 21.75 * positive(unusedDays) * 2);

export const overtimeCompensation = ({ monthlyWageBase, weekdayHours = 0, restDayHours = 0, holidayHours = 0 }) => {
  const rawHourly = positive(monthlyWageBase) / 21.75 / 8;
  const hourly = roundMoney(rawHourly);
  const weekday = roundMoney(rawHourly * positive(weekdayHours) * 1.5);
  const restDay = roundMoney(rawHourly * positive(restDayHours) * 2);
  const holiday = roundMoney(rawHourly * positive(holidayHours) * 3);
  return { hourly, weekday, restDay, holiday, total:sumMoney([weekday, restDay, holiday]) };
};

export const compTimeCompensation = ({ monthlyWageBase, outstandingDays = 0 }) =>
  roundMoney(positive(monthlyWageBase) / 21.75 * positive(outstandingDays) * 2);
