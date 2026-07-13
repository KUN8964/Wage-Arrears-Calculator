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
  assert.match(page, /socialPaid.*socialBase.*socialRate/);
  assert.match(page, /应缴基数 × 比例 − 实际已缴/);
  assert.doesNotMatch(page, /fetch\(|signIn|requireChatGPTUser/);
});
