// Exports the Harbor Bikes demo for the live map on the site: nodes, links, the app's own
// canvas layout at each depth and for each isolated branch, node images, and real CLI output.
// capture.mjs calls this while its viewer is running. It reads layouts from the app's SVG,
// so the site shows the same box positions the app computes.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function exportDemo({ root, base, dataDir, page, encodeWebp }) {
  const out = join(root, "site/public/demo");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "images"), { recursive: true });
  const projectUrl = `${base}/projects/harbor-bikes`;
  const cli = (...args) =>
    execFileSync("node", [join(root, "packages/cli/bin/boxtown.mjs"), ...args, "--local", dataDir, "--project", "harbor-bikes"], {
      cwd: root,
      encoding: "utf8",
    });

  const { project } = JSON.parse(cli("project", "view", "harbor-bikes", "--json"));
  const { nodes, links } = project.spatialMap;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parentOf = new Map(links.filter((l) => l.parentChild).map((l) => [l.target, l.source]));
  const depthOf = (id) => (parentOf.has(id) ? depthOf(parentOf.get(id)) + 1 : 0);

  // Layout: center x, center y, width, height of every visible box, read from the app's canvas.
  async function layout(query) {
    await page.goto(`${projectUrl}?inspector=0${query}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1400);
    return page.evaluate(() => {
      const boxes = {};
      for (const g of document.querySelectorAll("g.spatial-map-node")) {
        const m = g.getAttribute("transform").match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
        const r = g.querySelector("rect.spatial-map-node-body");
        boxes[g.dataset.nodeId] = [+(+m[1]).toFixed(1), +(+m[2]).toFixed(1), +r.getAttribute("width"), +r.getAttribute("height")];
      }
      return boxes;
    });
  }
  const layouts = { all: await layout(""), 1: await layout("&depth=1"), 2: await layout("&depth=2"), 3: await layout("&depth=3") };
  const parents = [...new Set(parentOf.values())];
  layouts.isolate = {};
  for (const id of parents) layouts.isolate[id] = await layout(`&isolate=${id}`);

  // Node images, re-encoded as WebP.
  const images = {};
  for (const n of nodes) {
    const img = n.images?.[0];
    if (!img) continue;
    const png = readFileSync(join(dataDir, "projects/harbor-bikes/images", n.id, img.filename));
    writeFileSync(join(out, "images", `${n.id}.webp`), await encodeWebp(png));
    images[n.id] = `demo/images/${n.id}.webp`;
  }

  // Real CLI output for the agent terminal. `node complete` runs last because it changes the data.
  const strip = (s) => s.split("\n").filter((l) => !/^\[viewer\]|^Using local/.test(l)).join("\n").trimEnd();
  const terminal = [
    { cmd: "boxtown node list --status working --compact", out: strip(cli("node", "list", "--status", "working", "--compact")) },
    { cmd: "boxtown node export-context page-active-ride", out: strip(cli("node", "export-context", "page-active-ride")) },
    {
      cmd: 'boxtown node complete page-active-ride --note "Timer reads the unlock event."',
      out: strip(cli("node", "complete", "page-active-ride", "--note", "Timer reads the unlock event.")),
      sets: { id: "page-active-ride", status: "implemented" },
    },
  ];

  const town = {
    types: Object.fromEntries(project.nodeTypeSchema.map((t) => [t.name, t.color])),
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      status: n.status,
      priority: n.priority ?? null,
      parent: parentOf.get(n.id) ?? null,
      depth: depthOf(n.id),
      purpose: n.metadata?.purpose ?? "",
      implementation: n.metadata?.implementation ?? "",
      context: n.context ?? "",
      image: images[n.id] ?? null,
    })),
    links: links.filter((l) => !l.parentChild).map((l) => ({ from: l.source, to: l.target, rel: l.relationship })),
    layouts,
    terminal,
  };
  if (!byId.size) throw new Error("demo project has no nodes");
  writeFileSync(join(out, "town.json"), JSON.stringify(town));
  console.log(`wrote demo/town.json (${nodes.length} nodes, ${parents.length} isolate layouts)`);
}
