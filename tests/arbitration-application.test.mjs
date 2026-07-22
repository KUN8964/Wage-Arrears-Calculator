import assert from "node:assert/strict";
import test from "node:test";

import { buildArbitrationApplication, safeArbitrationApplicationFileName } from "../app/arbitration-application.mjs";

const completeInput = {
  applicant:{name:"张三",gender:"男",birthDate:"1990-01-02",idNumber:"330100199001020000",address:"杭州市甲路1号",serviceAddress:"杭州市乙路2号",phone:"13800000000",position:"产品经理"},
  respondent:{name:"示例科技有限公司",registeredAddress:"杭州市丙路3号",officeAddress:"杭州市丁路4号",legalRepresentative:"李四",legalRepresentativeTitle:"执行董事",phone:"0571-88888888"},
  committee:"杭州市某区劳动人事争议仲裁委员会",
  applicationDate:"2026-07-21",
  employmentDate:"2025-01-01",employmentStatus:"departed",departureDate:"2026-07-17",cutoffDate:"2026-07-17",contractEnd:"2025-12-31",contractPay:20_000,
  wagePeriod:"2026-01 至 2026-07",annualLeaveDays:"3",
  claims:["wage","doublePay","annualLeave","overtime","termination"],
  amounts:{wage:100_000,doublePay:80_000,annualLeave:5_517.24,overtime:6_000,termination:30_000},
  evidence:["劳动合同", "工资流水", "劳动合同"],
};

test("builds a general labor-arbitration application from selected calculated claims", () => {
  const application = buildArbitrationApplication(completeInput);
  assert.equal(application.requestParagraphs.length, 5);
  assert.match(application.markdown, /劳动人事争议仲裁申请书/);
  assert.match(application.markdown, /拖欠的工资人民币100,000.00元/);
  assert.match(application.markdown, /二倍工资差额人民币80,000.00元/);
  assert.match(application.markdown, /未休年休假工资报酬人民币5,517.24元/);
  assert.match(application.markdown, /双方劳动关系于2026年7月17日解除或终止/);
  assert.match(application.markdown, /杭州市某区劳动人事争议仲裁委员会/);
  assert.equal(application.evidenceParagraphs.length, 2);
  assert.match(application.html, /@page\{size:A4 portrait;margin:25.4mm 31.75mm\}/);
  assert.match(application.html, /font-size:14pt/);
  assert.match(application.markdown, /劳动合同、银行工资流水/);
  assert.match(application.markdown, /一式三份/);
});

test("does not overstate that an active employment relationship has already ended", () => {
  const application = buildArbitrationApplication({
    ...completeInput,
    employmentStatus:"active",
    forcedNoticeSent:"no",
    claims:["termination"],
    amounts:{termination:30_000},
  });
  assert.match(application.factParagraphs.join("\n"), /尚需核对劳动关系是否已经解除、终止/);
  assert.doesNotMatch(application.factParagraphs.join("\n"), /双方劳动关系已解除/);
});

test("keeps social insurance and housing fund outside automatic arbitration money claims", () => {
  const application = buildArbitrationApplication({
    ...completeInput,
    claims:["wage","social","fund"],
    amounts:{wage:1_000,social:8_000,fund:2_000},
  });
  assert.equal(application.requestParagraphs.length, 1);
  assert.doesNotMatch(application.requestParagraphs.join("\n"), /社会保险|住房公积金/);
  assert.match(application.markdown, /需另向对应行政主管机关申请核查/);
});

test("escapes user-controlled Word HTML and marks an empty request as unsafe", () => {
  const application = buildArbitrationApplication({
    applicant:{name:"<张三>"},
    respondent:{name:'A&B "公司"'},
    claims:[],
  });
  assert.match(application.html, /&lt;张三&gt;/);
  assert.match(application.html, /A&amp;B &quot;公司&quot;/);
  assert.doesNotMatch(application.html, /<张三>/);
  assert.match(application.markdown, /尚未选择仲裁请求，请勿直接提交/);
});

test("creates a filesystem-safe arbitration application filename", () => {
  assert.equal(safeArbitrationApplicationFileName({applicantName:"张/三",applicationDate:"2026-07-21"}), "张_三-劳动人事争议仲裁申请书-2026-07-21");
});
