"use strict";
const groups = {
  adjust: ["light", "contrast", "sat", "temp"],
  effects: ["glow", "rain", "frost"],
  blur: ["blur", "motion"],
  key: ["key"],
};
let panel = "",
  zoom = 1,
  gesture = null;
const lane = $("lane"),
  ink = lane.getContext("2d");
function setPlay(playing) {
  $("preview")
    .querySelector("use")
    .setAttribute("href", playing ? "#i-pause" : "#i-play");
  $("preview").setAttribute(
    "aria-label",
    playing ? "إيقاف المعاينة" : "تشغيل المعاينة",
  );
}
function closeDrawer() {
  panel = "";
  $("motionControls").hidden = true;
  $("drawer").hidden = true;
  picking = compare = false;
  queueFX();
  for (const b of document.querySelectorAll("[data-panel]"))
    b.setAttribute("aria-expanded", "false");
}
function openPanel(b) {
  if (run) return;
  if (panel === b.dataset.panel) {
    closeDrawer();
    return;
  }
  closeDrawer();
  panel = b.dataset.panel;
  b.setAttribute("aria-expanded", "true");
  $("drawerTitle").textContent = b.lastElementChild.textContent;
  $("drawer").hidden = false;
  $("cuts").hidden = panel !== "cut";
  $("mediaTools").hidden = panel !== "media";
  layerPanel();
  window.MotionBench?.refresh();
  const ids = groups[panel];
  $("fxTools").hidden = !ids;
  if (ids) {
    if (!ids.includes(tool)) tool = ids[0];
    for (const n of $("fxlist").children)
      n.hidden = !ids.includes(n.dataset.id);
    refreshFX();
  }
}
for (const b of document.querySelectorAll("[data-panel]"))
  b.onclick = () => openPanel(b);
$("dismiss").onclick = closeDrawer;
$("closeResult").onclick = () => {
  $("out").pause();
  $("result").hidden = true;
  $("render").focus();
};
async function full() {
  const viewer = document.querySelector(".viewer");
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  if (document.body.classList.contains("focus")) {
    document.body.classList.remove("focus");
    return;
  }
  try {
    await viewer.requestFullscreen();
  } catch {
    document.body.classList.add("focus");
  }
}
$("full").onclick = $("exitFull").onclick = full;
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("result").hidden) $("closeResult").click();
  else if (document.body.classList.contains("focus"))
    document.body.classList.remove("focus");
  else closeDrawer();
});
function metrics() {
  const w = lane.clientWidth,
    n = total() || 1,
    pad = 12,
    px = Math.max(0.00001, ((w - pad * 2) * zoom) / n),
    origin =
      pad -
      Math.max(
        0,
        Math.min((zoom - 1) * (w - pad * 2), pos * px - (w - pad * 2) / 2),
      );
  return { w, px, origin };
}
function paintLane() {
  const { w, px, origin } = metrics(),
    h = lane.clientHeight;
  if (!w || !h) return;
  const dp = Math.min(2, devicePixelRatio || 1);
  if (lane.width !== Math.round(w * dp) || lane.height !== Math.round(h * dp)) {
    lane.width = Math.round(w * dp);
    lane.height = Math.round(h * dp);
  }
  ink.setTransform(dp, 0, 0, dp, 0, 0);
  ink.clearRect(0, 0, w, h);
  const n = total(),
    playX = origin + px * pos;
  $("head").style.left = playX + "px";
  lane.setAttribute("aria-valuemax", String(n));
  lane.setAttribute("aria-valuenow", pos.toFixed(2));
  ink.font = "10px ui-monospace,monospace";
  ink.textAlign = "left";
  ink.direction = "ltr";
  const target = 52 / px,
    mag = 10 ** Math.floor(Math.log10(target)),
    tick = ([1, 2, 5, 10].find((i) => i * mag >= target) || 10) * mag;
  for (
    let i = Math.max(0, Math.floor(-origin / px / tick) - 1);
    i * tick <= n + 1e-6;
    i++
  ) {
    const x = origin + i * tick * px;
    if (x > w) break;
    ink.fillStyle = "#aaaaad";
    ink.fillText(stamp(i * tick).slice(0, tick < 1 ? -1 : -3), x + 2, 13);
    ink.fillStyle = "#57595a";
    for (let k = 0; k < 4; k++)
      ink.fillRect(x + (k * tick * px) / 4, 19, 1, k ? 2 : 4);
  }
  let t = 0;
  const y = 26,
    hh = h - y - 6;
  pieces.forEach((s, i) => {
    const left = origin + t * px,
      width = length(s) * px;
    t += length(s);
    if (left > w || left + width < 0) return;
    ink.save();
    ink.beginPath();
    ink.rect(left + 1, y, Math.max(0, width - 2), hh);
    ink.clip();
    ink.fillStyle = "#37433f";
    ink.fillRect(left, y, width, hh);
    const step = Math.max(44, hh * 1.55),
      first = Math.max(0, Math.floor(-left / step));
    for (let k = first; k * step < width && left + k * step < w; k++) {
      const im = assets.get(s[3])?.thumb;
      if (im && (im.width || im.naturalWidth))
        ink.drawImage(im, left + k * step, y, step, hh);
    }
    ink.fillStyle = "#0c1013aa";
    ink.fillRect(left + 5, y + 5, 24, 15);
    ink.fillStyle = "#f8f3ea";
    ink.fillText(String(i + 1).padStart(2, "0"), left + 10, y + 16);
    ink.restore();
    ink.strokeStyle = i === active ? "#6ce6bd" : "#5c7770";
    ink.lineWidth = i === active ? 2.5 : 1;
    ink.strokeRect(left + 1.5, y + 1, Math.max(0.5, width - 3), hh - 2);
    for (const key of s[4]?.keys || []) {
      if (key.t < s[0] || key.t > s[1]) continue;
      const x = left + (key.t - s[0]) * px;
      ink.save();
      ink.translate(x, y + hh - 7);
      ink.rotate(Math.PI / 4);
      ink.fillStyle = "#b8edda";
      ink.fillRect(-3, -3, 6, 6);
      ink.restore();
    }
  });
  positionRows();
}
function syncDesk() {
  syncLayers();
  const n = total();
  $("duration").textContent = stamp(n);
  $("pieceCount").textContent = ready ? " / " + pieces.length : "";
  $("shortSelection").textContent = ready
    ? "القطعة " + (active + 1) + " من " + pieces.length
    : "لا يوجد مقطع";
  $("zoomLabel").textContent = zoom + "×";
  $("zoomOut").disabled = !ready || zoom <= 1 || !!run;
  $("zoomIn").disabled = !ready || zoom >= 8 || !!run;
  for (const b of document.querySelectorAll("[data-panel]"))
    b.disabled = !!run || (!ready && b.dataset.panel !== "media");
  lane.setAttribute("aria-disabled", String(!ready || !!run));
}
for (const [id, factor] of [
  ["zoomIn", 2],
  ["zoomOut", 0.5],
])
  $(id).onclick = () => {
    zoom = Math.max(1, Math.min(8, zoom * factor));
    syncDesk();
    paintLane();
  };
lane.onpointerdown = (e) => {
  if (!ready || run) return;
  const { origin, px } = metrics();
  gesture = {
    x: e.clientX,
    pos,
    px,
    moved: false,
    t: (e.clientX - lane.getBoundingClientRect().left - origin) / px,
  };
  lane.setPointerCapture(e.pointerId);
};
lane.onpointermove = (e) => {
  if (!gesture) return;
  const dx = e.clientX - gesture.x;
  if (Math.abs(dx) > 3) gesture.moved = true;
  if (gesture.moved)
    move(
      zoom === 1 ? gesture.t + dx / gesture.px : gesture.pos - dx / gesture.px,
    );
};
lane.onpointerup = () => {
  if (gesture && !gesture.moved) move(gesture.t);
  gesture = null;
};
lane.onpointercancel = () => (gesture = null);
lane.onkeydown = (e) => {
  const step = e.shiftKey ? 1 : 0.05;
  if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
    e.preventDefault();
    move(
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? total()
          : pos + (e.key === "ArrowRight" ? step : -step),
    );
  }
};
new ResizeObserver(paintLane).observe(lane);
