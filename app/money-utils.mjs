const finiteNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;

/** Round a monetary amount to the nearest cent at the calculation boundary. */
export const roundMoney = value => {
  const number = finiteNumber(value);
  const correction = Math.sign(number) * Number.EPSILON * Math.max(1, Math.abs(number));
  return Math.round((number + correction) * 100) / 100;
};

/** Sum already-independent monetary line items without accumulating fractions of a cent. */
export const sumMoney = values => values.reduce(
  (cents, value) => {
    const number = finiteNumber(value);
    const correction = Math.sign(number) * Number.EPSILON * Math.max(1, Math.abs(number));
    return cents + Math.round((number + correction) * 100);
  },
  0,
) / 100;
