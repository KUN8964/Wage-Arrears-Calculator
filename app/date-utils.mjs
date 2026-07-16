const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

const dateParts = value => {
  const match = DATE_PATTERN.exec(String(value || ""));
  if (!match) return null;
  const [, year, month, day] = match;
  return { year:Number(year), month:Number(month), day:Number(day) };
};

export const parseIsoDateUtc = value => {
  const parts = dateParts(value);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return date.getUTCFullYear() === parts.year && date.getUTCMonth() === parts.month - 1 && date.getUTCDate() === parts.day ? date : null;
};

export const parseIsoDateLocal = value => {
  const parts = dateParts(value);
  if (!parts) return null;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  return date.getFullYear() === parts.year && date.getMonth() === parts.month - 1 && date.getDate() === parts.day ? date : null;
};

export const isIsoDate = value => Boolean(parseIsoDateUtc(value));

export const isIsoMonth = value => {
  const match = MONTH_PATTERN.exec(String(value || ""));
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
};
