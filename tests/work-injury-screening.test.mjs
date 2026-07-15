import assert from "node:assert/strict";
import test from "node:test";

import { workInjuryScreening } from "../app/work-injury-screening.mjs";

test("screens typical work injuries without calculating compensation", () => {
  const result = workInjuryScreening({ kind:"work", incidentDate:"2026-07-15" });
  assert.equal(result.level, "likely");
  assert.equal(result.employerDeadline, "2026-08-14");
  assert.equal(result.workerDeadline, "2027-07-15");
});

test("distinguishes commute responsibility outcomes", () => {
  assert.equal(workInjuryScreening({ kind:"commute", commuteResponsibility:"nonPrimary" }).level, "likely");
  assert.equal(workInjuryScreening({ kind:"commute", commuteResponsibility:"primary" }).level, "unlikely");
  assert.equal(workInjuryScreening({ kind:"commute", commuteResponsibility:"pending" }).level, "review");
});

test("keeps unclear cases open for review", () => {
  const result = workInjuryScreening({ kind:"unclear", incidentDate:"" });
  assert.equal(result.level, "review");
  assert.equal(result.employerDeadline, "");
  assert.equal(result.workerDeadline, "");
});
