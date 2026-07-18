import { roundMoney } from "./money-utils.mjs";

export const contributionGap = ({ base = 0, rate = 0, paid = 0 } = {}) =>
  roundMoney(Math.max(0, roundMoney(Number(base || 0) * Number(rate || 0) / 100) - roundMoney(paid)));

export const wageArrears = ({ duePay = 0, normalPay = 0, paid = 0 } = {}) =>
  roundMoney(Math.max(0, roundMoney(duePay) - roundMoney(normalPay) - roundMoney(paid)));

export const rowSettlementStatus = row => wageArrears(row) > 0
  || contributionGap({base:row?.socialBase,rate:row?.socialRate,paid:row?.socialPaid}) > 0
  || contributionGap({base:row?.fundBase,rate:row?.fundRate,paid:row?.fundPaid}) > 0
  ? "未结清"
  : "已结清";
