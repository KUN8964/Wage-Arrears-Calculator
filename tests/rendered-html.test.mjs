import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "Wage-Arrears-Calculator";
  const basePath = process.env.GITHUB_PAGES === "true" ? `/${repositoryName}` : "";
  return worker.fetch(new Request(`http://localhost${basePath}/`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the public calculator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /薪资计算器/);
  assert.match(html, /工资、社保与劳动权益一表算清/);
  assert.match(html, /引导测算/);
  assert.match(html, /先填写三个基础事实/);
  assert.match(html, /SYSTEM GENERATED REPORT/);
  assert.match(html, /工资、社保及劳动权益/);
  assert.doesNotMatch(html, /登录账号|注册账号|codex-preview/);
});

test("keeps calculator data local and portable", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /localStorage\.setItem\("xinbao-rows"/);
  assert.match(page, /application\/json/);
  assert.match(page, /text\/csv/);
  assert.match(page, /最多支持 11 个月/);
  assert.match(page, /确认并生成结果/);
  assert.match(page, /入职日期/);
  assert.match(page, /统计截止日期/);
  assert.match(page, /开始欠薪月份/);
  assert.match(page, /首个欠薪月实际发了多少/);
  assert.doesNotMatch(page, /劳动合同开始日/);
  assert.match(page, /合同上写的最后一天/);
  assert.match(page, /automaticDoubleRuleFor/);
  assert.match(page, /已自动启用/);
  assert.doesNotMatch(page, /<span>每月应发工资<\/span>/);
  assert.doesNotMatch(page, /<span>每月已发工资<\/span>/);
  assert.match(page, /monthCountBetween/);
  assert.match(page, /尚欠 \{socialMonths\} 个月/);
  assert.match(page, /socialPaid.*socialBase.*socialRate/);
  assert.match(page, /effectiveSocialStart/);
  assert.match(page, /effectiveFundStart/);
  assert.match(page, /实缴 \{socialPaidMonths\} 个月/);
  assert.match(page, /socialDueFor/);
  assert.match(page, /fundDueFor/);
  assert.match(page, /查看精算明细/);
  assert.doesNotMatch(page, /fetch\(|signIn|requireChatGPTUser/);
});
