// Separate indexes keep listing projects fast: the gallery never reads source videos.
const ProjectLibrary = (() => {
  let dbPromise;
  function database() {
    if (!dbPromise)
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open("max-motion-studio", 1);
        request.onupgradeneeded = () => {
          for (const name of ["meta", "sessions"])
            request.result.createObjectStore(name, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          dbPromise = null;
          reject(request.error);
        };
      });
    return dbPromise;
  }
  async function read(store, id) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tab = db.transaction(store).objectStore(store),
        q = id ? tab.get(id) : tab.getAll();
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
  }
  async function write(meta, session, remove = false) {
    const db = await database();
    return new Promise((ok, no) => {
      const tx = db.transaction(["meta", "sessions"], "readwrite");
      tx.oncomplete = ok;
      tx.onerror = tx.onabort = () => no(tx.error);
      for (const [name, item] of [
        ["meta", meta],
        ["sessions", session],
      ]) {
        const st = tx.objectStore(name);
        if (remove) st.delete(meta.id);
        else st.put(item);
      }
    });
  }
  async function save(id, name) {
    if (!ready || run || loading) throw Error("أوقف المعاينة أولًا.");
    const ids = new Set([
        ...pieces.map((p) => p[3]),
        ...layers.filter((l) => l.asset).map((l) => l.asset),
      ]),
      sources = [...ids].map((key) => {
        const a = assets.get(key);
        return { key, source: a.file || a.url, image: a.image, name: a.name };
      });
    const cv = document.createElement("canvas");
    cv.width = 240;
    cv.height = 135;
    const g = cv.getContext("2d");
    g.fillStyle = "#111619";
    g.fillRect(0, 0, 240, 135);
    const src = fxCanvas.hidden ? assets.get(pieces[0][3]).thumb : fxCanvas,
      k = Math.min(240 / src.width, 135 / src.height);
    g.drawImage(
      src,
      (240 - src.width * k) / 2,
      (135 - src.height * k) / 2,
      src.width * k,
      src.height * k,
    );
    await write(
      {
        id,
        name,
        date: Date.now(),
        duration: total(),
        size: projectSize(),
        cover: cv.toDataURL("image/jpeg", 0.73),
      },
      {
        id,
        version: 1,
        pieces,
        project,
        layers,
        pos,
        sources,
        output: ["resolution", "fps", "quality"].map((n) => $(n).value),
      },
    );
  }
  async function restore(id) {
    const state = await read("sessions", id);
    if (!state || state.version !== 1) throw Error("لا يمكن فتح هذا المشروع.");
    const map = new Map();
    try {
      for (const a of state.sources) {
        const key = await register(a.source, a.image);
        assets.get(key).name = a.name;
        map.set(a.key, key);
      }
      for (const p of state.pieces) p[3] = map.get(p[3]);
      for (const l of state.layers) {
        l.id = "l" + ++uid;
        if (l.asset) {
          l.asset = map.get(l.asset);
          const a = assets.get(l.asset);
          if (!a.image) a.el.muted = true;
        }
      }
      for (const tr of [
        ...state.layers.map((l) => l.tr),
        ...state.pieces.map((p) => p[4]),
      ]) {
        for (const obj of [tr, ...tr.keys]) {
          obj.angle ??= 0;
          obj.opacity ??= 100;
        }
      }
      clearOutput();
      pieces = state.pieces;
      project = state.project;
      layers = state.layers;
      history = [];
      selected = "";
      ready = true;
      zoom = 1;
      state.output?.forEach(
        (v, i) => ($(["resolution", "fps", "quality"][i]).value = v),
      );
      move(state.pos);
      closeDrawer();
      $("slate").hidden = true;
      collect();
    } catch (e) {
      collect();
      throw e;
    }
  }
  return {
    save,
    restore,
    list: async () => (await read("meta")).sort((a, b) => b.date - a.date),
    remove: (id) => write({ id }, null, true),
  };
})();
