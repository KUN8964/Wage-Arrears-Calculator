const FORMULA_PREFIX = /^[\u0000-\u0020]*[=+\-@]/;

/** Convert one value to spreadsheet-safe text while preserving real numbers as numbers. */
export const csvValue = value => {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(2);
  const text = String(value ?? "");
  return FORMULA_PREFIX.test(text) ? `'${text}` : text;
};

export const csvDocument = lines => "\ufeff" + lines
  .map(line => line.map(value => `"${csvValue(value).replaceAll('"','""')}"`).join(","))
  .join("\n");
