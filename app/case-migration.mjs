import { isIsoDate, isIsoMonth } from "./date-utils.mjs";

const endOfMonth = month => {
  if (!isIsoMonth(month)) return "";
  const [year, monthNumber] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
};

/** Resolve legacy employment dates without treating an old calculation cutoff as proof of departure. */
export const employmentSnapshotFor = (old = {}, today = "") => {
  const validToday = isIsoDate(today) ? today : "";
  const sourceCutoffDate = isIsoDate(old.cutoffDate)
    ? old.cutoffDate
    : endOfMonth(old.endMonth);
  const hasExplicitStatus = old.employmentStatus === "active" || old.employmentStatus === "departed";
  const employmentStatus = hasExplicitStatus
    ? old.employmentStatus
    : isIsoDate(old.departureDate) ? "departed" : "active";
  const departureDate = employmentStatus === "departed"
    ? (isIsoDate(old.departureDate) ? old.departureDate : sourceCutoffDate)
    : "";
  return {
    employmentStatus,
    departureDate,
    cutoffDate:employmentStatus === "active" ? validToday : departureDate,
    sourceCutoffDate,
    needsStatusConfirmation:!hasExplicitStatus && Boolean(sourceCutoffDate) && !isIsoDate(old.departureDate),
  };
};

/** Active cases must be recalculated when their saved monthly rows stop before today. */
export const restoredRowsNeedReview = ({ employmentStatus, rowsCutoffDate, today }) =>
  employmentStatus === "active"
  && isIsoDate(rowsCutoffDate)
  && isIsoDate(today)
  && rowsCutoffDate !== today;
