const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
};

const formatDate = (date) => date ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}` : "";
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
const addYear = (date) => {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
};

export const WORK_INJURY_KINDS = {
  work: "工作时间、工作场所内因工作原因受伤",
  commute: "上下班合理途中发生交通事故",
  businessTrip: "因工外出期间因工作原因受伤",
  occupationalDisease: "依法诊断或鉴定为职业病",
  suddenDeath: "工作时间和岗位突发疾病死亡，或 48 小时内抢救无效",
  unclear: "其他情形或暂时不清楚",
};

export function workInjuryScreening({ kind = "unclear", commuteResponsibility = "pending", incidentDate = "" } = {}) {
  let level = "review";
  let title = "需要进一步核实";
  let explanation = "目前信息不足，不能仅凭受伤时间或地点判断是否属于工伤。";

  if (["work", "businessTrip", "occupationalDisease", "suddenDeath"].includes(kind)) {
    level = "likely";
    title = "初步符合典型工伤情形";
    explanation = kind === "suddenDeath"
      ? "该情形属于《工伤保险条例》规定的视同工伤情形之一，仍需由社会保险行政部门依法认定。"
      : "该情形与《工伤保险条例》列明的典型情形相符，最终以工伤认定决定和有效证据为准。";
  }

  if (kind === "commute") {
    if (commuteResponsibility === "nonPrimary") {
      level = "likely";
      title = "初步符合通勤工伤条件";
      explanation = "还需同时证明属于合理上下班时间和路线，并以事故责任认定等材料证明本人不负主要责任。";
    } else if (commuteResponsibility === "primary") {
      level = "unlikely";
      title = "暂不符合典型通勤工伤条件";
      explanation = "本人负主要责任或全部责任的通勤交通事故，通常不符合该项工伤认定条件。";
    } else {
      explanation = "通勤交通事故需要事故责任结论；无责任、次要责任或同等责任通常属于“非本人主要责任”。";
    }
  }

  const parsed = parseDate(incidentDate);
  return {
    level,
    title,
    explanation,
    kindLabel: WORK_INJURY_KINDS[kind] || WORK_INJURY_KINDS.unclear,
    employerDeadline: parsed ? formatDate(addDays(parsed, 30)) : "",
    workerDeadline: parsed ? formatDate(addYear(parsed)) : "",
  };
}
