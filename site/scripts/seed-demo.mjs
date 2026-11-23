// Builds the fictional "Harbor Bikes" demo project that the site screenshots show.
// It writes only through the boxtown CLI, so the data is what a real user would get.
// Usage: node site/scripts/seed-demo.mjs <data-dir>   (a viewer on that folder is reused)
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = resolve(process.argv[2] ?? join(root, "tmp/site/demo-data"));
const work = join(root, "tmp/site/seed");
const cli = join(root, "packages/cli/bin/boxtown.mjs");
const project = "harbor-bikes";

const run = (...args) =>
  JSON.parse(execFileSync("node", [cli, ...args, "--local", dataDir, "--json"], { cwd: root, encoding: "utf8" }));
const inProject = (...args) => run(...args, "--project", project);

// [title, type, parentTitle, status, priority, purpose, context]
const nodes = [
  ["Find a bike", "area", null, "implemented", null, "Everything a rider does before the ride starts."],
  ["Map", "page", "Find a bike", "implemented", null, "Full-screen map of nearby stations with live dock counts."],
  ["Station pins", "assembly", "Map", "implemented", null, "Pins sized by free bikes, colored by e-bike share."],
  ["Dock count chip", "component", "Station pins", "implemented", null, "Small count of free bikes and free docks."],
  ["Filter bar", "assembly", "Map", "working", "high", "Quick filters above the map."],
  ["E-bike toggle", "component", "Filter bar", "working", null, "Shows only stations with charged e-bikes."],
  ["Distance chip", "component", "Filter bar", "planned", null, "Limits pins to a walking distance."],
  ["Station detail", "page", "Find a bike", "implemented", null, "One station: bikes, docks, walking time, reserve."],
  ["Reserve button", "component", "Station detail", "needs-review", "high", "Holds a bike for 10 minutes."],

  ["Ride", "area", null, "working", null, "Unlock, ride and return."],
  ["Unlock", "page", "Ride", "implemented", null, "Scan the QR code on the bike or type its number."],
  ["QR scanner", "component", "Unlock", "implemented", null, "Camera view with a manual-entry fallback."],
  ["Active ride", "page", "Ride", "working", "urgent", "Timer, cost so far, and the nearest docks with space."],
  ["Ride timer card", "assembly", "Active ride", "working", null, "Elapsed time and running cost."],
  ["End ride button", "component", "Ride timer card", "blocked", "urgent", "Needs the dock lock event before it can confirm."],
  ["Return nearby", "assembly", "Active ride", "planned", null, "Three closest stations with free docks."],

  ["Pay", "area", null, "working", null, "Plans, wallet and receipts."],
  ["Plans", "page", "Pay", "implemented", null, "Single ride, day pass and monthly member."],
  ["Plan picker", "assembly", "Plans", "implemented", null, "Three cards; the current plan is selected."],
  ["Wallet", "page", "Pay", "working", null, "Saved cards and ride credit."],
  ["Receipt row", "component", "Wallet", "planned", "low", "One ride: date, minutes, cost."],

  ["Account", "area", null, "planned", null, "Sign-in, profile and ride history."],
  ["Sign in", "page", "Account", "implemented", null, "Email link sign-in. No passwords."],
  ["Ride history", "page", "Account", "planned", "medium", "Past rides on a list and a small route map."],

  ["Fleet ops", "module", null, "working", null, "Back-office tools for the operations crew."],
  ["Rebalancing queue", "module", "Fleet ops", "working", "high", "Stations that are too full or too empty, ranked."],
  ["Dock sensor feed", "module", "Fleet ops", "needs-review", null, "Lock and unlock events from every dock."],
];

const links = [
  ["Reserve button", "Unlock", "dependency"],
  ["End ride button", "Dock sensor feed", "dependency"],
  ["Return nearby", "Station pins", "reuse"],
  ["Rebalancing queue", "Dock sensor feed", "dependency"],
  ["Plan picker", "Wallet", "related"],
];

// Implementation notes for the nodes the screenshots select or show in the grid.
const impl = {
  "Find a bike": "MapLibre base map; station data from the GBFS feed every 30 s.",
  Map: "Cluster pins under zoom 13. Keep the filter bar sticky.",
  "Station detail": "Bottom sheet over the map on phones, side panel on tablets.",
  "Active ride": "Wake lock on. Timer from the unlock event, not the phone clock.",
  "Ride timer card": "Tabular numbers so the digits do not shift.",
  "End ride button": "Disabled until the dock reports a lock.",
  Unlock: "Camera permission asked here, not at sign-in.",
  Plans: "Prices come from the pricing service; no hard-coded amounts.",
  "Rebalancing queue": "Score = distance from target fill x expected demand.",
};

const contexts = {
  "Active ride": `## Active ride

The screen a rider looks at most. Keep it readable at arm's length on a handlebar mount.

- Timer and cost update every second.
- **Return nearby** lists the three closest stations with free docks.
- The end button waits for the dock lock event (see *Dock sensor feed*).

### Open questions

1. Show cost in the rider's plan currency or always in dollars?
2. What happens when the phone loses signal mid-ride?
`,
  "End ride button": `Blocked until the dock sensor feed sends a lock event.
Without it, the app cannot tell a docked bike from a bike leaning on the dock.`,
};

const brief = `# Harbor Bikes launch brief

## Goal
Riders find a bike, ride, and return it with no help from support.

## Scope for spring
### Must ship
Map, unlock, active ride, single-ride payment.
### Later
Ride history and monthly plans.

## Risks
Dock sensors in the harbor district drop events in heavy rain.
`;

// Phone-screen sketches for the page nodes, rendered from HTML so they need no assets.
const sketches = {
  Map: { title: "Nearby", body: pins() },
  "Station detail": { title: "Pier 4", body: rows(["12 bikes", "3 e-bikes", "6 free docks", "4 min walk"]) + button("Reserve") },
  Unlock: { title: "Unlock", body: `<div class="qr"></div><p>Scan the code on the bike</p>` },
  "Active ride": { title: "12:48", body: rows(["$3.20 so far", "Pier 4 · 6 docks", "Market St · 2 docks"]) + button("End ride", "#9b3a3a") },
  Plans: { title: "Plans", body: rows(["Single ride · $1", "Day pass · $9", "Member · $15/mo"]) + button("Choose") },
};

function pins() {
  const spots = [[20, 30, 14], [60, 22, 10], [42, 55, 18], [75, 62, 8], [28, 78, 12], [66, 84, 15]];
  return `<div class="map">${spots
    .map(([x, y, s]) => `<i style="left:${x}%;top:${y}%;width:${s * 2}px;height:${s * 2}px"></i>`)
    .join("")}</div>`;
}
function rows(items) {
  return items.map((t) => `<div class="row">${t}</div>`).join("");
}
function button(label, color = "#143a29") {
  return `<div class="btn" style="background:${color}">${label}</div>`;
}

async function renderSketches() {
  mkdirSync(work, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 240, height: 420 }, deviceScaleFactor: 2 });
  const files = {};
  for (const [name, { title, body }] of Object.entries(sketches)) {
    await page.setContent(`<style>
      body{margin:0;font:600 15px ui-monospace,Menlo,monospace;background:#f7f9f7;color:#171b18}
      header{padding:22px 16px 12px;font-size:22px;font-weight:800;border-bottom:1px solid #d7dad7}
      .row{margin:10px 14px;padding:12px;background:#fff;border:1px solid #ccd3cc;border-radius:6px}
      .btn{margin:16px 14px;padding:14px;color:#fff;text-align:center;border-radius:6px}
      .map{position:relative;height:340px;background:linear-gradient(135deg,#dce9f4,#cfe7c7)}
      .map i{position:absolute;border-radius:50%;background:#30a46c;border:2px solid #fff;transform:translate(-50%,-50%)}
      .qr{margin:40px auto 16px;width:150px;height:150px;background:repeating-conic-gradient(#171b18 0 25%,#fff 0 50%) 0 0/30px 30px;border:8px solid #fff;outline:1px solid #ccd3cc}
      p{text-align:center;font-weight:400;font-size:13px}
    </style><header>${title}</header>${body}`);
    const file = join(work, `${name.toLowerCase().replace(/\W+/g, "-")}.png`);
    await page.screenshot({ path: file });
    files[name] = file;
  }
  await browser.close();
  return files;
}

mkdirSync(work, { recursive: true });
const existing = run("project", "list").projects ?? [];
if (existing.some((p) => p.id === project)) {
  console.error(`Project ${project} already exists in ${dataDir}. Use an empty folder.`);
  process.exit(1);
}
run("project", "create", "Harbor Bikes");

const ids = {};
for (const [title, type, parent, status, priority, purpose] of nodes) {
  const args = ["node", "create", "--title", title, "--type", type, "--metadata-json", JSON.stringify(impl[title] ? { purpose, implementation: impl[title] } : { purpose })];
  if (parent) args.push("--parent", ids[parent]);
  const res = inProject(...args);
  const id = res.node?.id ?? res.id;
  ids[title] = id;
  const update = ["node", "update", id, "--status", status];
  if (priority) update.push("--priority", priority);
  inProject(...update);
}


for (const [title, text] of Object.entries(contexts)) {
  const file = join(work, `${ids[title]}.md`);
  writeFileSync(file, text);
  inProject("node", "context", "set", ids[title], "--file", file);
}

const briefFile = join(work, "brief.md");
writeFileSync(briefFile, brief);
inProject("node", "import-markdown", "--file", briefFile, "--title", "Launch brief", "--split-headings", "--max-heading-depth", "2");

for (const [title, file] of Object.entries(await renderSketches())) inProject("image", "add", ids[title], file);

// `boxtown relation` has no --local mode yet, so write the links into the node files.
// The temporary runtimes above have stopped, and the file format is the documented storage.
for (const [from, to, relationship] of links) {
  const file = join(dataDir, "projects", project, "nodes", `${ids[from]}.md`);
  const text = readFileSync(file, "utf8");
  const end = text.indexOf("\n---", 4);
  writeFileSync(file, `${text.slice(0, end)}\nlinks:\n  - target: ${ids[to]}\n    relationship: ${relationship}${text.slice(end)}`);
}

rmSync(work, { recursive: true, force: true });
console.log(`Seeded ${nodes.length} nodes, ${links.length} links and a split brief into ${dataDir}`);
