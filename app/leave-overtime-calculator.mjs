const positive = value => Math.max(0, Number(value) || 0);

const utcDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export const statutoryAnnualLeaveDays = cumulativeWorkYears => {
  const years = positive(cumulativeWorkYears);
  if (years < 1) return 0;
  if (years < 10) return 5;
  if (years < 20) return 10;
  return 15;
};

export const currentYearEmploymentDays = (employmentDate, cutoffDate) => {
  const employment = utcDate(employmentDate);
  const cutoff = utcDate(cutoffDate);
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

export const dailyWage = monthlyWage => positive(monthlyWage) / 21.75;
export const hourlyWage = monthlyWage => dailyWage(monthlyWage) / 8;

export const annualLeaveCompensation = ({ averageMonthlyPay, unusedDays, writtenWaiver = false }) =>
  writtenWaiver ? 0 : dailyWage(averageMonthlyPay) * positive(unusedDays) * 2;

export const overtimeCompensation = ({ monthlyWageBase, weekdayHours = 0, restDayHours = 0, holidayHours = 0 }) => {
  const hourly = hourlyWage(monthlyWageBase);
  const weekday = hourly * positive(weekdayHours) * 1.5;
  const restDay = hourly * positive(restDayHours) * 2;
  const holiday = hourly * positive(holidayHours) * 3;
  return { hourly, weekday, restDay, holiday, total: weekday + restDay + holiday };
};

export const compTimeCompensation = ({ monthlyWageBase, outstandingDays = 0 }) =>
  dailyWage(monthlyWageBase) * positive(outstandingDays) * 2;
