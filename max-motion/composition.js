"use strict";
// Pieces store [source in, source out, effects, asset id, transform]. Layer times are project seconds.
const assets = new Map(),
  stage = document.querySelector(".mediaframe"),
  desk = document.querySelector(".desk");
let project = { w: 0, h: 0, bg: "#000000" },
  layers = [],
  selected = "",
  uid = 0,
  loading = false,
  setting = "",
  hold = null;
const identity = () => ({ x: 50, y: 50, w: 100, h: 100, cropX: 0, cropY: 0 }),
  transform = () => ({ ...identity(), keys: [] });
const clamp = (v, l, h) => Math.max(l, Math.min(h, v)),
  byId = (id) => layers.find((l) => l.id === id);
function projectSize() {
  const a = assets.get(pieces[0]?.[3])?.el;
  return [
    project.w || a?.videoWidth || 800,
    project.h || a?.videoHeight || 450,
  ];
}
function outputSize() {
  const [w, h] = projectSize(),
    n = +$("resolution").value,
    k = Math.min(n ? n / Math.min(w, h) : 1, 3840 / Math.max(w, h));
  return [w, h].map((a) => Math.max(2, Math.round((a * k) / 2) * 2));
}
function frameSize() {
  const [w, h] = projectSize(),
    k = Math.min(stage.clientWidth / w, stage.clientHeight / h);
  fxCanvas.style.width = w * k + "px";
  fxCanvas.style.height = h * k + "px";
}
new ResizeObserver(frameSize).observe(stage);
function canvasPoint(e) {
  const r = fxCanvas.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { x: (e.clientX - r.x) / r.width, y: (e.clientY - r.y) / r.height };
}
function selectVideo(piece) {
  v = assets.get(piece[3]).el;
  wire(v);
}
async function register(file, image = false) {
  const el = document.createElement(image ? "img" : "video"),
    demo = typeof file === "string",
    url = demo ? file : URL.createObjectURL(file),
    id = ++uid;
  if (!image) {
    el.preload = "auto";
    el.playsInline = true;
  }
  try {
    await new Promise((ok, no) => {
      const timer = setTimeout(() => end(false), 12000);
      function end(good) {
        clearTimeout(timer);
        el.onerror = el.onload = el.onloadeddata = null;
        good ? ok() : no(Error("تعذّرت قراءة أحد الملفات"));
      }
      el.onerror = () => end(false);
      el[image ? "onload" : "onloadeddata"] = () => end(true);
      el.src = url;
    });
    if (!image && (!Number.isFinite(el.duration) || el.duration < 0.1))
      throw Error("مدة غير صالحة");
    const thumb = document.createElement("canvas");
    thumb.width = 96;
    thumb.height = 54;
    thumb.getContext("2d").drawImage(el, 0, 0, 96, 54);
    assets.set(id, {
      el,
      url,
      local: !demo,
      image,
      thumb,
      name: demo ? "مقطع تجريبي" : file.name,
    });
    if (!image)
      el.onseeked = () => {
        if (!run) queueFX();
      };
    return id;
  } catch (e) {
    if (!demo) URL.revokeObjectURL(url);
    throw e;
  }
}
function collect() {
  const used = new Set();
  for (const h of [{ pieces, layers }, ...history]) {
    for (const p of h.pieces) used.add(p[3]);
    for (const l of h.layers) used.add(l.asset);
  }
  for (const [id, a] of assets)
    if (!used.has(id)) {
      a.el.pause?.();
      a.el._source?.disconnect();
      a.el.removeAttribute("src");
      a.el.load?.();
      if (a.local) URL.revokeObjectURL(a.url);
      assets.delete(id);
    }
}
async function ingest(files, mode) {
  if (!files.length || run || loading) return;
  loading = true;
  document.querySelector(".app").inert = true;
  try {
    const ids = [];
    for (const f of files)
      ids.push(
        await register(f, mode === "overlay" && f.type.startsWith("image/")),
      );
    const start = mode === "append" ? total() : 0;
    if (mode !== "replace") remember();
    else {
      history = [];
      layers = [];
      pieces = [];
      project = { w: 0, h: 0, bg: "#000000" };
      zoom = 1;
    }
    clearOutput();
    if (mode === "overlay") {
      if (pos >= total() - 0.05) move(0);
      const a = assets.get(ids[0]);
      if (!a.image) a.el.muted = true;
      const l = {
        id: "l" + ++uid,
        kind: "overlay",
        asset: ids[0],
        start: pos,
        dur: Math.min(total() - pos, a.image ? 3 : a.el.duration),
        tr: { ...transform(), w: 40, h: 40 },
      };
      layers.push(l);
      selected = l.id;
    } else {
      for (const id of ids)
        pieces.push([0, assets.get(id).el.duration, null, id, transform()]);
      selected = "";
      ready = true;
      move(start);
    }
    $("slate").hidden = true;
    syncOverlay(pos, false);
    sync();
    closeDrawer();
    if (mode === "overlay")
      openPanel(document.querySelector("[data-panel=overlay]"));
    collect();
  } catch (e) {
    say(e.message);
    collect();
  } finally {
    loading = false;
    document.querySelector(".app").inert = false;
  }
}
$("pick").onclick = $("append").onclick = () => $("appendFiles").click();
$("choose").onclick = () => $("file").click();
for (const [id, mode] of [
  ["file", "replace"],
  ["appendFiles", "append"],
  ["overlayFile", "overlay"],
])
  $(id).onchange = (e) => {
    ingest([...e.target.files], mode);
    e.target.value = "";
  };
function at(tr, t) {
  const keys = tr.keys;
  if (!keys.length) return tr;
  const i = keys.findIndex((k) => k.t >= t);
  if (i === 0) return keys[0];
  if (i < 0) return keys.at(-1);
  const a = keys[i - 1],
    b = keys[i],
    f = (t - a.t) / (b.t - a.t);
  return Object.fromEntries(
    Object.keys(identity()).map((k) => [k, a[k] + (b[k] - a[k]) * f]),
  );
}
function target() {
  const l = byId(selected);
  return l
    ? { tr: l.tr, t: pos - l.start, l }
    : { tr: pieces[active]?.[4], t: pieces[active]?.[0] + pos - base(active) };
}
function writeTransform(change, force = false) {
  const { tr, t } = target();
  if (!tr) return;
  const cur = at(tr, t);
  if (!force && !tr.keys.length) {
    Object.assign(tr, change);
    return;
  }
  const k = { ...identity() };
  for (const name in k) k[name] = cur[name];
  Object.assign(k, change, { t });
  const i = tr.keys.findIndex((f) => Math.abs(f.t - t) < 0.015);
  if (i >= 0) tr.keys.splice(i, 1);
  tr.keys.push(k);
  tr.keys.sort((a, b) => a.t - b.t);
}
function visible(l, t) {
  return t >= l.start - 0.00001 && t < l.start + l.dur;
}
function syncOverlay(t, play) {
  for (const l of layers) {
    if (l.kind !== "overlay") continue;
    const a = assets.get(l.asset);
    if (!a || a.image) continue;
    const el = a.el,
      now = t - l.start;
    if (!visible(l, t)) {
      el.pause();
      continue;
    }
    if (!play) el.pause();
    if (Math.abs(el.currentTime - now) > (play ? 0.15 : 0.018) && !el.seeking)
      el.currentTime = Math.min(el.duration - 0.001, Math.max(0, now));
    if (play && el.paused && !el.ended) el.play().catch(() => {});
  }
}
async function prepareOverlay(t) {
  syncOverlay(t, false);
  await Promise.all(
    layers
      .filter((l) => l.kind === "overlay" && visible(l, t))
      .map((l) => {
        const el = assets.get(l.asset).el;
        return !el.seeking
          ? null
          : new Promise((ok) => {
              const done = () => {
                  clearTimeout(tm);
                  el.removeEventListener("seeked", done);
                  ok();
                },
                tm = setTimeout(done, 1500);
              el.addEventListener("seeked", done);
            });
      }),
  );
}
function imageRect(src, p, w, h) {
  const sw = src.videoWidth || src.naturalWidth || src.width,
    sh = src.videoHeight || src.naturalHeight || src.height,
    cx = (sw * p.cropX) / 200,
    cy = (sh * p.cropY) / 200,
    k = Math.min(w / sw, h / sh),
    dw = ((sw - 2 * cx) * k * p.w) / 100,
    dh = ((sh - 2 * cy) * k * p.h) / 100;
  return [
    cx,
    cy,
    sw - 2 * cx,
    sh - 2 * cy,
    (w * p.x) / 100 - dw / 2,
    (h * p.y) / 100 - dh / 2,
    dw,
    dh,
  ];
}
function drawImage(g, src, p, w, h) {
  const rect = imageRect(src, p, w, h);
  g.drawImage(src, ...rect);
  return rect.slice(4);
}
const fonts = {
  sans: "Tahoma, sans-serif",
  serif: "serif",
  bold: "system-ui, sans-serif",
};
function drawText(g, l, p, w, h) {
  const sz = Math.min(w, h) * 0.085,
    lines = l.text.split("\n").slice(0, 8);
  g.save();
  g.font = `${l.font === "bold" ? 800 : 500} ${sz}px ${fonts[l.font]}`;
  g.direction = "rtl";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const width = Math.max(sz, ...lines.map((s) => g.measureText(s).width)),
    height = lines.length * sz * 1.35;
  g.translate((w * p.x) / 100, (h * p.y) / 100);
  g.scale(p.w / 100, p.h / 100);
  g.fillStyle = l.color;
  if (l.effect === "shadow") {
    g.shadowColor = "#000";
    g.shadowBlur = sz * 0.13;
    g.shadowOffsetY = sz * 0.08;
  }
  lines.forEach((s, i) => {
    const y = (i - (lines.length - 1) / 2) * sz * 1.35;
    if (l.effect === "outline") {
      g.lineJoin = "round";
      g.strokeStyle = "#181818";
      g.lineWidth = sz * 0.1;
      g.strokeText(s, 0, y);
    }
    g.fillText(s, 0, y);
  });
  g.restore();
  return [
    (w * p.x) / 100 - (width * p.w) / 200,
    (h * p.y) / 100 - (height * p.h) / 200,
    (width * p.w) / 100,
    (height * p.h) / 100,
  ];
}
let boxes = [];
function compose(g, w, h, ix, t, exporting) {
  const s = pieces[ix];
  if (!s) return;
  g.clearRect(0, 0, w, h);
  if (project.bg !== "transparent" || exporting) {
    g.fillStyle = project.bg === "transparent" ? "#000" : project.bg;
    g.fillRect(0, 0, w, h);
  }
  const scale = Math.min(
    1,
    Math.max(w, h) / Math.max(v.videoWidth, v.videoHeight),
  );
  const src = FX.render(
    v,
    !exporting && (compare || picking) ? null : s[2],
    Math.max(2, Math.round(v.videoWidth * scale)),
    Math.max(2, Math.round(v.videoHeight * scale)),
    v.currentTime,
  );
  const bounds = [
    { id: "", r: drawImage(g, src, at(s[4], s[0] + t - base(ix)), w, h) },
  ];
  if (!picking || exporting)
    for (const l of layers) {
      if (!visible(l, t)) continue;
      const p = at(l.tr, t - l.start);
      let r;
      if (l.kind === "text") r = drawText(g, l, p, w, h);
      else {
        const el = assets.get(l.asset).el;
        if (el.readyState != null && el.readyState < 2) continue;
        r = drawImage(g, el, p, w, h);
      }
      bounds.push({ id: l.id, r });
    }
  if (!exporting) {
    boxes = bounds;
    if (!run && ["transform", "text", "overlay"].includes(panel)) {
      const b = bounds.find((b) => b.id === selected);
      if (b) {
        const [x, y, bw, bh] = b.r;
        g.strokeStyle = "#ffb197";
        g.lineWidth = Math.max(1, w / 500);
        g.strokeRect(x, y, bw, bh);
        const z = Math.min(w, h) * 0.026;
        g.fillStyle = "#ff916c";
        g.fillRect(x + bw - z / 2, y + bh - z / 2, z, z);
      }
    }
  }
}
function settings(mode) {
  if (run || !ready) return;
  setting = mode;
  const p = mode === "project";
  $("projectFields").hidden = !p;
  for (const el of $("projectFields").querySelectorAll("input,select"))
    el.disabled = !p;
  $("exportFields").hidden = p;
  $("settingTitle").textContent = p ? "إعدادات المشروع" : "إعدادات التصدير";
  $("confirmSettings").textContent = p ? "تطبيق المقاس" : "بدء التصدير";
  const [w, h] = projectSize();
  $("pw").value = w;
  $("ph").value = h;
  $("bg").value = project.bg;
  matchPreset();
  estimate();
  $("settings").showModal();
}
function matchPreset() {
  const val = [$("pw").value, $("ph").value].join(",");
  $("preset").value = [...$("preset").options].some((o) => o.value === val)
    ? val
    : "custom";
}
function estimate() {
  $("qval").value = $("quality").value + " Mbps";
  $("estimate").textContent =
    outputSize().join(" × ") +
    " px · " +
    $("fps").value +
    " fps · نحو " +
    ((total() * (+$("quality").value + 0.128)) / 8).toFixed(1) +
    " MB";
}
$("projectBtn").onclick = () => settings("project");
$("render").onclick = () => settings("export");
$("exitSettings").onclick = () => $("settings").close();
$("preset").onchange = (e) => {
  if (e.target.value !== "custom")
    [$("pw").value, $("ph").value] = e.target.value.split(",");
};
$("swap").onclick = () => {
  [$("pw").value, $("ph").value] = [$("ph").value, $("pw").value];
  matchPreset();
};
$("pw").oninput = $("ph").oninput = matchPreset;
$("fps").onchange = $("resolution").onchange = $("quality").oninput = estimate;
$("settingForm").onsubmit = (e) => {
  e.preventDefault();
  $("settings").close();
  if (setting === "export") {
    start("export");
    return;
  }
  remember();
  clearOutput();
  project = { w: +$("pw").value, h: +$("ph").value, bg: $("bg").value };
  sync();
};
function editStart() {
  remember();
  clearOutput();
  $("undo").disabled = false;
}
const field = (label, html) => `<label>${label}${html}</label>`;
function layerPanel() {
  const pane = $("layerTools"),
    isLayer = ["transform", "text", "overlay"].includes(panel);
  pane.hidden = !isLayer;
  if (!isLayer) return;
  if (panel === "transform") selected = "";
  let l = byId(selected);
  if (panel !== "transform" && l?.kind !== panel) {
    l = layers.filter((n) => n.kind === panel && visible(n, pos)).at(-1);
    selected = l?.id || "";
  }
  const opts = layers.filter((n) => n.kind === panel),
    layer = panel !== "transform";
  pane.replaceChildren();
  const header = document.createElement("div");
  header.className = "layerBar";
  pane.append(header);
  if (layer) {
    const add = document.createElement("button");
    add.className = "minor";
    add.textContent = panel === "text" ? "＋ نص عربي" : "＋ فيديو أو صورة";
    add.onclick = panel === "text" ? addText : () => $("overlayFile").click();
    header.append(add);
    if (opts.length) {
      const sel = document.createElement("select");
      sel.setAttribute("aria-label", "اختيار الطبقة");
      sel.append(new Option("اختيار طبقة", ""));
      for (const n of opts)
        sel.append(
          new Option(
            n.kind === "text" ? n.text : assets.get(n.asset).name,
            n.id,
          ),
        );
      sel.value = selected;
      sel.onchange = () => {
        selected = sel.value || "";
        const n = byId(selected);
        if (n) move(clamp(n.start + 0.001, 0, total()));
        else layerPanel();
      };
      header.append(sel);
    }
    if (!l) {
      const hint = document.createElement("small");
      hint.textContent =
        panel === "text"
          ? "يبدأ النص عند المؤشر."
          : "يبدأ التراكب عند المؤشر، دون صوت.";
      header.append(hint);
      return;
    }
  }
  const box = document.createElement("div");
  box.className = "controlGrid";
  pane.append(box);
  if (l?.kind === "text") {
    box.insertAdjacentHTML(
      "beforeend",
      field(
        "النص",
        '<textarea id="caption" rows="2" maxlength="400"></textarea>',
      ) +
        field(
          "الخط",
          '<select id="font"><option value="sans">نسخي بسيط</option><option value="bold">عريض</option><option value="serif">تقليدي</option></select>',
        ) +
        field("اللون", '<input type="color" id="textColor">') +
        field(
          "تأثير النص",
          '<select id="textFx"><option value="none">بدون</option><option value="shadow">ظل</option><option value="outline">حدّ خارجي</option></select>',
        ),
    );
    for (const [id, key] of [
      ["caption", "text"],
      ["font", "font"],
      ["textColor", "color"],
      ["textFx", "effect"],
    ]) {
      const el = $(id);
      el.value = l[key];
      bindLive(el, (val) => {
        l[key] = val;
        const opt = header.querySelector("select")?.selectedOptions[0];
        if (key === "text" && opt) opt.textContent = val;
        paintRows();
      });
    }
  }
  if (l) {
    box.insertAdjacentHTML(
      "beforeend",
      field(
        "بداية الطبقة (ث)",
        '<input id="layerStart" type="number" step="0.01" min="0">',
      ) +
        field(
          "مدة الطبقة (ث)",
          '<input id="layerDur" type="number" step="0.01" min="0.05">',
        ),
    );
    $("layerStart").value = l.start.toFixed(2);
    $("layerDur").value = l.dur.toFixed(2);
    for (const id of ["layerStart", "layerDur"])
      $(id).onchange = () => {
        editStart();
        l.start = clamp(+$("layerStart").value, 0, total() - 0.05);
        l.dur = clamp(
          +$("layerDur").value,
          0.05,
          Math.min(
            total() - l.start,
            l.asset && !assets.get(l.asset).image
              ? assets.get(l.asset).el.duration
              : Infinity,
          ),
        );
        move(clamp(pos, l.start, l.start + l.dur - 0.001));
      };
  }
  const p = target(),
    curr = at(p.tr, p.t);
  const controls = [
    ["x", "أفقي %", -50, 150],
    ["y", "رأسي %", -50, 150],
    ["w", "العرض %", 5, 300],
    ["h", "الارتفاع %", 5, 300],
  ];
  if (l?.kind !== "text")
    controls.push(
      ["cropX", "اقتصاص الجانبين %", 0, 95],
      ["cropY", "اقتصاص الأعلى والأسفل %", 0, 95],
    );
  for (const [key, label, min, max] of controls) {
    box.insertAdjacentHTML(
      "beforeend",
      field(
        label,
        `<input data-tr="${key}" type="number" min="${min}" max="${max}" step="0.1" value="${curr[key].toFixed(1)}">`,
      ),
    );
    const e = box.lastElementChild.lastElementChild;
    e.onchange = () => {
      editStart();
      writeTransform({ [key]: clamp(+e.value, min, max) });
      sync();
    };
  }
  const actions = document.createElement("div");
  actions.className = "commands";
  pane.append(actions);
  const command = (label, fn, disabled = false) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.disabled = disabled;
    b.onclick = fn;
    actions.append(b);
  };
  const keys = p.tr.keys,
    near = keys.findIndex((k) => Math.abs(k.t - p.t) < 0.015);
  command("◇ " + (near < 0 ? "إضافة كي فريم" : "تحديث كي فريم"), () => {
    editStart();
    writeTransform({}, true);
    sync();
  });
  command(
    "حذف كي فريم",
    () => {
      editStart();
      const last = { ...at(p.tr, p.t) };
      keys.splice(near, 1);
      if (!keys.length) for (const k in identity()) p.tr[k] = last[k];
      sync();
    },
    near < 0,
  );
  if (l)
    command("حذف الطبقة", () => {
      editStart();
      assets.get(l.asset)?.el.pause?.();
      layers = layers.filter((n) => n !== l);
      selected = "";
      sync();
    });
  const note = document.createElement("p");
  note.className = "hint";
  note.textContent = `${keys.length} كي فريم · اسحب العنصر لتحريكه أو مقبض الزاوية لتغيير حجمه. بعد أول مفتاح، يتسجّل التعديل عند المؤشر.`;
  pane.append(note);
  queueFX();
}
function bindLive(el, apply) {
  let dirty = false;
  el.oninput = () => {
    if (!dirty) {
      editStart();
      dirty = true;
    }
    apply(el.value);
    queueFX();
  };
  el.onblur = el.onchange = () => {
    dirty = false;
  };
}
function addText() {
  if (pos >= total() - 0.05) move(0);
  editStart();
  const l = {
    id: "l" + ++uid,
    kind: "text",
    text: "اكتب نصّك هنا",
    font: "bold",
    color: "#ffffff",
    effect: "shadow",
    start: pos,
    dur: Math.min(3, total() - pos),
    tr: transform(),
  };
  layers.push(l);
  selected = l.id;
  sync();
  $("caption").focus();
  $("caption").select();
}
function syncLayers() {
  for (const id of ["projectBtn", "frameprev", "framenext"])
    $(id).disabled = !!run || !ready;
  $("drawer").inert = !!run;
  if (!ready) return;
  const [w, h] = projectSize();
  $("projectLabel").textContent = `${w} × ${h}`;
  $("clipInfo").textContent = assets.get(pieces[active][3]).name;
  frameSize();
  layerPanel();
  paintRows();
}
function paintRows() {
  const rows = $("layerRows");
  rows.replaceChildren();
  for (const l of layers) {
    const row = document.createElement("div"),
      b = document.createElement("button");
    row.className = "timeLayer";
    b.className = l.kind + (l.id === selected ? " chosen" : "");
    b.textContent =
      l.kind === "text" ? "T · " + l.text : "▣ · " + assets.get(l.asset).name;
    b.disabled = !!run;
    b.onclick = () => {
      const btn = document.querySelector(`[data-panel=${l.kind}]`);
      if (panel !== l.kind) openPanel(btn);
      selected = l.id;
      move(clamp(l.start + 0.001, 0, total()));
    };
    row.append(b);
    rows.append(row);
  }
  if (!layers.length) {
    const quick = document.createElement("div");
    quick.className = "quickLayer";
    for (const [id, name] of [
      ["text", "+ مسار نص"],
      ["overlay", "+ مسار تراكب"],
    ]) {
      const b = document.createElement("button");
      b.disabled = !!run;
      b.textContent = name;
      b.onclick = () => {
        if (panel !== id)
          openPanel(document.querySelector(`[data-panel=${id}]`));
        if (id === "text") addText();
        else $("overlayFile").click();
      };
      quick.append(b);
    }
    rows.append(quick);
  }
  positionRows();
}
function positionRows() {
  const rows = $("layerRows"),
    { w, px, origin } = metrics();
  if (!w) return;
  rows.style.marginLeft =
    lane.getBoundingClientRect().left -
    desk.getBoundingClientRect().left -
    parseFloat(getComputedStyle(desk).paddingLeft) +
    "px";
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i],
      b = rows.children[i]?.firstChild;
    if (!b) continue;
    const a = clamp(origin + l.start * px, 0, w),
      end = clamp(origin + Math.min(total(), l.start + l.dur) * px, 0, w);
    b.style.left = (a / w) * 100 + "%";
    b.style.width = Math.max(0, ((end - a) / w) * 100) + "%";
    b.hidden = end <= a;
  }
}
function previewDown(e) {
  if (run || picking || !["transform", "overlay", "text"].includes(panel))
    return;
  const pt = canvasPoint(e),
    x = pt.x * fxCanvas.width,
    y = pt.y * fxCanvas.height,
    rad = (15 * fxCanvas.width) / fxCanvas.clientWidth;
  let hit = [...boxes]
    .reverse()
    .find(
      ({ id, r: [a, b, w, h] }) =>
        (panel === "transform" ? !id : byId(id)?.kind === panel) &&
        x >= a - rad &&
        x <= a + w + rad &&
        y >= b - rad &&
        y <= b + h + rad,
    );
  if (!hit) return;
  selected = hit.id;
  layerPanel();
  const [a, b, w, h] = hit.r,
    { tr, t } = target();
  hold = {
    pt,
    p: { ...at(tr, t) },
    r: hit.r,
    resize:
      Math.abs(x - a - w) <= rad &&
      Math.abs(y - b - h) <= rad &&
      Math.hypot(x - a - w, y - b - h) <
        Math.hypot(x - a - w / 2, y - b - h / 2),
    edited: false,
  };
  fxCanvas.setPointerCapture(e.pointerId);
  e.preventDefault();
}
fxCanvas.onpointerdown = previewDown;
fxCanvas.onpointermove = (e) => {
  if (!hold || run) return;
  const pt = canvasPoint(e),
    dx = pt.x - hold.pt.x,
    dy = pt.y - hold.pt.y;
  if (!hold.edited) {
    if (Math.abs(dx) + Math.abs(dy) < 0.003) return;
    editStart();
    hold.edited = true;
  }
  const p = hold.p;
  writeTransform(
    hold.resize
      ? {
          w: clamp(p.w * (1 + (2 * dx * fxCanvas.width) / hold.r[2]), 5, 300),
          h: clamp(p.h * (1 + (2 * dy * fxCanvas.height) / hold.r[3]), 5, 300),
        }
      : {
          x: clamp(p.x + 100 * dx, -50, 150),
          y: clamp(p.y + 100 * dy, -50, 150),
        },
  );
  queueFX();
};
fxCanvas.onpointerup = fxCanvas.onpointercancel = () => {
  if (hold) {
    hold = null;
    sync();
  }
};
let expandTimer;
desk.addEventListener("pointerdown", (e) => {
  clearTimeout(expandTimer);
  if (
    e.target === lane ||
    e.target === desk ||
    e.target.closest(".trackhead b")
  )
    desk.classList.add("expanded");
  else expandTimer = setTimeout(() => desk.classList.add("expanded"), 220);
});
for (const ev of ["pointerup", "pointercancel", "blur"])
  window.addEventListener(ev, () => {
    clearTimeout(expandTimer);
    desk.classList.remove("expanded");
  });
for (const [id, sign] of [
  ["frameprev", -1],
  ["framenext", 1],
])
  $(id).onclick = () => move(pos + sign / +$("fps").value);
$("png").onclick = async () => {
  const c = document.createElement("canvas");
  [c.width, c.height] = outputSize();
  const g = c.getContext("2d");
  const prev = panel;
  try {
    panel = "";
    await prepareOverlay(pos);
    compose(g, c.width, c.height, active, pos, false);
    const blob = await new Promise((ok) => c.toBlob(ok));
    if (!blob) throw Error();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Max-Motion-frame.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } catch {
    say("تعذّر حفظ الصورة.");
  } finally {
    panel = prev;
    queueFX();
  }
};
sync();
ingest(["media/ridge.mp4"], "replace");
