// Reshoots every screenshot on the site from the fictional Harbor Bikes demo.
// It seeds a fresh data folder, starts the packaged viewer on it, and writes WebP files
// to site/public/images/. Run `pnpm cli:prepare-package` once first so the viewer exists.
// Usage: pnpm --dir site capture
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { exportDemo } from "./export-demo.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = join(root, "tmp/site/demo-data");
const out = join(root, "site/public/images");
const port = 43219;
const base = `http://127.0.0.1:${port}`;
const project = `${base}/projects/harbor-bikes`;

rmSync(dataDir, { recursive: true, force: true });
execFileSync("node", [join(root, "site/scripts/seed-demo.mjs"), dataDir], { cwd: root, stdio: "inherit" });

const viewer = spawn(
  "node",
  [join(root, "packages/cli/bin/boxtown.mjs"), "viewer", "--data-dir", dataDir, "--no-open", "--port", String(port)],
  { cwd: root, stdio: "ignore" },
);
for (let i = 0; ; i++) {
  if (await fetch(base).then((r) => r.ok, () => false)) break;
  if (i > 120) throw new Error("viewer did not start");
  await new Promise((r) => setTimeout(r, 250));
}

const browser = await chromium.launch({ args: ["--use-mock-keychain", "--password-store=basic"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const encoder = await ctx.newPage();
mkdirSync(out, { recursive: true });

// Playwright writes PNG or JPEG only, so the browser encodes WebP from the PNG.
async function encodeWebp(png) {
  const url = `data:image/png;base64,${png.toString("base64")}`;
  const webp = await encoder.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    return c.toDataURL("image/webp", 0.86).split(",")[1];
  }, url);
  return Buffer.from(webp, "base64");
}
async function save(name, png) {
  writeFileSync(join(out, `${name}.webp`), await encodeWebp(png));
  console.log(`wrote ${name}.webp`);
}

async function shot(name, url, prep, clip) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200); // layout and camera transitions settle
  if (prep) await prep();
  await save(name, await page.screenshot(clip ? { clip } : {}));
}

const fit = async () => {
  await page.mouse.click(700, 860); // focus the canvas without selecting a node
  await page.keyboard.press("f");
  await page.waitForTimeout(900);
};

await shot("map", `${project}?inspector=0`, fit);
await shot("inspect", `${project}?node=page-active-ride&inspector=1`);
await shot("isolate", `${project}?isolate=area-find-a-bike&node=page-station-detail&edges=1`, fit);
await shot("tree", `${project}?view=tree&node=area-find-a-bike`);
await shot("grid", `${project}?view=grid`);
await shot("search", project, async () => {
  await page.keyboard.press("Meta+k");
  await page.getByRole("dialog").locator("input").first().waitFor();
  await page.waitForTimeout(300);
  await page.keyboard.type("dock", { delay: 40 });
  await page.waitForTimeout(500);
});

// The live map on the page: layouts, node data, images and CLI output. Runs last: it changes the data.
await exportDemo({ root, base, dataDir, page, encodeWebp });

await browser.close();
viewer.kill("SIGINT");
