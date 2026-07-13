import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("provides a GitHub Pages static deployment workflow", async () => {
  const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(pkg.scripts["build:pages"], "next build");
  assert.match(config, /GITHUB_PAGES/);
  assert.match(config, /output: isGithubPages \? "export"/);
  assert.match(config, /basePath/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /path: \.\/out/);
  assert.match(workflow, /GITHUB_PAGES: "true"/);
  assert.doesNotMatch(layout, /from "next\/headers"/);
});
