// A live, read-only Boxtown canvas for the site. Box positions come from the app itself
// (demo/town.json, exported by site/scripts/export-demo.mjs), so depth changes and isolation
// move the boxes to the same places the real canvas does.
const NS = "http://www.w3.org/2000/svg";
export const STATUS = {
  planned: ["Planned", "#dfe6df", "P"],
  working: ["Working", "#a9c9ea", "W"],
  "needs-review": ["Needs review", "#efd38e", "?"],
  blocked: ["Blocked", "#eca7a7", "!"],
  implemented: ["Implemented", "#a4d8ae", "I"],
  deprecated: ["Deprecated", "#cfd1cf", "D"],
};
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
};
const ease = (t) => 1 - Math.pow(1 - t, 3);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

function wrap(text, max, lines) {
  const out = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= max || !line) line = next;
    else { out.push(line); line = word; }
  }
  out.push(line);
  if (out.length > lines) { out.length = lines; out[lines - 1] = `${out[lines - 1].slice(0, max - 1)}…`; }
  return out;
}

export class TownMap {
  constructor(host, town, { onSelect, onChange } = {}) {
    this.town = town;
    this.byId = new Map(town.nodes.map((n) => [n.id, n]));
    this.kids = new Map();
    for (const n of town.nodes) if (n.parent) (this.kids.get(n.parent) ?? this.kids.set(n.parent, []).get(n.parent)).push(n.id);
    this.state = { depth: "all", isolate: null, color: "type", edges: false, selected: null, focus: null };
    this.status = {};
    this.onSelect = onSelect ?? (() => {});
    this.onChange = onChange ?? (() => {});
    this.svg = el("svg", { class: "town", role: "img", "aria-label": "Live Boxtown map of the Harbor Bikes demo project" });
    host.append(this.svg);
    this.edgeLayer = el("g", { class: "edges" }, this.svg);
    this.nodeLayer = el("g", { class: "nodes" }, this.svg);
    this.boxes = new Map();
    for (const n of town.nodes) this.boxes.set(n.id, this.#box(n));
    this.view = [0, 0, 1600, 1000];
    this.#bind();
    // The first paint places boxes and camera with no motion; transitions start after it.
    this.svg.classList.add("no-anim");
    this.instant = true;
    this.render(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.svg.classList.remove("no-anim");
      this.instant = false;
    }));
  }

  #box(n) {
    const g = el("g", { class: `box box-${n.type}`, "data-id": n.id, opacity: 0, role: "button", tabindex: -1 }, this.nodeLayer);
    [, , g.w = 120, g.h = 60] = this.town.layouts.all[n.id] ?? [];
    g.rect = el("rect", { class: "body", rx: 2 }, g);
    if (n.image) g.img = el("image", { href: n.image, preserveAspectRatio: "xMidYMin slice" }, g);
    g.label = el("text", { class: "label" }, g);
    g.meta = el("text", { class: "meta" }, g);
    g.count = el("text", { class: "count" }, g);
    g.badge = el("g", { class: "badge" }, g);
    g.badgeDot = el("circle", { r: 7 }, g.badge);
    g.badgeText = el("text", { "text-anchor": "middle", dy: 3 }, g.badge);
    el("title", {}, g).textContent = `${n.label} · ${n.type}`;
    return g;
  }

  // Layout for the current state: isolate wins, then depth.
  layout() {
    const { isolate, depth } = this.state;
    return isolate ? this.town.layouts.isolate[isolate] : this.town.layouts[depth];
  }

  subtree(id) {
    const ids = new Set([id]);
    for (let p = this.byId.get(id)?.parent; p; p = this.byId.get(p).parent) ids.add(p);
    const walk = (x) => (this.kids.get(x) ?? []).forEach((k) => (ids.add(k), walk(k)));
    walk(id);
    return ids;
  }

  set(patch, { fit = true } = {}) {
    const before = this.layout();
    Object.assign(this.state, patch);
    this.render(fit || this.layout() !== before);
    this.onChange(this.state);
  }

  setStatus(id, status) {
    this.status[id] = status;
    const g = this.boxes.get(id);
    g.classList.remove("pulse");
    void g.getBBox();
    g.classList.add("pulse");
    this.render(false);
  }

  fill(n) {
    if (this.state.color === "status") return STATUS[this.status[n.id] ?? n.status][1];
    return this.town.types[n.type] ?? "#ddd";
  }

  render(fit) {
    const lay = this.layout();
    const { selected, focus, edges } = this.state;
    const lit = focus ? new Set(focus) : selected ? this.subtree(selected) : null;
    for (const n of this.town.nodes) {
      const g = this.boxes.get(n.id);
      const box = lay[n.id];
      if (!box) {
        g.removeAttribute("tabindex");
        g.setAttribute("opacity", 0);
        g.style.pointerEvents = "none";
        // Hidden boxes fold into their nearest visible ancestor, so they grow out of it on return.
        let p = n.parent;
        while (p && !lay[p]) p = this.byId.get(p).parent;
        if (p) g.style.transform = `translate(${lay[p][0] - g.w / 2}px, ${lay[p][1] - g.h / 2}px)`;
        continue;
      }
      const [cx, cy, w, h] = box;
      g.w = w; g.h = h;
      g.style.pointerEvents = "";
      if (!g.hasAttribute("tabindex")) g.setAttribute("tabindex", -1);
      g.setAttribute("aria-label", `${n.label}, ${n.type}, ${STATUS[this.status[n.id] ?? n.status][0]}`);
      g.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px)`;
      g.setAttribute("opacity", lit && !lit.has(n.id) ? 0.22 : 1);
      g.classList.toggle("is-selected", n.id === selected);
      this.#paint(g, n, w, h);
    }
    this.#edges(lay, edges);
    // Roving tabindex: one visible box is in the tab order (the selected one, or the first).
    const tabbable = this.boxes.get(selected && lay[selected] ? selected : Object.keys(lay)[0]);
    for (const g of this.boxes.values()) if (g.hasAttribute("tabindex")) g.setAttribute("tabindex", g === tabbable ? 0 : -1);
    if (fit) this.fit(lay);
  }

  #paint(g, n, w, h) {
    g.rect.setAttribute("width", w);
    g.rect.setAttribute("height", h);
    g.rect.style.setProperty("--f", this.fill(n)); // town.css mixes it for each theme
    const pad = Math.max(5, h * 0.07);
    const imgW = g.img && h >= 90 ? Math.min(w * 0.42, h * 0.62) : 0;
    if (g.img) {
      g.img.setAttribute("display", imgW ? "inline" : "none");
      Object.entries({ x: pad, y: pad, width: imgW, height: h - pad * 2 }).forEach(([k, v]) => g.img.setAttribute(k, v));
    }
    const textX = imgW ? imgW + pad + (w - imgW - pad) / 2 : w / 2;
    const textW = w - imgW - pad * 3;
    const fs = Math.max(8.5, Math.min(26, h * 0.17, textW / 6.5));
    const lines = wrap(n.label, Math.max(4, Math.floor(textW / (fs * 0.62))), h > 70 ? 3 : 2);
    g.label.replaceChildren();
    g.label.setAttribute("font-size", fs);
    const top = h * 0.42 - ((lines.length - 1) * fs * 1.12) / 2;
    lines.forEach((t, i) => el("tspan", { x: textX, y: top + i * fs * 1.12, "text-anchor": "middle" }, g.label).append(t));
    const ms = Math.max(7, Math.min(13, h * 0.09));
    Object.entries({ x: textX, y: h - pad - 1, "font-size": ms, "text-anchor": "middle" }).forEach(([k, v]) => g.meta.setAttribute(k, v));
    g.meta.textContent = h >= 64 ? n.type : "";
    const kids = (this.kids.get(n.id) ?? []).length;
    Object.entries({ x: w - pad, y: h - pad - 1, "font-size": ms, "text-anchor": "end" }).forEach(([k, v]) => g.count.setAttribute(k, v));
    g.count.textContent = kids || "";
    const st = STATUS[this.status[n.id] ?? n.status];
    const r = Math.max(4.5, Math.min(8, h * 0.06));
    g.badge.setAttribute("transform", `translate(${pad + r} ${h - pad - r})`);
    g.badgeDot.setAttribute("r", r);
    g.badgeDot.style.setProperty("--f", st[1]);
    g.badgeText.setAttribute("font-size", r * 1.15);
    g.badgeText.textContent = st[2];
  }

  #edges(lay, on) {
    this.edgeLayer.replaceChildren();
    if (!on) return;
    const line = (a, b, cls) => {
      if (!lay[a] || !lay[b]) return;
      el("line", { x1: lay[a][0], y1: lay[a][1], x2: lay[b][0], y2: lay[b][1], class: cls }, this.edgeLayer);
    };
    for (const n of this.town.nodes) if (n.parent) line(n.parent, n.id, "edge parent");
    for (const l of this.town.links) line(l.from, l.to, `edge ${l.rel}`);
  }

  // Camera: fit the visible boxes, animated through the SVG viewBox.
  fit(lay = this.layout()) {
    // With a box selected, frame its branch (ancestors and children) instead of the whole town.
    const sel = this.state.selected && lay[this.state.selected] ? this.subtree(this.state.selected) : null;
    const vals = Object.entries(lay).filter(([id]) => !sel || sel.has(id)).map(([, b]) => b);
    const x0 = Math.min(...vals.map((b) => b[0] - b[2] / 2)), x1 = Math.max(...vals.map((b) => b[0] + b[2] / 2));
    const y0 = Math.min(...vals.map((b) => b[1] - b[3] / 2)), y1 = Math.max(...vals.map((b) => b[1] + b[3] / 2));
    const { width, height } = this.svg.getBoundingClientRect();
    if (!width || !height) return;
    // Fit into the part of the stage that the inspector and isolate chip leave free.
    const { right = 0, bottom = 0 } = this.inset ?? {};
    const top = this.state.isolate ? 44 : 0;
    const aw = Math.max(80, width - right), ah = Math.max(80, height - bottom - top);
    const pad = 24;
    const s = Math.max((x1 - x0 + pad * 2) / aw, (y1 - y0 + pad * 2) / ah);
    this.animate([(x0 + x1) / 2 - (aw * s) / 2, (y0 + y1) / 2 - (ah * s) / 2 - top * s, width * s, height * s]);
  }

  animate(to) {
    cancelAnimationFrame(this.raf);
    const from = this.view, t0 = performance.now(), dur = reduced || this.instant ? 0 : 520;
    const step = (now) => {
      const t = dur ? Math.min(1, (now - t0) / dur) : 1;
      this.view = from.map((v, i) => v + (to[i] - v) * ease(t));
      this.svg.setAttribute("viewBox", this.view.join(" "));
      if (t < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  zoom(factor, px = 0.5, py = 0.5, animated = false) {
    const [x, y, w, h] = this.view;
    const nw = w / factor, nh = h / factor;
    const next = [x + (w - nw) * px, y + (h - nh) * py, nw, nh];
    if (animated) return this.animate(next);
    this.view = next;
    this.svg.setAttribute("viewBox", this.view.join(" "));
  }

  #bind() {
    const svg = this.svg;
    let drag = null, clickTimer = null;
    const idAt = (e) => e.target.closest?.(".box")?.dataset.id ?? null;
    svg.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return; // touch scrolls the page; taps still select
      drag = { x: e.clientX, y: e.clientY, view: [...this.view], moved: false };
    });
    addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      svg.classList.add("panning");
      const k = drag.view[2] / svg.getBoundingClientRect().width;
      this.view = [drag.view[0] - dx * k, drag.view[1] - dy * k, drag.view[2], drag.view[3]];
      svg.setAttribute("viewBox", this.view.join(" "));
    });
    addEventListener("pointerup", () => {
      if (drag?.moved) svg.dataset.dragged = "1";
      drag = null;
      svg.classList.remove("panning");
    });
    svg.addEventListener("click", (e) => {
      if (svg.dataset.dragged) return void delete svg.dataset.dragged;
      const id = idAt(e);
      clearTimeout(clickTimer);
      // Wait briefly so a double-click isolates without selecting first.
      clickTimer = setTimeout(() => {
        this.set({ selected: id, focus: null }, { fit: false });
        this.onSelect(id);
      }, e.detail > 1 ? 0 : 220);
      if (e.detail > 1) clearTimeout(clickTimer);
    });
    svg.addEventListener("dblclick", (e) => {
      const id = idAt(e);
      if (!id || !this.town.layouts.isolate[id]) return;
      this.set({ isolate: id, selected: id, focus: null });
      this.onSelect(id);
    });
    svg.addEventListener("pointerover", (e) => {
      const id = idAt(e);
      if (id === this.hover || this.state.selected || this.state.focus) return;
      this.hover = id;
      const lit = id ? this.subtree(id) : null;
      for (const [bid, g] of this.boxes) if (this.layout()[bid]) g.setAttribute("opacity", lit && !lit.has(bid) ? 0.3 : 1);
    });
    svg.addEventListener("pointerleave", () => {
      this.hover = null;
      if (!this.state.selected && !this.state.focus) this.render(false);
    });
    svg.addEventListener("wheel", (e) => {
      // Plain wheel scrolls the page. Ctrl/Cmd + wheel (and trackpad pinch) zooms the map.
      if (!e.ctrlKey && !e.metaKey) return void this.onChange(this.state, "wheel-hint");
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      this.zoom(Math.exp(-e.deltaY * 0.004), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    }, { passive: false });
    svg.addEventListener("keydown", (e) => {
      const id = e.target.closest?.(".box")?.dataset.id;
      if (!id) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (e.shiftKey && this.town.layouts.isolate[id]) this.set({ isolate: id, selected: id, focus: null });
        else this.set({ selected: id, focus: null }, { fit: false });
        this.onSelect(id);
        this.boxes.get(id).focus();
        return;
      }
      const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
      if (!dir) return;
      e.preventDefault();
      // Move to the nearest visible box in that direction.
      const lay = this.layout(), [cx, cy] = lay[id];
      let best = null, bestScore = Infinity;
      for (const [other, [ox, oy]] of Object.entries(lay)) {
        const dx = ox - cx, dy = oy - cy, along = dx * dir[0] + dy * dir[1];
        if (other === id || along <= 0) continue;
        const score = along + Math.abs(dx * dir[1] + dy * dir[0]) * 2;
        if (score < bestScore) { best = other; bestScore = score; }
      }
      if (!best) return;
      this.boxes.get(id).setAttribute("tabindex", -1);
      const g = this.boxes.get(best);
      g.setAttribute("tabindex", 0);
      g.focus();
    });
    new ResizeObserver(() => this.fit()).observe(svg);
  }
}
