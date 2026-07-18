import assert from "node:assert/strict";
import test from "node:test";

import { csvDocument, csvValue } from "../app/csv-export.mjs";

test("neutralizes spreadsheet formulas in user-controlled text", () => {
  assert.equal(csvValue("=HYPERLINK(\"https://example.invalid\")"), "'=HYPERLINK(\"https://example.invalid\")");
  assert.equal(csvValue("  +cmd"), "'  +cmd");
  assert.equal(csvValue("\t@SUM(1,1)"), "'\t@SUM(1,1)");
  assert.equal(csvValue("普通备注"), "普通备注");
});

test("keeps actual numbers numeric and quotes CSV syntax", () => {
  assert.equal(csvValue(-10), "-10.00");
  assert.equal(csvDocument([["备注", "金额"], ['=1+1', -10]]), '\ufeff"备注","金额"\n"\'=1+1","-10.00"');
});
