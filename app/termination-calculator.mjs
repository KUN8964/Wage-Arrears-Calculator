const positive = value => Math.max(0, Number(value) || 0);

const utcDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
};

const addUtcMonths = (date, months) => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
};

export const economicCompensationN = ({ employmentDate, terminationDate }) => {
  const start = utcDate(employmentDate);
  const end = utcDate(terminationDate);
  if (!start || !end || end < start) return 0;

  let fullYears = end.getUTCFullYear() - start.getUTCFullYear();
  let anniversary = addUtcMonths(start, fullYears * 12);
  if (anniversary > end) {
    fullYears -= 1;
    anniversary = addUtcMonths(start, fullYears * 12);
  }
  if (anniversary.getTime() === end.getTime()) return fullYears || 0.5;
  return fullYears + (end >= addUtcMonths(anniversary, 6) ? 1 : 0.5);
};

export const terminationCompensation = ({
  employmentDate,
  terminationDate,
  averageMonthlyPay,
  localAverageMonthlyPay = 0,
  extraMonths = 0,
  extraMonthlyPay = 0,
}) => {
  const rawN = economicCompensationN({ employmentDate, terminationDate });
  const averagePay = positive(averageMonthlyPay);
  const localAverage = positive(localAverageMonthlyPay);
  const highIncomeCapped = localAverage > 0 && averagePay > localAverage * 3;
  const appliedN = highIncomeCapped ? Math.min(rawN, 12) : rawN;
  const nMonthlyBase = highIncomeCapped ? localAverage * 3 : averagePay;
  const safeExtraMonths = Math.min(9, Math.max(0, Math.trunc(Number(extraMonths) || 0)));
  const extraMonthlyBase = positive(extraMonthlyPay) || averagePay;
  const economic = appliedN * nMonthlyBase;
  const extra = safeExtraMonths * extraMonthlyBase;
  return {
    rawN,
    appliedN,
    nMonthlyBase,
    extraMonths:safeExtraMonths,
    extraMonthlyBase,
    economic,
    extra,
    total:economic + extra,
    highIncomeCapped,
  };
};
