"use strict";

const $ = (x) => document.getElementById(x),
  slider = $("cursor");
let v = $("v"),
  outUrl = "",
  ready = false,
  ctx,
  dest,
  monitor,
  exportFile;
let pieces = [],
  history = [],
  pos = 0,
  active = 0,
  run = null;
const length = (s) => s[1] - s[0],
  total = () => pieces.reduce((n, s) => n + length(s), 0),
  base = (i) => pieces.slice(0, i).reduce((n, s) => n + length(s), 0);
const say = (text) => {
    const el = $("status");
    el.textContent = text;
    el.hidden = !text;
    clearTimeout(say.timer);
    if (text) say.timer = setTimeout(() => (el.hidden = true), 3800);
  },
  stamp = (t) =>
    `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}`;
function locate(t) {
  let off = 0;
  for (let i = 0; i < pieces.length; i++) {
    off += length(pieces[i]);
    if (t < off - 0.000001) return i;
  }
  return pieces.length - 1;
}
function paint() {
  const n = total();
  slider.max = n || 1;
  slider.value = pos;
  $("position").value = stamp(pos);
  $("clock").textContent = stamp(pos);
  paintLane();
}
function sync() {
  const n = total(),
    off = pos - base(active),
    s = pieces[active],
    busy = !!run;
  const cut = ready && !busy && s && off >= 0.05 && length(s) - off >= 0.05;
  for (const id of ["split", "left", "right"]) $(id).disabled = !cut;
  $("del").disabled = !ready || busy || pieces.length < 2;
  $("undo").disabled = busy || !history.length;
  slider.disabled = !ready || busy;
  $("pick").disabled = busy;
  $("render").disabled = !ready || busy;
  $("preview").disabled = !ready || run?.type === "export";
  setPlay(run?.type === "preview");
  $("saving").hidden = run?.type !== "export";
  $("cancel").hidden = run?.type !== "export";
  $("progress").hidden = $("cancel").hidden;
  $("selection").textContent = ready
    ? `قطعة ${active + 1} من ${pieces.length} · إجمالي ${stamp(n)} · اليسار قبل المؤشر، واليمين بعده في القطعة المحددة.`
    : "خط الزمن من اليسار إلى اليمين.";
  syncDesk();
  paint();
  refreshFX();
}
function move(t) {
  if (!ready || run) return;
  compare = false;
  pos = Math.max(0, Math.min(t, total()));
  active = locate(pos);
  selectVideo(pieces[active]);
  v.currentTime = Math.min(
    v.duration - 0.001,
    pieces[active][0] + pos - base(active),
  );
  syncOverlay(pos, false);
  sync();
}
slider.oninput = () => move(+slider.value);
function edit(op) {
  if (!ready || run) return;
  let i = active,
    [l, r] = pieces[i],
    d = base(i),
    cut = l + (pos - d);
  if (op === "undo") {
    if (!history.length) return;
    const h = history.pop();
    pieces = h.pieces;
    pos = h.pos;
    layers = h.layers;
    project = h.project;
    selected = h.selected;
  } else {
    if (op === "del" ? pieces.length < 2 : cut - l < 0.05 || r - cut < 0.05)
      return;
    remember();
    const sub = (a, b) => [a, b, ...structuredClone(pieces[i].slice(2))];
    if (op === "split") pieces.splice(i, 1, sub(l, cut), sub(cut, r));
    if (op === "left") {
      pieces.splice(i, 1, sub(cut, r));
      pos = d;
    }
    if (op === "right") {
      pieces.splice(i, 1, sub(l, cut));
      pos = d + (cut - l) / 2;
    }
    if (op === "del") {
      pieces.splice(i, 1);
      pos = Math.min(d, total());
    }
  }
  clearOutput();
  move(pos);
  say(
    {
      split: "تم التقسيم إلى قطعتين دون حذف.",
      left: "حُذف ما قبل المؤشر من القطعة المحددة.",
      right: "حُذف ما بعد المؤشر من القطعة المحددة.",
      del: "حُذفت القطعة والتحمت القطع الباقية.",
      undo: "تم التراجع واستعادة الحالة السابقة.",
    }[op],
  );
}
for (const id of ["split", "left", "right", "del", "undo"])
  $(id).onclick = () => edit(id);
function clearOutput() {
  if (outUrl) {
    $("out").pause();
    $("out").removeAttribute("src");
    $("out").load();
    URL.revokeObjectURL(outUrl);
  }
  outUrl = "";
  exportFile = null;
  $("result").hidden = true;
}
function recorderType() {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream)
    return "";
  return (
    [
      "video/mp4;codecs=avc1,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((t) => MediaRecorder.isTypeSupported(t)) || ""
  );
}
function wire(el) {
  if (!ctx || el._source) return;
  el._source = ctx.createMediaElementSource(el);
  el._source.connect(monitor);
  el._source.connect(dest);
}
function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    monitor = ctx.createGain();
    monitor.connect(ctx.destination);
    dest = ctx.createMediaStreamDestination();
  }
  wire(v);
  return ctx.resume();
}
function seek(t) {
  if (!v.seeking && Math.abs(v.currentTime - t) < 0.025 && v.readyState >= 2)
    return Promise.resolve();
  return new Promise((ok, no) => {
    const done = () => {
        if (!v.seeking && v.readyState >= 2) {
          clean();
          ok();
        }
      },
      clean = () => {
        clearTimeout(timer);
        v.removeEventListener("seeked", done);
        v.removeEventListener("loadeddata", done);
      },
      timer = setTimeout(() => {
        clean();
        no(Error("تعذّر الانتقال إلى بداية الجزء."));
      }, 4500);
    v.addEventListener("seeked", done);
    v.addEventListener("loadeddata", done);
    v.currentTime = t;
    done();
  });
}
function output(j) {
  const mime = j.rec.mimeType || j.mime,
    blob = new Blob(j.chunks, { type: mime });
  if (!blob.size) {
    say("لم ينتج المتصفح ملفًا.");
    return;
  }
  clearOutput();
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  exportFile = new File([blob], "Max-Motion-Cut." + ext, {
    type: mime.split(";")[0],
  });
  outUrl = URL.createObjectURL(blob);
  $("out").src = outUrl;
  $("download").href = outUrl;
  $("download").download = exportFile.name;
  $("format").textContent =
    ext.toUpperCase() + " · " + Math.round(blob.size / 1024) + " KB";
  $("share").hidden = !navigator.canShare?.({ files: [exportFile] });
  $("result").hidden = false;
  say("تم تصدير القطع بالترتيب.");
  $("closeResult").focus();
}
function stop(message = "", completed = false) {
  const j = run;
  if (!j || j.stopping) return;
  j.stopping = true;
  v.pause();
  syncOverlay(pos, false);
  cancelAnimationFrame(j.raf);
  clearTimeout(j.timer);
  function settled() {
    if (run !== j) return;
    run = null;
    j.stream?.getVideoTracks().forEach((t) => t.stop());
    if (monitor) monitor.gain.value = 1;
    move(j.cursor);
    if (message) say(message);
    if (completed && j.rec) output(j);
  }
  if (j.rec && j.rec.state !== "inactive") {
    j.rec.onstop = settled;
    j.rec.stop();
  } else settled();
}
async function start(type) {
  if (!ready || run) return;
  const mime = recorderType();
  if (type === "export" && !mime) {
    say("هذا المتصفح لا يدعم التصدير.");
    return;
  }
  compare = false;
  const j = (run = {
    type,
    mime,
    chunks: [],
    cursor: pos,
    raf: 0,
    stopping: false,
  });
  sync();
  $("out").pause();
  $("progress").value = 0;
  const alive = () => run === j && !j.stopping;
  // Adjacent source intervals produced by a split need no seek or recording pause.
  const ranges = pieces;
  let elapsed = 0,
    index = 0;
  try {
    if (type === "export") {
      await audio();
      if (!alive()) return;
      const cv = document.createElement("canvas"),
        [w, h] = outputSize();
      cv.width = w;
      cv.height = h;
      j.cv = cv;
      const g = cv.getContext("2d", { alpha: false, willReadFrequently: true });
      j.draw = () => {
        compose(g, cv.width, cv.height, index, pos, true);
        j.stream?.getVideoTracks()[0]?.requestFrame?.();
      };
      j.stream = cv.captureStream(+$("fps").value);
      dest.stream.getAudioTracks().forEach((t) => j.stream.addTrack(t));
      monitor.gain.value = 0;
      j.rec = new MediaRecorder(j.stream, {
        mimeType: mime,
        videoBitsPerSecond: +$("quality").value * 1e6,
        audioBitsPerSecond: 128000,
      });
      j.rec.ondataavailable = (e) => {
        if (e.data.size) j.chunks.push(e.data);
      };
      j.rec.onerror = () => stop("تعذّر ترميز الفيديو.");
    } else if (ctx) await ctx.resume();
    if (!alive()) return;
    say(type === "export" ? "جارٍ تصدير النتيجة…" : "معاينة القطع الباقية…");
    async function segment() {
      if (!alive()) return;
      const [l, r] = ranges[index];
      try {
        selectVideo(ranges[index]);
        pos = elapsed;
        await seek(l);
        await prepareOverlay(pos);
        if (!alive()) return;
        j.nextDraw = l;
        syncOverlay(pos, true);
        j.draw?.();
        if (j.rec?.state === "inactive") {
          j.cv.getContext("2d").getImageData(0, 0, 1, 1);
          j.rec.start(250);
          j.draw();
          await new Promise((resolve) => requestAnimationFrame(resolve));
          if (!alive()) return;
          j.draw();
        } else if (j.rec?.state === "paused") j.rec.resume();
        await v.play();
        if (!alive()) return;
        let moved = v.currentTime,
          mark = performance.now();
        function frame() {
          if (!alive()) return;
          const t = v.currentTime;
          if (t !== moved) {
            mark = performance.now();
            moved = t;
          } else if (performance.now() - mark > 8000) {
            stop("توقّفت قراءة الفيديو؛ أعد المحاولة.");
            return;
          }
          pos = Math.min(
            total(),
            elapsed + Math.max(0, Math.min(length(ranges[index]), t - l)),
          );
          paint();
          $("progress").value = pos / total();
          if (t >= r - 0.008 || v.ended) {
            v.pause();
            elapsed += r - l;
            if (++index >= ranges.length) {
              stop(type === "preview" ? "انتهت المعاينة." : "", true);
              return;
            }
            if (j.rec?.state === "recording") j.rec.pause();
            segment();
            return;
          }
          const period = 1 / (type === "export" ? +$("fps").value : 30);
          if (t + 0.002 < j.nextDraw) {
            j.raf = requestAnimationFrame(frame);
            return;
          }
          // Advance on a regular clock rather than rounding every interval up to a display refresh.
          j.nextDraw +=
            Math.max(1, Math.floor((t - j.nextDraw) / period) + 1) * period;
          try {
            syncOverlay(pos, true);
            j.draw?.();
            if (type === "preview") drawPreview(index);
          } catch (e) {
            stop("تعذّر تطبيق مؤثر: " + e.message);
            return;
          }
          if (alive()) j.raf = requestAnimationFrame(frame);
        }
        frame();
      } catch (e) {
        if (alive()) stop("تعذّر تشغيل الجزء: " + e.message);
      }
    }
    await segment();
  } catch (e) {
    if (alive()) stop("تعذّر بدء العملية: " + e.message);
  }
}
$("preview").onclick = () =>
  run?.type === "preview" ? stop("توقّفت المعاينة.") : start("preview");
$("render").onclick = () => start("export");
$("cancel").onclick = () => stop("أُلغي التصدير.");
document.addEventListener("visibilitychange", () => {
  if (document.hidden && run) stop("توقفت العملية عند مغادرة الصفحة.");
});
$("share").onclick = async () => {
  try {
    await navigator.share({ files: [exportFile] });
  } catch (e) {
    if (e.name !== "AbortError") say("استخدم زرّ التنزيل.");
  }
};
let tool = "glow",
  compare = false,
  picking = false,
  drag = null,
  previewPending = 0;
const fxCanvas = $("fxcanvas"),
  fxG = fxCanvas.getContext("2d");
function remember() {
  history.push({
    pieces: structuredClone(pieces),
    project: { ...project },
    layers: structuredClone(layers),
    selected,
    pos,
  });
  if (history.length > 100) history.shift();
}
function currentFX() {
  return pieces[active]?.[2] || {};
}
function drawPreview(ix = active) {
  if (!ready || v.readyState < 2) return;
  const [w, h] = projectSize(),
    sc = Math.min(1, (window.previewLimit || 920) / Math.max(w, h));
  const cw = Math.max(2, Math.round(w * sc)),
    ch = Math.max(2, Math.round(h * sc));
  if (fxCanvas.width !== cw || fxCanvas.height !== ch) {
    fxCanvas.width = cw;
    fxCanvas.height = ch;
  }
  fxCanvas.hidden = false;
  try {
    compose(fxG, cw, ch, ix, pos, false);
  } catch (e) {
    say("تعذّر رسم الصورة: " + e.message);
    if (run) stop("تعذّرت المعاينة.");
  }
}
function queueFX() {
  cancelAnimationFrame(previewPending);
  previewPending = requestAnimationFrame(() => drawPreview());
}
function refreshFX() {
  const t = FX.schema[tool],
    st = currentFX(),
    vals = st[tool],
    busy = !!run,
    dis = !ready || busy;
  drag = null;
  picking = false;
  $("fxcount").textContent = Object.keys(st).length + " نشط";
  $("fxwhich").textContent = ready
    ? "القطعة " + (active + 1)
    : "اختَر فيديو أولًا";
  $("fxdesc").textContent = t.desc;
  $("fxToggle").disabled = dis;
  $("fxToggle").textContent = vals ? "إزالة " + t.name : "＋ تطبيق " + t.name;
  $("fxCompare").disabled = dis || !Object.keys(st).length;
  $("fxCompare").setAttribute("aria-pressed", String(compare));
  $("fxCompare").textContent = compare ? "عرض التعديل" : "عرض الأصل";
  $("fxreset").disabled = dis || !vals;
  $("pipette").hidden = tool !== "key" || !vals;
  $("pipette").disabled = dis;
  for (const n of $("fxlist").children) {
    n.setAttribute("aria-pressed", String(n.dataset.id === tool));
    n.classList.toggle("on", !!st[n.dataset.id]);
    n.disabled = busy;
  }
  const pane = $("fxparams");
  pane.replaceChildren();
  for (const p of t.params) {
    const label = document.createElement("label"),
      out = document.createElement("output"),
      input = document.createElement("input");
    label.textContent = p.label;
    input.dataset.param = p.key;
    const value = vals?.[p.key] ?? p.init;
    input.type = p.min == null ? "color" : "range";
    if (p.min != null) {
      input.min = p.min;
      input.max = p.max;
      input.step = 1;
    }
    input.value = value;
    input.disabled = dis || !vals;
    out.value = value;
    input.oninput = () => {
      if (drag !== input) {
        remember();
        drag = input;
        clearOutput();
      }
      currentFX()[tool][p.key] = p.min == null ? input.value : +input.value;
      compare = false;
      $("fxCompare").textContent = "عرض الأصل";
      out.value = input.value;
      $("undo").disabled = false;
      queueFX();
    };
    input.onchange = input.onblur = () => {
      drag = null;
    };
    label.append(out, input);
    pane.append(label);
  }
  queueFX();
}
for (const t of FX.tools) {
  const n = document.createElement("button");
  n.dataset.id = t.id;
  n.textContent = t.name;
  n.onclick = () => {
    tool = t.id;
    refreshFX();
  };
  $("fxlist").append(n);
}
$("fxToggle").onclick = () => {
  if (!ready || run) return;
  const s = pieces[active];
  if (!s[2]?.[tool]) {
    try {
      FX.init();
    } catch (e) {
      say("لم يمكن تشغيل محرّك الصورة: " + e.message);
      return;
    }
  }
  remember();
  compare = false;
  if (s[2]?.[tool]) delete s[2][tool];
  else (s[2] ??= {})[tool] = FX.defaults(tool);
  clearOutput();
  sync();
};
$("fxreset").onclick = () => {
  remember();
  pieces[active][2][tool] = FX.defaults(tool);
  compare = false;
  clearOutput();
  sync();
};
$("fxCompare").onclick = () => {
  compare = !compare;
  refreshFX();
};
$("pipette").onclick = () => {
  picking = !picking;
  drawPreview();
  say(
    picking
      ? "المس اللون المطلوب حذفه في الصورة الأصلية."
      : "أُلغي التقاط اللون.",
  );
};
document.querySelector(".viewer").onclick = (e) => {
  if (!picking || !ready || run) return;
  const pt = canvasPoint(e),
    g = fxG;
  if (!pt) return;
  const hex =
    "#" +
    Array.from(
      g
        .getImageData(pt.x * fxCanvas.width, pt.y * fxCanvas.height, 1, 1)
        .data.slice(0, 3),
    )
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
  remember();
  currentFX().key.keyColor = hex;
  picking = compare = false;
  clearOutput();
  sync();
  say("تم التقاط اللون " + hex);
};
v.addEventListener("seeked", queueFX);
v.addEventListener("loadeddata", queueFX);
