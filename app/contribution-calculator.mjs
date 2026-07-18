import { roundMoney, sumMoney } from "./money-utils.mjs";

/** @typedef {{ pension: number, unemployment: number, injury: number, maternity: number, medical: number }} SocialRates */

/** @type {Readonly<SocialRates>} */
export const DEFAULT_SOCIAL_RATES = Object.freeze({
  pension: 16,
  unemployment: 1.5,
  injury: 0.2,
  maternity: 0,
  medical: 9.9,
});

/**
 * 全国通用界面中的个人费率参考值，并非对任一地区的法规承诺。
 * 工伤、生育通常不由个人承担；医疗、失业等比例须按参保地修正。
 * @type {Readonly<SocialRates>}
 */
export const DEFAULT_PERSONAL_SOCIAL_RATES = Object.freeze({
  pension: 8,
  unemployment: 0.5,
  injury: 0,
  maternity: 0,
  medical: 2,
});

const safeNumber = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const roundRate = value => Math.round((value + Number.EPSILON) * 1000) / 1000;

/** @param {SocialRates | Readonly<SocialRates>} rates */
export function totalEmployerRate(rates = DEFAULT_SOCIAL_RATES) {
  return roundRate(Object.values(rates).reduce((sum, rate) => sum + safeNumber(rate), 0));
}

/** @param {SocialRates | Readonly<SocialRates>} rates */
export function totalPersonalRate(rates = DEFAULT_PERSONAL_SOCIAL_RATES) {
  return roundRate(Object.values(rates).reduce((sum, rate) => sum + safeNumber(rate), 0));
}

/** @param {number} actualPaid @param {SocialRates | Readonly<SocialRates>} rates */
export function declaredBaseFromPaidAmount(actualPaid = 0, rates = DEFAULT_SOCIAL_RATES) {
  const rate = totalEmployerRate(rates);
  return rate ? roundMoney(safeNumber(actualPaid) * 100 / rate) : 0;
}

/** @param {{ expectedBase?: number, actualBase?: number, rates?: SocialRates | Readonly<SocialRates> }} values */
export function socialContributionForMonth({ expectedBase = 0, actualBase = 0, rates = DEFAULT_SOCIAL_RATES } = {}) {
  const rate = totalEmployerRate(rates);
  const expected = roundMoney(safeNumber(expectedBase) * rate / 100);
  const actual = roundMoney(safeNumber(actualBase) * rate / 100);
  return { rate, expected, actual, gap: roundMoney(Math.max(0, expected - actual)) };
}

/** @param {{ expectedBase?: number, actualPaid?: number, rate?: number }} values */
export function fundContributionForMonth({ expectedBase = 0, actualPaid = 0, rate = 0 } = {}) {
  const normalizedRate = roundRate(safeNumber(rate));
  const expected = roundMoney(safeNumber(expectedBase) * normalizedRate / 100);
  const actual = roundMoney(safeNumber(actualPaid));
  return { rate:normalizedRate, expected, actual, gap:roundMoney(Math.max(0, expected - actual)) };
}

/**
 * Estimate the employee-funded part that should be redirected from unpaid gross
 * wages into the two contribution accounts. A partly unpaid wage month is
 * prorated so the already-paid wage is not deducted a second time. The result
 * is capped at the unpaid wage to keep the settlement allocation balanced.
 *
 * @param {{
 *   arrears?: number,
 *   grossWage?: number,
 *   socialBase?: number,
 *   socialRate?: number,
 *   fundBase?: number,
 *   fundRate?: number,
 * }} values
 */
export function personalContributionsForArrears({
  arrears = 0,
  grossWage = 0,
  socialBase = 0,
  socialRate = 0,
  fundBase = 0,
  fundRate = 0,
} = {}) {
  const unpaid = safeNumber(arrears);
  const gross = safeNumber(grossWage);
  const arrearsRatio = gross ? Math.min(1, unpaid / gross) : 0;
  const rawSocial = safeNumber(socialBase) * safeNumber(socialRate) / 100 * arrearsRatio;
  const rawFund = safeNumber(fundBase) * safeNumber(fundRate) / 100 * arrearsRatio;
  const rawTotal = rawSocial + rawFund;
  const capScale = rawTotal > unpaid && rawTotal > 0 ? unpaid / rawTotal : 1;
  let social = roundMoney(rawSocial * capScale);
  let fund = roundMoney(rawFund * capScale);
  const roundedCap = roundMoney(unpaid);
  const roundedTotal = sumMoney([social, fund]);
  if (roundedTotal > roundedCap) {
    const overflow = roundMoney(roundedTotal - roundedCap);
    if (fund >= overflow) fund = roundMoney(fund - overflow);
    else {
      social = roundMoney(Math.max(0, social - (overflow - fund)));
      fund = 0;
    }
  }
  return { arrearsRatio:roundRate(arrearsRatio), social, fund, total:sumMoney([social, fund]) };
}
