import { isIsoDate, isIsoMonth } from "./date-utils.mjs";
import { roundMoney } from "./money-utils.mjs";

const dateParts = value => {
  if (!isIsoDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
};

/**
 * Returns the inclusive calendar-day span employed within one wage month.
 * Calendar-day proration is only a neutral initial estimate; users can replace
 * the generated monthly amount with their payroll or attendance result.
 */
export const monthlyEmploymentSpan = ({ wageMonth, employmentDate, cutoffDate }) => {
  if (!isIsoMonth(wageMonth)) return { employedDays:0, calendarDays:0, ratio:0 };
  const employment = dateParts(employmentDate), cutoff = dateParts(cutoffDate);
  if (!employment || !cutoff || employmentDate > cutoffDate) return { employedDays:0, calendarDays:0, ratio:0 };

  const [year, month] = wageMonth.split("-").map(Number);
  const calendarDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = `${wageMonth}-01`;
  const monthEnd = `${wageMonth}-${String(calendarDays).padStart(2, "0")}`;
  if (cutoffDate < monthStart || employmentDate > monthEnd) return { employedDays:0, calendarDays, ratio:0 };

  const startDay = employment.year === year && employment.month === month ? employment.day : 1;
  const endDay = cutoff.year === year && cutoff.month === month ? cutoff.day : calendarDays;
  const employedDays = Math.max(0, endDay - startDay + 1);
  return { employedDays, calendarDays, ratio:employedDays / calendarDays };
};

export const proratedMonthlyWage = ({ monthlyWage, wageMonth, employmentDate, cutoffDate }) => {
  const wage = Number(monthlyWage);
  if (!Number.isFinite(wage) || wage <= 0) return 0;
  const { ratio } = monthlyEmploymentSpan({ wageMonth, employmentDate, cutoffDate });
  return roundMoney(wage * ratio);
};
