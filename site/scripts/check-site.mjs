// Checks the built site under its Pages base path and writes review screenshots.
// Serve first:  pnpm dlx http-server@14.1.1 tmp/site/serve -p 4173   (tmp/site/serve/boxtown -> site/public)
// Then:         node site/scripts/check-site.mjs [http://localhost:4173/boxtown/] [--og]
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const url = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:4173/boxtown/";
const shots = join(root, "tmp/site/shots");
mkdirSync(shots, { recursive: true });
const failures = [];
const fail = (msg) => failures.push(msg);

const browser = await chromium.launch({ args: ["--use-mock-keychain", "--password-store=basic"] });

async function open(width, height, scheme = "light") {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: scheme });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(url).origin });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && fail(`${width}px console: ${m.text()}`));
  page.on("requestfailed", (r) => fail(`${width}px request failed: ${r.url()}`));
  page.on("response", (r) => r.status() >= 400 && fail(`${width}px HTTP ${r.status()}: ${r.url()}`));
  await page.goto(url, { waitUntil: "networkidle" });
  return page;
}

// Layout at each width, plus full-page shots for review.
for (const [w, h] of [[1440, 900], [1100, 900], [800, 1000], [390, 844]]) {
  const page = await open(w, h);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 0) fail(`${w}px: page scrolls sideways by ${over}px`);
  await page.screenshot({ path: join(shots, `viewport-${w}.png`) });
  await page.screenshot({ path: join(shots, `full-${w}.png`), fullPage: true });
  await page.context().close();
}

// Dark mode
{
  const page = await open(1440, 900, "dark");
  await page.screenshot({ path: join(shots, "viewport-1440-dark.png") });
  await page.screenshot({ path: join(shots, "full-1440-dark.png"), fullPage: true });
  await page.context().close();
}

const page = await open(1440, 900);

// Every image loads, every local anchor and link resolves.
// Lazy images in hidden tabs have not loaded yet, so fetch every source directly.
const srcs = await page.evaluate(() => [...document.querySelectorAll("main img")].map((i) => i.src));
for (const src of new Set(srcs)) {
  const res = await page.request.get(src);
  if (!res.ok()) fail(`image ${src} -> ${res.status()}`);
}
const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
for (const href of new Set(hrefs)) {
  if (href.startsWith("#")) {
    if (!(await page.$(href))) fail(`missing anchor ${href}`);
  } else if (!/^https?:/.test(href)) {
    const res = await page.request.get(new URL(href, url).href);
    if (!res.ok()) fail(`local link ${href} -> ${res.status()}`);
  }
}

// Tabs: arrows, End, deep link.
await page.focus("#tab-map");
await page.keyboard.press("ArrowRight");
if (!(await page.isVisible("#panel-inspect"))) fail("ArrowRight did not open Inspect");
if (!page.url().endsWith("#tour/inspect")) fail(`URL did not follow tab: ${page.url()}`);
await page.keyboard.press("End");
if (!(await page.isVisible("#panel-search"))) fail("End did not open Search");
const below = async () => page.evaluate(() => document.getElementById("agents").getBoundingClientRect().top + scrollY);
const tops = [];
for (const id of ["map", "inspect", "isolate", "tree", "grid", "search"]) {
  await page.click(`#tab-${id}`);
  tops.push(await below());
}
if (new Set(tops).size > 1) fail(`tab change moves content below: ${tops.join(", ")}`);
await page.goto(`${url}#tour/grid`, { waitUntil: "networkidle" });
if (!(await page.isVisible("#panel-grid"))) fail("deep link #tour/grid did not open Grid");

// Copy button keeps its width.
const copy = page.locator(".hero .copy");
const w0 = (await copy.boundingBox()).width;
await copy.click();
await page.waitForTimeout(150);
const w1 = (await copy.boundingBox()).width;
if ((await copy.textContent()).trim() !== "✓ Copied") fail("copy label did not change");
if (w0 !== w1) fail(`copy button width changed ${w0} -> ${w1}`);
const clip = await page.evaluate(() => navigator.clipboard.readText());
if (!clip.includes("npm install -g boxtown")) fail("clipboard does not hold the install command");

// Lightbox: fitted on open, click zooms, arrow steps, Esc closes and returns focus.
await page.click("#tab-map");
await page.click("#panel-map .shot");
await page.waitForTimeout(300);
const fit = await page.evaluate(() => {
  const img = document.querySelector(".lb-stage img"), st = document.querySelector(".lb-stage");
  const s = +img.style.transform.match(/scale\(([\d.]+)\)/)[1];
  return { w: img.naturalWidth * s, h: img.naturalHeight * s, sw: st.clientWidth, sh: st.clientHeight };
});
if (fit.w > fit.sw + 1 || fit.h > fit.sh + 1 || (Math.abs(fit.w - fit.sw) > 1 && Math.abs(fit.h - fit.sh) > 1))
  fail(`lightbox not fitted: ${JSON.stringify(fit)}`);
if (!(await page.evaluate(() => document.activeElement.classList.contains("lb-close")))) fail("focus not on Close");
await page.screenshot({ path: join(shots, "lightbox.png") });
const box = await page.locator(".lb-stage").boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
if (!(await page.evaluate(() => document.querySelector(".lb-stage").classList.contains("zoomed")))) fail("click did not zoom");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(200);
if (!(await page.textContent("#lb-title")).startsWith("Inspect")) fail("ArrowRight did not step to Inspect");
await page.keyboard.press("Escape");
if (await page.evaluate(() => document.querySelector(".lb").open)) fail("Esc did not close");
if (!(await page.evaluate(() => document.activeElement.classList.contains("shot")))) fail("focus did not return");

// Live maps: select opens the inspector, double-click isolates, story steps drive depth,
// and the agent terminal changes the map.
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.boxtown);
await page.locator('#explorer g.box[data-id="page-active-ride"]').click();
await page.waitForTimeout(400);
if ((await page.textContent("#explorer .inspector h3")) !== "Active ride") fail("click did not open the inspector");
await page.click("#explorer .in-close");
await page.waitForTimeout(300);
// Keyboard: arrow from the tabbable box to a neighbor, Enter opens its details.
await page.locator('#explorer g.box[tabindex="0"]').focus();
const startId = await page.evaluate(() => document.activeElement.dataset.id);
await page.keyboard.press("ArrowRight");
const nextId = await page.evaluate(() => document.activeElement.dataset.id);
if (!nextId || nextId === startId) fail("arrow key did not move focus between boxes");
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
if (await page.isHidden("#explorer .inspector")) fail("Enter on a box did not open its details");
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
await page.locator('#explorer g.box[data-id="area-find-a-bike"]').dblclick();
await page.waitForTimeout(400);
if (await page.isHidden("#explorer .iso-chip")) fail("double-click did not isolate");
await page.click('#explorer [data-key="depth"] [data-v="1"]');
await page.waitForTimeout(300);
const visible = await page.evaluate(() => [...document.querySelectorAll("#explorer g.box")].filter((g) => g.getAttribute("opacity") !== "0").length);
if (visible !== 6) fail(`Depth 1 shows ${visible} boxes, expected 6`);
for (const [step, depth] of [["districts", 1], ["blocks", 2], ["status", "all"]]) {
  await page.locator(`.step[data-step="${step}"]`).evaluate((e) => e.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(500);
  const d = await page.evaluate(() => window.boxtown.story.state.depth);
  if (d !== depth) fail(`story step ${step}: depth ${d}, expected ${depth}`);
}
await page.locator("#terminal").evaluate((e) => e.scrollIntoView({ block: "center" }));
await page.click('[data-run="2"]');
await page.waitForTimeout(2500);
if ((await page.evaluate(() => window.boxtown.agentMap.status["page-active-ride"])) !== "implemented") fail("Mark it done did not update the map");

// og.png from the site's own first viewport.
if (process.argv.includes("--og")) {
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await og.goto(url, { waitUntil: "networkidle" });
  await og.screenshot({ path: join(root, "site/public/og.png") });
  const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await icon.setContent(`<body style="margin:0;background:#eaeeea;display:grid;place-items:center;height:180px">
    <img src="${new URL("favicon.svg", url).href}" width="140" height="140"></body>`);
  await icon.waitForLoadState("networkidle");
  await icon.screenshot({ path: join(root, "site/public/apple-touch-icon.png") });
}

await browser.close();
if (failures.length) {
  console.error(failures.map((f) => `FAIL ${f}`).join("\n"));
  process.exit(1);
}
console.log(`OK: ${url} passed. Screenshots in tmp/site/shots/`);
