"use strict";
(() => {
  const { templates, lessons, groups: toolGroups } = StudioCatalog,
    icon = (n) =>
      `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`,
    esc = (s) =>
      String(s).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      ),
    page = $("homeContent"),
    hub = $("dashboard"),
    app = document.querySelector(".app"),
    dialog = $("hubDialog");
  const routes = {
    home: ["home", "الرئيسية"],
    projects: ["folder", "مشاريعي"],
    templates: ["grid", "القوالب"],
    tools: ["box", "صندوق الأدوات"],
    lessons: ["book", "دليل التعلّم"],
    prefs: ["gear", "الإعدادات"],
  };
  let route = "home",
    recents = [],
    session = null,
    busy = false,
    fromEditor = false,
    storeError = false,
    theme = "jade",
    quality = "920";
  try {
    theme = localStorage.getItem("mx-theme") || theme;
    quality = localStorage.getItem("mx-preview") || quality;
  } catch {}
  function preferences() {
    document.body.classList.toggle("violet", theme === "violet");
    window.previewLimit = Number(quality) || 920;
    try {
      localStorage.setItem("mx-theme", theme);
      localStorage.setItem("mx-preview", quality);
    } catch {}
  }
  preferences();
  function toast(msg) {
    const el = $("hubToast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (el.hidden = true), 4400);
  }
  const btn = (cmd, ico, text, cls = "") =>
    `<button class="${cls}" data-action="${cmd}">${icon(ico)}<span>${text}</span></button>`;
  const link = (cmd, text) =>
    `<button class="textLink" data-action="${cmd}">${text}${icon("chev")}</button>`;
  const heading = (name, sub = "", action = "") =>
    `<header class="blockHead"><div><h2>${name}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${action}</header>`;
  function nav() {
    const item = ([k, [i, n]]) =>
      `<button data-action="route:${k}" ${route === k ? 'aria-current="page"' : ""}>${icon(i)}<span>${n}</span></button>`;
    $("mainNav").innerHTML = Object.entries(routes).map(item).join("");
    $("mobileNav").innerHTML = Object.entries(routes)
      .filter(([k]) => k !== "prefs")
      .map(item)
      .join("");
    $("crumbTitle").textContent = routes[route][1];
  }
  function templateGrid() {
    return `<div class="templateGrid">${templates.map(({ id, name, category, art, ratio }) => `<button class="templateCard" data-action="template:${id}"><div class="thumb"><img src="media/${art}.jpg" alt="" loading="lazy"><b dir="ltr">${ratio}</b></div><div class="templateInfo"><div><strong>${name}</strong><small>${category}</small></div><span>${icon("arrow")}</span></div></button>`).join("")}</div>`;
  }
  const previewProject = (m, del = false) =>
    `<div class="projectRow"><button data-action="open:${m.id}"><img src="${m.cover}" alt=""><span><strong>${esc(m.name)}</strong><small>${new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(m.date)} · ${Math.round(m.duration)} ث</small></span><code>${m.size.join(" × ")}</code>${icon("chev")}</button>${del ? btn("delete:" + m.id, "trash", "حذف", "deleteProject") : ""}</div>`;
  function sample() {
    return `<button class="demoRow" data-action="demo"><img src="media/ridge.jpg" alt=""><span><strong>جولة في المحرر</strong><small>مقطع تعليمي جاهز للتجربة</small></span><b>٦ ث</b>${icon("play")}</button>`;
  }
  function lessonList() {
    return `<div class="lessonList">${lessons.map(([id, i, n, category], idx) => `<button data-action="lesson:${id}"><span class="lessonNo">0${idx + 1}</span><span><small>${category}</small><strong>${n}</strong></span>${icon("chev")}</button>`).join("")}</div>`;
  }
  function home() {
    return `<div class="introLine"><span class="eyebrow"><i></i> لوحة الاستوديو</span><span class="serial" dir="rtl">الاستوديو / ٠١</span></div><article class="heroBanner"><img src="media/studio-hero.jpg" alt="" fetchpriority="high"><div class="heroCopy"><div class="heroTag"><i></i> استوديو الفيديو</div><h1>مساحة المونتاج<span>.</span></h1><p>أنشئ مشروعك، رتّب مشاهدك، واصنع قصتك.</p><div class="heroButtons">${btn("new", "plus", "مشروع جديد", "bright")}${btn("route:projects", "folder", "فتح مشروع", "frosted")}</div></div></article><div class="shortcutGrid">${[
      ["import", "in", "استيراد الوسائط", "ابدأ بفيديو من جهازك", "mint"],
      ["route:tools", "box", "صندوق الأدوات", "تحرير، تحريك ومؤثرات", "purple"],
      [
        "route:lessons",
        "book",
        "دليل التعلّم",
        "خطوات عملية للمونتاج",
        "peach",
      ],
    ]
      .map(
        ([a, i, n, d, c]) =>
          `<button class="shortcut ${c}" data-action="${a}"><i>${icon(i)}</i><span><strong>${n}</strong><small>${d}</small></span>${icon("chev")}</button>`,
      )
      .join(
        "",
      )}</div><section class="dashBlock">${heading("قوالب البداية", "اختر مقاسًا ومشهدًا، ثم عدّلهما بأسلوبك.", link("route:templates", "كل القوالب"))}${templateGrid()}</section><section class="dashBlock">${heading("المشاريع الأخيرة", "", link("route:projects", "مكتبة المشاريع"))}${
      recents.length
        ? recents
            .slice(0, 3)
            .map((m) => previewProject(m))
            .join("")
        : `<p class="fine">${storeError ? "تخزين المشاريع غير متاح في هذا المتصفح." : "لم تحفظ مشروعًا بعد. جرّب المحرر بمقطع جاهز."}</p>${sample()}`
    }</section>`;
  }
  function preferencesPage() {
    return `${heading("إعدادات الاستوديو", "تُحفظ تفضيلاتك على هذا الجهاز.")}<div class="settingList"><label><span>${icon("palette")}لون التمييز</span><select id="themePref"><option value="jade">فيروزي</option><option value="violet">بنفسجي</option></select></label><label><span>${icon("screen")}جودة المعاينة</span><select id="qualityPref"><option value="480">خفيفة</option><option value="920">متوازنة</option><option value="1280">عالية</option></select></label><div><span>${icon("book")}لغة الواجهة</span><b>العربية</b></div><div><span>${icon("folder")}موقع حفظ المشاريع</span><b>تخزين المتصفح المحلي</b></div></div>${heading("الخصوصية والمساعدة")}<div class="settingList"><p>تبقى الوسائط والمشاريع في هذا المتصفح ولا تُرفع إلى خادم. مسح بيانات الموقع يزيل المشاريع المحفوظة. ملف الفيديو المُصدّر يبقى في تنزيلات الجهاز.</p>${btn("route:lessons", "book", "فتح دليل الاستخدام", "softButton")}</div>`;
  }
  function toolsPage() {
    let i = 0;
    return `${heading("صندوق الأدوات", "افتح أدوات المحرر المتاحة، أو اطّلع على خصائص الأدوات القادمة.")}<div class="toolSearch">${icon("search")}<input id="toolQuery" placeholder="ابحث عن أداة…" aria-label="البحث في الأدوات"></div>${toolGroups.map(([g, tools]) => `<section class="toolGroup"><h3>${g}</h3><div class="catalogGrid">${tools.map(([name, ico, target]) => `<button data-action="tool:${i++}">${icon(ico)}<span>${name}<small class="${target ? "yes" : ""}">${target ? "متاحة" : "قيد التطوير"}</small></span></button>`).join("")}</div></section>`).join("")}`;
  }
  function draw() {
    nav();
    $("resumeSession")?.remove();
    if (session) {
      const resume = document.createElement("button");
      resume.id = "resumeSession";
      resume.className = "resumeButton";
      resume.textContent = "العودة للمحرر";
      resume.onclick = showEditor;
      $("navSettings").before(resume);
    }
    const views = {
      home,
      projects: () =>
        heading(
          "مكتبة المشاريع",
          "مشاريعك المحفوظة محليًا مرتّبة حسب آخر تعديل.",
          btn("new", "plus", "مشروع جديد", "bright"),
        ) +
        (recents.length
          ? recents.map((m) => previewProject(m, true)).join("")
          : `<div class="emptyState">${icon("folder")}<h3>${storeError ? "التخزين غير متاح" : "لا توجد مشاريع محفوظة بعد"}</h3><p>أنشئ مشروعًا واحفظه من شريط المحرر، وسيظهر هنا.</p></div>`),
      templates: () =>
        heading(
          "قوالب البداية",
          "مشاهد ومقاسات قابلة للتعديل، وليست صور معاينة فقط.",
        ) + templateGrid(),
      tools: toolsPage,
      lessons: () =>
        heading("دليل التعلّم", "دروس قصيرة يمكنك تطبيقها داخل المحرر.") +
        lessonList(),
      prefs: preferencesPage,
    };
    page.innerHTML = views[route]();
    if (route === "prefs") {
      $("themePref").value = theme;
      $("qualityPref").value = quality;
      $("themePref").onchange = (e) => {
        theme = e.target.value;
        preferences();
      };
      $("qualityPref").onchange = (e) => {
        quality = e.target.value;
        preferences();
      };
    }
    if (route === "tools")
      $("toolQuery").oninput = (e) => {
        for (const b of page.querySelectorAll(".catalogGrid button"))
          b.hidden = !b.textContent.includes(e.target.value.trim());
        for (const g of page.querySelectorAll(".toolGroup"))
          g.hidden = ![...g.querySelectorAll("button")].some((b) => !b.hidden);
      };
  }
  function sheet(title, body) {
    $("sheetTitle").textContent = title;
    $("sheetBody").innerHTML = body;
    if (!dialog.open) dialog.showModal();
  }
  function showEditor() {
    hub.hidden = true;
    app.hidden = false;
    frameSize();
    paintLane();
    queueFX();
    $("sessionName").textContent = session?.name || "المحرر";
    document.title = (session?.name || "المحرر") + " · MAX EDITOR";
  }
  async function refresh() {
    try {
      recents = await ProjectLibrary.list();
      storeError = false;
    } catch {
      storeError = true;
      recents = [];
    }
  }
  async function leave() {
    if (run || loading)
      return toast("أوقف التشغيل وانتظر اكتمال الاستيراد أولًا.");
    if (!session) return;
    if (!(await save())) return;
    hub.hidden = false;
    app.hidden = true;
    fromEditor = false;
    route = "home";
    await refresh();
    draw();
    document.title = "MAX EDITOR · استوديو المونتاج";
  }
  async function save() {
    if (run || loading || !session) return false;
    try {
      await ProjectLibrary.save(session.id, session.name);
      return true;
    } catch {
      toast(
        "تعذّر الحفظ المحلي. تحقّق من مساحة الجهاز أو صدّر الفيديو قبل المغادرة.",
      );
      return false;
    }
  }
  async function create(name, t, files = null, native = false) {
    if (!(await ingest(files || ["media/" + t.art + ".mp4"], "replace")))
      throw Error("تعذّر فتح الفيديو؛ جرّب ملفًا محليًا بترميز مدعوم.");
    if (!native) {
      project.w = t.size[0];
      project.h = t.size[1];
    }
    session = {
      id: crypto.randomUUID(),
      name: name.trim() || "مشروع بدون عنوان",
    };
    clearOutput();
    sync();
    showEditor();
  }
  function newSheet(t = templates[0]) {
    sheet(
      "إنشاء مشروع",
      `<form id="newProjectForm" class="newForm"><label>اسم المشروع<input id="projectName" maxlength="70" value="مشروع جديد" required></label><label>قالب البداية<select id="layoutChoice">${templates.map((o) => `<option value="${o.id}" ${o === t ? "selected" : ""}>${o.name} · ${o.ratio}</option>`).join("")}</select></label><label>المقطع الأول<input id="firstSource" type="file" accept="video/*"></label><p class="fine">اترك الملف فارغًا لاستخدام مشهد القالب. يمكنك استبداله أو إضافة مقاطع داخل المحرر.</p><button class="bright">${icon("plus")} إنشاء وفتح المحرر</button></form>`,
    );
    $("newProjectForm").onsubmit = (e) => {
      e.preventDefault();
      const f = $("firstSource").files[0];
      guard(async () => {
        await create(
          $("projectName").value,
          templates.find((t) => t.id === $("layoutChoice").value),
          f ? [f] : null,
        );
        dialog.close();
      });
    };
  }
  async function guard(fn) {
    if (busy) return;
    busy = true;
    document.body.setAttribute("aria-busy", "true");
    try {
      await fn();
    } catch (e) {
      toast(e.message || "تعذّر إتمام العملية.");
    } finally {
      busy = false;
      document.body.removeAttribute("aria-busy");
    }
  }
  async function startEdit(target) {
    if (!session) await create("مشروع تعليمي", templates[0], null, true);
    else showEditor();
    if (target === "export") settings("export");
    else if (target && panel !== target)
      openPanel(document.querySelector(`[data-panel="${target}"]`));
  }
  const flat = toolGroups.flatMap((g) => g[1]);
  async function action(value) {
    const [a, id] = value.split(":");
    if (a === "route") {
      route = id;
      draw();
      document.querySelector(".surface").scrollTop = 0;
      return;
    }
    if (a === "new" || a === "template")
      return newSheet(templates.find((t) => t.id === id));
    if (a === "import") return $("hubImport").click();
    if (a === "demo") {
      await create("رحلة إلى القمم", templates[0], null, true);
      MotionBench.demo();
      return;
    }
    if (a === "open") {
      const m = recents.find((o) => o.id === id);
      await ProjectLibrary.restore(id);
      session = { id, name: m.name };
      showEditor();
      return;
    }
    if (a === "delete") {
      const m = recents.find((o) => o.id === id);
      sheet(
        "حذف المشروع",
        `<p>هل تريد حذف «${esc(m.name)}» ووسائطه المحفوظة محليًا؟</p>${btn("remove:" + id, "trash", "حذف نهائي", "softButton")}`,
      );
      return;
    }
    if (a === "remove") {
      await ProjectLibrary.remove(id);
      if (session?.id === id) session = null;
      dialog.close();
      await refresh();
      draw();
      return;
    }
    if (a === "tool") {
      const [n, i, target, desc] = flat[+id];
      sheet(
        n,
        `<span class="availability ${target ? "yes" : ""}">${target ? "متاحة الآن" : "قيد التطوير"}</span><p>${desc}</p>${target ? btn("edit:" + target, i, "فتح في المحرر", "bright") : '<p class="fine">هذه خصائص مخططة، ولا تُطبّق أي معالجة في هذه النسخة.</p>'}`,
      );
      return;
    }
    if (a === "lesson") {
      const [, i, n, , body] = lessons.find((l) => l[0] === id);
      sheet(
        n,
        `<p>${body}</p>${btn("edit:" + (id === "keys" ? "text" : id), i, "تطبيق في المحرر", "bright")}`,
      );
      return;
    }
    if (a === "edit") {
      dialog.close();
      await startEdit(id);
    }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (b) guard(() => action(b.dataset.action));
  });
  $("navSettings").onclick = () => action("route:prefs");
  $("sheetClose").onclick = () => {
    if (!busy) dialog.close();
  };
  $("hubImport").onchange = (e) => {
    const files = [...e.target.files];
    if (files.length)
      guard(() => create(files[0].name, templates[0], files, true));
    e.target.value = "";
  };
  $("allTools").onclick = () =>
    guard(async () => {
      await leave();
      if (!hub.hidden) await action("route:tools");
    });
  $("backHome").onclick = () => guard(leave);
  $("saveSession").onclick = () =>
    guard(async () => {
      if (await save()) toast("تم حفظ المشروع في مكتبتك.");
    });
  draw();
  refresh().then(draw);
  if (new URLSearchParams(location.search).has("studio"))
    guard(() => action("demo"));
  else if (new URLSearchParams(location.search).has("editor"))
    guard(() => startEdit());
})();
