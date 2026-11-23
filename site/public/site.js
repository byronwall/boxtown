// Boxtown site: header hairline, copy buttons, tour tabs with deep links, screenshot lightbox.

// Header hairline after scroll
const header = document.querySelector(".top");
const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 4);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Copy buttons keep their width; the label swaps in place.
for (const btn of document.querySelectorAll(".copy")) {
  btn.addEventListener("click", async () => {
    const text = btn.closest("[data-copy]").dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    const label = btn.querySelector("span");
    btn.classList.add("done");
    label.textContent = "Copied";
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.classList.remove("done");
      label.textContent = "Copy";
    }, 1400);
  });
}

// Tour tabs: arrows, Home, End, roving tabindex, #tour/<id> in the URL.
const tabs = [...document.querySelectorAll('[role="tab"]')];
const idOf = (tab) => tab.id.replace("tab-", "");
function select(tab, { focus = false, push = true } = {}) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  }
  if (focus) tab.focus();
  if (push) history.replaceState(null, "", `#tour/${idOf(tab)}`);
}
for (const tab of tabs) {
  tab.addEventListener("click", () => select(tab));
  tab.addEventListener("keydown", (e) => {
    const i = tabs.indexOf(tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length], { focus: true });
  });
}
function fromHash() {
  const m = location.hash.match(/^#tour\/([\w-]+)/);
  const tab = m && tabs.find((t) => idOf(t) === m[1]);
  if (!tab) return;
  select(tab, { push: false });
  document.getElementById("tour").scrollIntoView();
}
addEventListener("hashchange", fromHash);
fromHash();

// Lightbox: opens fitted, click zooms at the point, drag pans, arrows step, Esc closes.
const lb = document.querySelector(".lb");
const stage = lb.querySelector(".lb-stage");
const img = stage.appendChild(new Image()); // filled when a screenshot opens
const title = lb.querySelector("#lb-title");
const shots = [];
for (const b of document.querySelectorAll(".shot")) {
  if (!shots.some((s) => s.dataset.full === b.dataset.full)) shots.push(b);
}
let index = 0, opener = null, fit = 1, scale = 1, x = 0, y = 0;

function apply() {
  img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  stage.classList.toggle("zoomed", scale > fit + 0.001);
}
function clamp() {
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  const sw = stage.clientWidth, sh = stage.clientHeight;
  x = w <= sw ? (sw - w) / 2 : Math.min(0, Math.max(sw - w, x));
  y = h <= sh ? (sh - h) / 2 : Math.min(0, Math.max(sh - h, y));
}
function fitView() {
  fit = Math.min(stage.clientWidth / img.naturalWidth, stage.clientHeight / img.naturalHeight);
  scale = fit;
  clamp();
  apply();
}
function zoomAt(target, px, py) {
  const ix = (px - x) / scale, iy = (py - y) / scale;
  scale = target;
  x = px - ix * scale;
  y = py - iy * scale;
  clamp();
  apply();
}
async function show(i) {
  index = (i + shots.length) % shots.length;
  const b = shots[index];
  title.textContent = `${b.dataset.title}  (${index + 1} of ${shots.length})`;
  img.alt = b.querySelector("img").alt;
  // currentSrc is the light or dark file the <picture> chose.
  img.src = b.querySelector("img").currentSrc || b.dataset.full;
  await img.decode().catch(() => {});
  fitView();
}
for (const b of document.querySelectorAll(".shot")) {
  b.addEventListener("click", () => {
    opener = b;
    lb.showModal();
    lb.querySelector(".lb-close").focus();
    show(shots.findIndex((s) => s.dataset.full === b.dataset.full));
  });
}
lb.addEventListener("close", () => opener?.focus());
lb.addEventListener("click", (e) => {
  const act = e.target.closest("button")?.dataset.act;
  if (act === "close") lb.close();
  if (act === "prev") show(index - 1);
  if (act === "next") show(index + 1);
  if (act === "actual") zoomAt(1, stage.clientWidth / 2, stage.clientHeight / 2);
});
lb.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
  if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
});
addEventListener("resize", () => lb.open && fitView());

// Pointer: a click without movement zooms in or back out; a drag pans; a click off the image closes.
let drag = null;
stage.addEventListener("pointerdown", (e) => {
  drag = { sx: e.clientX, sy: e.clientY, x, y, moved: false };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true;
  stage.classList.add("dragging");
  x = drag.x + dx;
  y = drag.y + dy;
  clamp();
  apply();
});
stage.addEventListener("pointerup", (e) => {
  const d = drag;
  drag = null;
  stage.classList.remove("dragging");
  if (!d || d.moved) return;
  const r = stage.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  const onImg = px >= x && py >= y && px <= x + img.naturalWidth * scale && py <= y + img.naturalHeight * scale;
  if (!onImg) return lb.close();
  if (scale > fit + 0.001) fitView();
  else zoomAt(Math.min(2 * fit, Math.max(1.5 * fit, 1)), px, py);
});
