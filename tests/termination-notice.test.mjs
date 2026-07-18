import assert from "node:assert/strict";
import test from "node:test";

import { buildTerminationNotice, safeTerminationNoticeFileName } from "../app/termination-notice.mjs";

test("builds a personalized article 38 notice in Markdown and Word-compatible HTML", () => {
  const notice = buildTerminationNotice({
    employeeName:"张三",
    companyName:"示例科技有限公司",
    employmentDate:"2025-06-09",
    noticeDate:"2026-07-17",
    contact:"13800000000",
    reasons:["wage", "socialUnpaid"],
  });
  assert.match(notice.markdown, /解除劳动合同通知书/);
  assert.match(notice.markdown, /致：示例科技有限公司/);
  assert.match(notice.markdown, /第三十八条第一款第二项/);
  assert.match(notice.markdown, /第三十八条第一款第三项/);
  assert.match(notice.markdown, /第四十六条、第四十七条/);
  assert.match(notice.markdown, /第五十条/);
  assert.match(notice.html, /@page\{size:A4/);
  assert.match(notice.html, /2026年7月17日/);
});

test("escapes user text in Word HTML and marks an empty reason as unsafe", () => {
  const notice = buildTerminationNotice({employeeName:"<张三>",companyName:'A&B "公司"',reasons:[]});
  assert.match(notice.html, /&lt;张三&gt;/);
  assert.match(notice.html, /A&amp;B &quot;公司&quot;/);
  assert.doesNotMatch(notice.html, /<张三>/);
  assert.match(notice.markdown, /尚未选择解除理由，请勿直接发送/);
});

test("keeps preloaded rights separate from article 38 termination reasons", () => {
  const notice = buildTerminationNotice({
    employeeName:"张三",
    companyName:"示例公司",
    reasons:["wage"],
    rights:["wage", "fund", "reimbursement", "overtime"],
  });
  assert.equal(notice.rightsParagraphs.length, 4);
  assert.match(notice.markdown, /二、随通知一并列明的待处理权益事项/);
  assert.match(notice.markdown, /住房公积金不等同于社会保险/);
  assert.match(notice.markdown, /三、解除通知与后续事项/);
  assert.match(notice.html, /支付尚未结清的加班工资/);
  assert.doesNotMatch(notice.html, /双倍工资差额|未休年休假工资报酬/);
});

test("creates a filesystem-safe notice filename", () => {
  assert.equal(safeTerminationNoticeFileName({employeeName:"张/三",noticeDate:"2026-07-17"}), "张_三-解除劳动合同通知书-2026-07-17");
});
