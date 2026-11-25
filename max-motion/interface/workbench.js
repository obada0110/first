"use strict";
// The inspector edits the same transform/key arrays used by the renderer and recorder.
window.MotionBench = (() => {
  const pane = $("motionControls"),
    svg = (name) =>
      `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`,
    toolButton = (id) => document.querySelector(`button[data-panel="${id}"]`);
  const modes = {
    position: ["الموقع", "transform", ["x", "y"]],
    size: ["الحجم", "square", ["w", "h"]],
    rotation: ["الدوران", "undo", ["angle"]],
    opacity: ["الشفافية", "blur", ["opacity"]],
  };
  const limits = {
      x: [-50, 150],
      y: [-50, 150],
      w: [5, 300],
      h: [5, 300],
      angle: [-360, 360],
      opacity: [0, 100],
    },
    labels = {
      x: "أفقي",
      y: "رأسي",
      w: "العرض",
      h: "الارتفاع",
      angle: "الزاوية",
      opacity: "العتامة",
    };
  let mode = "position",
    gesture = null;
  pane.innerHTML = `<div class="layerBadge">${svg("layers")}<select id="motionLayer" aria-label="الطبقة النشطة"></select></div><div class="motionTabs" role="group" aria-label="خاصية التحريك">${Object.entries(
    modes,
  )
    .map(
      ([k, [name, i]]) => `<button data-mode="${k}">${svg(i)}${name}</button>`,
    )
    .join(
      "",
    )}</div><div id="motionFields"></div><div id="gesturePad" role="group" aria-label="لوحة التحريك بالسحب"><span class="padTarget">${svg("transform")}</span><b id="padHint"></b></div><div class="keyHead"><b>${svg("diamond")}الإطارات المفتاحية</b><small id="keyCount"></small></div><div class="keyActions" dir="ltr"><button id="keyPrev" aria-label="المفتاح السابق">${svg("prev")}</button><button id="putKey">${svg("diamond")}<span>إضافة مفتاح</span></button><button id="keyNext" aria-label="المفتاح التالي">${svg("next")}</button></div><button id="removeKey" class="keyRemove">حذف المفتاح الحالي</button><p class="keyTip">أضف مفتاحًا، حرّك المؤشر ثم عدّل القيمة. تُحسب الحركة بين المفتاحين تلقائيًا.</p>`;
  const fields = $("motionFields"),
    pad = $("gesturePad");
  function boundedKeys(p) {
    const a = p.l ? 0 : pieces[active][0],
      b = p.l ? p.l.dur : pieces[active][1];
    return p.tr.keys.filter((k) => k.t >= a - 0.001 && k.t <= b + 0.001);
  }
  function activeLayer() {
    const l = byId(selected);
    return !l || visible(l, pos);
  }
  function drawValues() {
    const p = target(),
      cur = at(p.tr, p.t);
    for (const el of fields.querySelectorAll("input"))
      el.value = Number(cur[el.dataset.motion]).toFixed(1);
  }
  function refresh() {
    pane.hidden = panel !== "motionLab";
    if (pane.hidden || !ready) return;
    const p = target(),
      keys = boundedKeys(p),
      now = keys.some((k) => Math.abs(k.t - p.t) < 0.015);
    $("motionLayer").replaceChildren(
      new Option("الفيديو · القطعة " + (active + 1), ""),
      ...layers.map(
        (l) =>
          new Option(
            (l.kind === "text" ? "نص · " : "تراكب · ") +
              (l.text || assets.get(l.asset)?.name || ""),
            l.id,
          ),
      ),
    );
    $("motionLayer").value = selected;
    for (const b of pane.querySelectorAll("[data-mode]"))
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    fields.replaceChildren();
    for (const key of modes[mode][2]) {
      const label = document.createElement("label");
      label.textContent = labels[key] + (key === "angle" ? " °" : " %");
      const el = document.createElement("input");
      el.type = "number";
      el.step = 0.1;
      [el.min, el.max] = limits[key];
      el.dataset.motion = key;
      el.disabled = !activeLayer();
      el.onchange = () => {
        if (!Number.isFinite(el.valueAsNumber)) {
          drawValues();
          return;
        }
        editStart();
        writeTransform({ [key]: clamp(el.valueAsNumber, ...limits[key]) });
        sync();
      };
      label.append(el);
      fields.append(label);
    }
    drawValues();
    $("padHint").textContent = activeLayer()
      ? {
          position: "اسحب لتحريك الطبقة",
          size: "اسحب لتغيير الحجم",
          rotation: "اسحب لتدوير الطبقة",
          opacity: "اسحب لضبط الشفافية",
        }[mode]
      : "المؤشر خارج مدة الطبقة";
    $("keyCount").textContent = keys.length + " مفاتيح";
    $("keyPrev").disabled = !keys.some((k) => k.t < p.t - 0.015);
    $("keyNext").disabled = !keys.some((k) => k.t > p.t + 0.015);
    $("putKey").disabled = !activeLayer();
    $("putKey").lastChild.textContent = now ? "تحديث المفتاح" : "إضافة مفتاح";
    $("removeKey").disabled = !now;
    queueFX();
  }
  $("motionLayer").onchange = (e) => {
    selected = e.target.value;
    const l = byId(selected);
    if (l && !visible(l, pos)) move(l.start);
    else sync();
  };
  pane.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.mode;
        refresh();
      }),
  );
  $("putKey").onclick = () => {
    editStart();
    writeTransform({}, true);
    sync();
  };
  $("removeKey").onclick = () => {
    const { tr, t } = target(),
      i = tr.keys.findIndex((k) => Math.abs(k.t - t) < 0.015);
    if (i < 0) return;
    editStart();
    const [last] = tr.keys.splice(i, 1);
    if (!tr.keys.length) for (const k in identity()) tr[k] = last[k];
    sync();
  };
  for (const [id, sign] of [
    ["keyPrev", -1],
    ["keyNext", 1],
  ])
    $(id).onclick = () => {
      const p = target(),
        keys = boundedKeys(p),
        k =
          sign < 0
            ? keys.filter((k) => k.t < p.t - 0.015).at(-1)
            : keys.find((k) => k.t > p.t + 0.015);
      if (k) move(pos + k.t - p.t);
    };
  pad.onpointerdown = (e) => {
    if (!ready || run || !activeLayer()) return;
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    const p = target();
    gesture = {
      x: e.clientX,
      y: e.clientY,
      p: { ...at(p.tr, p.t) },
      dirty: false,
    };
    pad.classList.add("dragging");
  };
  pad.onpointermove = (e) => {
    if (!gesture || run) return;
    const dx = ((e.clientX - gesture.x) / pad.clientWidth) * 100,
      dy = ((e.clientY - gesture.y) / pad.clientHeight) * 100;
    if (!gesture.dirty) {
      if (Math.abs(dx) + Math.abs(dy) < 1) return;
      editStart();
      gesture.dirty = true;
    }
    const keys = modes[mode][2],
      v = {};
    keys.forEach(
      (k, i) =>
        (v[k] = clamp(
          gesture.p[k] + (i ? dy : dx) * (mode === "rotation" ? 2 : 1),
          ...limits[k],
        )),
    );
    writeTransform(v);
    drawValues();
    queueFX();
  };
  pad.onpointerup = pad.onpointercancel = () => {
    gesture = null;
    pad.classList.remove("dragging");
    sync();
  };
  function path(g, w, h) {
    if (panel !== "motionLab") return;
    const p = target(),
      keys = boundedKeys(p);
    if (keys.length < 2) return;
    g.save();
    g.lineWidth = Math.max(1, w / 450);
    g.strokeStyle = "#76ffd4";
    g.shadowColor = "#101619";
    g.shadowBlur = 2;
    g.setLineDash([w * 0.008, w * 0.006]);
    g.beginPath();
    keys.forEach((k, i) => {
      g[i ? "lineTo" : "moveTo"]((w * k.x) / 100, (h * k.y) / 100);
    });
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = "#72f5c6";
    for (const k of keys) {
      g.beginPath();
      g.arc(
        (w * k.x) / 100,
        (h * k.y) / 100,
        Math.max(2, w * 0.003),
        0,
        Math.PI * 2,
      );
      g.fill();
    }
    g.restore();
  }
  function demo() {
    const make = (text, start, dur, tr, color) => ({
      id: "l" + ++uid,
      kind: "text",
      text,
      start,
      dur,
      color,
      font: "bold",
      effect: "shadow",
      tr,
    });
    const title = make(
      "فوق السحاب",
      0,
      6,
      {
        ...transform(),
        keys: [
          { ...identity(), t: 0.5, x: 35, y: 60, w: 153, h: 153 },
          { ...identity(), t: 4.5, x: 66, y: 38, w: 153, h: 153 },
        ],
      },
      "#ffffff",
    );
    layers.push(
      title,
      make(
        "يوميات الرحلة   /   ٠١",
        0,
        5.6,
        { ...transform(), x: 50, y: 78, w: 56, h: 56 },
        "#e2fff3",
      ),
    );
    selected = title.id;
    move(2);
    openPanel(toolButton("motionLab"));
    refresh();
  }
  const tiles = $("propertyTiles");
  for (const [name, icon, id] of [
    ["تحريك وتحويل", "diamond", "motionLab"],
    ["اللون والإضاءة", "adjust", "adjust"],
    ["النص والخط", "text", "text"],
    ["اقتصاص", "transform", "transform"],
    ["مؤثرات الصورة", "fx", "effects"],
    ["إضافة تراكب", "overlay", "overlay"],
  ]) {
    const b = document.createElement("button");
    b.innerHTML = svg(icon) + name;
    b.onclick = () => openPanel(toolButton(id));
    tiles.append(b);
  }
  $("effectBrowser").onclick = () => {
    if (!ready || run) return;
    const area = $("galleryCards");
    area.replaceChildren();
    for (const fx of FX.tools) {
      const b = document.createElement("button"),
        cv = document.createElement("canvas"),
        g = cv.getContext("2d");
      cv.width = 140;
      cv.height = 78;
      try {
        g.drawImage(
          FX.render(v, { [fx.id]: FX.defaults(fx.id) }, 140, 78, v.currentTime),
          0,
          0,
          140,
          78,
        );
      } catch {
        g.drawImage(assets.get(pieces[active][3]).thumb, 0, 0, 140, 78);
      }
      const label = document.createElement("strong");
      label.textContent = fx.name;
      b.append(cv, label);
      b.onclick = () => {
        const group = Object.keys(groups).find((k) =>
          groups[k].includes(fx.id),
        );
        $("effectsGallery").close();
        if (panel !== group) openPanel(toolButton(group));
        tool = fx.id;
        refreshFX();
      };
      area.append(b);
    }
    $("effectsGallery").showModal();
  };
  $("exitGallery").onclick = () => $("effectsGallery").close();
  const addMenu = $("addMenu");
  $("pick").onclick = () => {
    if (ready && !run) addMenu.showModal();
  };
  $("closeAddMenu").onclick = () => addMenu.close();
  for (const [name, i, fn] of [
    ["مقطع فيديو", "film", () => $("appendFiles").click()],
    ["صورة أو تراكب", "overlay", () => $("overlayFile").click()],
    [
      "نص عربي",
      "text",
      () => {
        if (panel !== "text") openPanel(toolButton("text"));
        addText();
      },
    ],
  ]) {
    const b = document.createElement("button");
    b.innerHTML = svg(i) + name;
    b.onclick = () => {
      addMenu.close();
      fn();
    };
    $("addChoices").append(b);
  }
  function shapeCanvas(type, color) {
    const c = document.createElement("canvas");
    c.width = c.height = 384;
    const g = c.getContext("2d");
    g.translate(192, 192);
    g.fillStyle = color;
    const r = 166;
    g.beginPath();
    if (type === "circle") g.arc(0, 0, r, 0, 2 * Math.PI);
    else if (type === "square") g.rect(-r, -r, r * 2, r * 2);
    else {
      const count = type === "flower" ? 240 : 10;
      for (let n = 0; n < count; n++) {
        const a = (n * Math.PI * 2) / count - Math.PI / 2,
          rad =
            r *
            (type === "flower"
              ? 0.75 + 0.24 * Math.cos(5 * (a + Math.PI / 2))
              : n % 2
                ? 0.44
                : 1);
        g[n ? "lineTo" : "moveTo"](Math.cos(a) * rad, Math.sin(a) * rad);
      }
      g.closePath();
    }
    g.fill();
    return c;
  }
  for (const [id, name] of [
    ["flower", "زهرة"],
    ["star", "نجمة"],
    ["circle", "دائرة"],
    ["square", "مربّع"],
  ]) {
    const b = document.createElement("button");
    b.append(shapeCanvas(id, "#c7bbdf"), document.createTextNode(name));
    b.onclick = async () => {
      const canvas = shapeCanvas(id, $("shapeColor").value);
      addMenu.close();
      try {
        const blob = await new Promise((ok) => canvas.toBlob(ok));
        if (!blob) throw Error();
        if (
          await ingest(
            [new File([blob], name + ".png", { type: "image/png" })],
            "overlay",
          )
        )
          openPanel(toolButton("motionLab"));
      } catch {
        say("تعذّر إضافة الشكل.");
      }
    };
    $("shapeChoices").append(b);
  }
  return { refresh, path, demo };
})();
