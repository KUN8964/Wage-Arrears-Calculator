/** @typedef {{ pension: number, unemployment: number, injury: number, maternity: number, medical: number }} SocialRates */

/** @type {Readonly<SocialRates>} */
export const DEFAULT_SOCIAL_RATES = Object.freeze({
  pension: 14,
  unemployment: 2,
  injury: 0.8,
  maternity: 0.6,
  medical: 11.5,
});

const safeNumber = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const rounded = (value) => Math.round((value + Number.EPSILON) * 1000) / 1000;

/** @param {SocialRates | Readonly<SocialRates>} rates */
export function totalEmployerRate(rates = DEFAULT_SOCIAL_RATES) {
  return rounded(Object.values(rates).reduce((sum, rate) => sum + safeNumber(rate), 0));
}

/** @param {number} actualPaid @param {SocialRates | Readonly<SocialRates>} rates */
export function declaredBaseFromPaidAmount(actualPaid = 0, rates = DEFAULT_SOCIAL_RATES) {
  const rate = totalEmployerRate(rates);
  return rate ? rounded(safeNumber(actualPaid) * 100 / rate) : 0;
}

/** @param {{ expectedBase?: number, actualBase?: number, rates?: SocialRates | Readonly<SocialRates> }} values */
export function socialContributionForMonth({ expectedBase = 0, actualBase = 0, rates = DEFAULT_SOCIAL_RATES } = {}) {
  const rate = totalEmployerRate(rates);
  const expected = rounded(safeNumber(expectedBase) * rate / 100);
  const actual = rounded(safeNumber(actualBase) * rate / 100);
  return { rate, expected, actual, gap: rounded(Math.max(0, expected - actual)) };
}
