import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the public calculator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /薪保计算器/);
  assert.match(html, /工资与社保欠款/);
  assert.match(html, /快速开始/);
  assert.doesNotMatch(html, /登录账号|注册账号|codex-preview/);
});

test("keeps calculator data local and portable", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /localStorage\.setItem\("xinbao-rows"/);
  assert.match(page, /application\/json/);
  assert.match(page, /text\/csv/);
  assert.match(page, /最多支持 11 个月/);
  assert.match(page, /生成月度明细/);
  assert.match(page, /入职日期/);
  assert.match(page, /统计截止日期/);
  assert.match(page, /开始欠薪月份/);
  assert.match(page, /首个欠薪月已发比例/);
  assert.match(page, /劳动合同开始日/);
  assert.match(page, /automaticDoubleRuleFor/);
  assert.match(page, /已自动启用/);
  assert.doesNotMatch(page, /<span>每月应发工资<\/span>/);
  assert.doesNotMatch(page, /<span>每月已发工资<\/span>/);
  assert.match(page, /monthCountBetween/);
  assert.match(page, /尚欠 \{socialMonths\} 个月/);
  assert.match(page, /socialPaid.*socialBase.*socialRate/);
  assert.match(page, /社保公司实缴开始月/);
  assert.match(page, /公积金公司实缴开始月/);
  assert.match(page, /paidMonthsWithin/);
  assert.match(page, /实缴 \{socialPaidMonths\} 个月/);
  assert.match(page, /公司应缴基数 × 公司比例 − 公司实际已缴/);
  assert.doesNotMatch(page, /fetch\(|signIn|requireChatGPTUser/);
});
