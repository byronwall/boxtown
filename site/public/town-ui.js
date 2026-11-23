// Wires the live maps on the page: the hero explorer, the scroll story, and the agent terminal.
import { STATUS, TownMap } from "./town-map.js";

const town = await fetch("demo/town.json").then((r) => r.json());
// Drawn icons, one stroke weight, instead of text glyphs.
const ICON = {
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  minus: '<path d="M3.5 8h9"/>',
  plus: '<path d="M3.5 8h9M8 3.5v9"/>',
};
const icon = (name) => `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" class="ic">${ICON[name]}</svg>`;
const byId = new Map(town.nodes.map((n) => [n.id, n]));
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Small Markdown renderer for node context: headings, lists, bold, italic, code.
function md(src) {
  const inline = (s) =>
    esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*]+)\*/g, "<i>$1</i>");
  let html = "", list = null;
  const close = () => { if (list) html += `</${list}>`; list = null; };
  for (const line of src.split("\n")) {
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)/))) { close(); html += `<h${m[1].length + 3}>${inline(m[2])}</h${m[1].length + 3}>`; }
    else if ((m = line.match(/^(-|\d+\.)\s+(.*)/))) {
      const tag = m[1] === "-" ? "ul" : "ol";
      if (list !== tag) { close(); html += `<${tag}>`; list = tag; }
      html += `<li>${inline(m[2])}</li>`;
    } else if (line.trim()) { close(); html += `<p>${inline(line)}</p>`; }
    else close();
  }
  close();
  return html;
}

// Keep the boxes clear of the inspector: it sits on the right on wide screens, at the bottom on phones.
function inset(aside, map) {
  const stage = aside.parentElement.getBoundingClientRect(), r = aside.getBoundingClientRect();
  const open = !aside.hidden;
  const side = open && r.width < stage.width * 0.6;
  map.inset = { right: side ? stage.right - r.left + 8 : 0, bottom: open && !side ? stage.bottom - r.top + 8 : 0 };
  map.fit();
}

// Context often opens with a heading that repeats the box title; the panel already shows it.
function dropTitle(src, label) {
  const [first, ...rest] = src.split("\n");
  return /^#+\s/.test(first) && first.replace(/^#+\s+/, "").trim() === label ? rest.join("\n") : src;
}

const LINK_WORDS = { dependency: ["Depends on", "Needed by"], reuse: ["Reuses", "Reused by"], related: ["Related to", "Related to"] };

function inspect(aside, map, id) {
  aside.hidden = !id;
  if (!id) return inset(aside, map);
  const n = byId.get(id);
  const st = STATUS[map.status[id] ?? n.status][0];
  const kids = map.kids.get(id) ?? [];
  const links = town.links.filter((l) => l.from === id || l.to === id);
  const chip = (x) => `<button type="button" data-go="${x}">${esc(byId.get(x).label)}</button>`;
  const path = [];
  for (let p = n.parent; p; p = byId.get(p).parent) path.unshift(chip(p));
  aside.innerHTML = `
    <div class="in-head"><h3>${esc(n.label)}</h3><button type="button" class="in-close" aria-label="Close details">${icon("close")}</button></div>
    <p class="in-meta"><span class="dot" style="--f:${STATUS[map.status[id] ?? n.status][1]}"></span>${st} · ${n.type}${n.priority ? ` · ${n.priority[0].toUpperCase()}${n.priority.slice(1)} priority` : ""}</p>
    ${path.length ? `<p class="in-path">In ${path.join(" › ")}</p>` : ""}
    ${n.purpose ? `<h4>Purpose</h4><p>${esc(n.purpose)}</p>` : ""}
    ${n.implementation ? `<h4>Implementation</h4><p>${esc(n.implementation)}</p>` : ""}
    ${n.context ? `<h4>Context</h4><div class="in-md">${md(dropTitle(n.context, n.label))}</div>` : ""}
    ${n.image ? `<h4>Image</h4><img src="${n.image}" alt="Sketch attached to ${esc(n.label)}" width="240" height="420" loading="lazy">` : ""}
    ${kids.length ? `<h4>Inside (${kids.length})</h4><p class="in-chips">${kids.map(chip).join("")}</p>` : ""}
    ${links.length ? `<h4>Links</h4><ul class="in-links">${links.map((l) => `<li><span>${LINK_WORDS[l.rel][l.from === id ? 0 : 1]}</span> ${chip(l.from === id ? l.to : l.from)}</li>`).join("")}</ul>` : ""}`;
  aside.scrollTop = 0;
  inset(aside, map);
}

// One explorer: toolbar, map, isolate chip, inspector, legend. Returns the map.
const legendHtml =
  `<span class="lg-type">${Object.entries(town.types).map(([t, c]) => `<span><i style="--f:${c}"></i>${t}</span>`).join("")}</span>` +
  `<span class="lg-status">${Object.values(STATUS).slice(0, 5).map(([l, c, s]) => `<span><i style="--f:${c}">${s}</i>${l}</span>`).join("")}</span>`;

function chrome(root, { inspector = true, toolbar = true } = {}) {
  root.insertAdjacentHTML(
    "afterbegin",
    `${toolbar ? `<div class="ex-bar">
      <span class="bar-label">Depth</span>
      <div class="seg" data-key="depth" role="group" aria-label="Depth"><button type="button" data-v="1">1</button><button type="button" data-v="2">2</button><button type="button" data-v="3">3</button><button type="button" data-v="all">Max</button></div>
      <span class="bar-label">Color</span>
      <div class="seg" data-key="color" role="group" aria-label="Color by"><button type="button" data-v="type">Type</button><button type="button" data-v="status">Status</button></div>
      <button type="button" class="tog" data-key="edges">Edges</button>
      <div class="cam" role="group" aria-label="Camera"><button type="button" class="tog" data-act="out" aria-label="Zoom out">${icon("minus")}</button><button type="button" class="tog" data-act="in" aria-label="Zoom in">${icon("plus")}</button><button type="button" class="tog" data-act="fit">Fit</button></div>
    </div>` : ""}
    <div class="ex-stage">
      <div class="ex-map"></div>
      <div class="iso-chip" hidden>Isolated: <b></b><button type="button" aria-label="Show the whole map">${icon("close")}</button></div>
      ${inspector ? '<aside class="inspector" hidden aria-live="polite"></aside>' : ""}
    </div>
    <div class="legend">${legendHtml}<b class="lg-caption" aria-live="polite"></b></div>`,
  );
}

function explorer(root, opts) {
  chrome(root, opts);
  const aside = root.querySelector(".inspector");
  const chip = root.querySelector(".iso-chip");
  const hint = root.parentElement.querySelector(".ex-hint");
  const legend = root.querySelector(".legend");
  const map = new TownMap(root.querySelector(".ex-map"), town, {
    onSelect: (id) => aside && inspect(aside, map, id),
    onChange: (state, event) => {
      if (event === "wheel-hint" && hint) {
        hint.classList.add("flash");
        clearTimeout(hint.t);
        hint.t = setTimeout(() => hint.classList.remove("flash"), 1200);
        return;
      }
      for (const seg of root.querySelectorAll("[data-key]")) {
        const key = seg.dataset.key;
        if (seg.tagName === "BUTTON") seg.setAttribute("aria-pressed", String(!!state[key]));
        else for (const b of seg.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.v === String(state[key])));
      }
      chip.hidden = !state.isolate;
      if (state.isolate) chip.querySelector("b").textContent = byId.get(state.isolate).label;
      legend.dataset.mode = state.color;
      if (aside && !state.selected && !aside.hidden) inspect(aside, map, null);
    },
  });
  root.querySelector(".ex-bar")?.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const seg = b.closest("[data-key]");
    if (b.dataset.act === "fit") map.fit();
    else if (b.dataset.act === "in" || b.dataset.act === "out") map.zoom(b.dataset.act === "in" ? 1.35 : 1 / 1.35, 0.5, 0.5, true);
    else if (seg?.tagName === "BUTTON") map.set({ [seg.dataset.key]: !map.state[seg.dataset.key] }, { fit: false });
    else if (seg) {
      const v = b.dataset.v;
      map.set({ [seg.dataset.key]: /^\d$/.test(v) ? +v : v, ...(seg.dataset.key === "depth" ? { isolate: null } : {}) }, { fit: seg.dataset.key === "depth" });
    }
  });
  chip.querySelector("button").addEventListener("click", () => map.set({ isolate: null }));
  aside?.addEventListener("click", (e) => {
    if (e.target.closest(".in-close")) return map.set({ selected: null }, { fit: false });
    const go = e.target.closest("[data-go]")?.dataset.go;
    if (!go) return;
    if (!map.layout()[go]) map.set({ isolate: null, depth: "all" });
    map.set({ selected: go, focus: null }, { fit: false });
    inspect(aside, map, go);
  });
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (map.state.selected) map.set({ selected: null }, { fit: false });
    else if (map.state.isolate) map.set({ isolate: null });
  });
  map.onChange(map.state);
  return map;
}

// Hero
const hero = explorer(document.querySelector("#explorer"));

// Story: each step sets the sticky map's state as it scrolls into view.
const storyRoot = document.querySelector("#story-map");
const story = explorer(storyRoot);
const storyAside = storyRoot.querySelector(".inspector");
const base = { depth: "all", isolate: null, color: "type", edges: false, selected: null, focus: null };
const steps = {
  districts: { depth: 1 },
  blocks: { depth: 2 },
  rooms: {},
  neighbors: { focus: [...story.subtree("area-ride")] },
  streets: { edges: true, focus: ["component-end-ride-button", "module-dock-sensor-feed", "module-rebalancing-queue", "component-reserve-button", "page-unlock", "assembly-return-nearby", "assembly-station-pins", "assembly-plan-picker", "page-wallet"] },
  inside: { isolate: "area-find-a-bike" },
  spec: { isolate: "area-ride", selected: "page-active-ride" },
  status: { color: "status" },
};
let current = null;
const stepEls = [...document.querySelectorAll(".step")];
function go(step) {
  if (step === current) return;
  current = step;
  stepEls.forEach((s) => s.classList.toggle("is-active", s.dataset.step === step));
  const el = stepEls.find((s) => s.dataset.step === step);
  storyRoot.querySelector(".lg-caption").textContent = `${stepEls.indexOf(el) + 1}/${stepEls.length} · ${el.querySelector("h3").textContent}`;
  story.set({ ...base, ...steps[step] });
  inspect(storyAside, story, steps[step].selected ?? null);
}
const io = new IntersectionObserver(
  (entries) => {
    const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (hit) go(hit.target.dataset.step);
  },
  // On phones the sticky map covers the top half, so read steps from the lower part of the screen.
  { rootMargin: matchMedia("(max-width: 1100px)").matches ? "-64% 0px -16% 0px" : "-40% 0px -40% 0px", threshold: [0, 0.5, 1] },
);
stepEls.forEach((s) => io.observe(s));
go("districts");

// Agent terminal: run real recorded commands; the last one changes the map.
const term = document.querySelector("#terminal");
const screen = term.querySelector(".term-screen");
const agentMap = explorer(document.querySelector("#agent-map"), { toolbar: false });
const agentStart = { ...base, isolate: "area-ride", color: "status" };
agentMap.set(agentStart);
let running = false;
async function run(i) {
  if (running) return;
  running = true;
  term.setAttribute("aria-busy", "true");
  term.querySelectorAll("[data-run]").forEach((b) => (b.disabled = true));
  const { cmd, out, sets } = town.terminal[i];
  const block = document.createElement("div");
  block.className = "term-block";
  block.innerHTML = `<div class="term-cmd"><span class="p">$</span> <span class="typed"></span></div><pre class="term-out"></pre>`;
  screen.append(block);
  const typed = block.querySelector(".typed");
  const fast = matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (let k = 1; k <= cmd.length; k += fast ? cmd.length : 2) {
    typed.textContent = cmd.slice(0, k);
    screen.scrollTop = screen.scrollHeight;
    await new Promise((r) => setTimeout(r, 12));
  }
  typed.textContent = cmd;
  block.querySelector(".term-out").textContent = out;
  screen.scrollTop = screen.scrollHeight;
  term.querySelectorAll("[data-run]")[i].classList.add("ran");
  term.querySelectorAll("[data-run]").forEach((b) => (b.disabled = false));
  term.removeAttribute("aria-busy");
  if (sets) {
    agentMap.setStatus(sets.id, sets.status);
    agentMap.set({ selected: sets.id }, { fit: false });
    term.querySelector(".term-note").hidden = false;
    screen.scrollTop = screen.scrollHeight;
  }
  running = false;
}
term.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.run) run(+b.dataset.run);
  if (b.dataset.act === "reset") {
    screen.replaceChildren();
    agentMap.status = {};
    term.querySelectorAll(".ran").forEach((x) => x.classList.remove("ran"));
    term.querySelector(".term-note").hidden = true;
    agentMap.set(agentStart);
  }
});

window.boxtown = { hero, story, agentMap }; // for the site check script
