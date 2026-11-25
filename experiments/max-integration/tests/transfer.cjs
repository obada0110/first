// Each hop opens the previous host's saved output, in a fresh process/context.
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const { execFileSync: exec } = require("node:child_process"),
  assert = require("node:assert/strict");
const engines = require("playwright-core");
const pkg = "lab.maxeditor.transfer",
  dir = "proof/records";
fs.mkdirSync(dir, { recursive: true });
const seed = JSON.parse(
    fs.readFileSync("../max-core-kmp/fixtures/project.json"),
  ),
  schema = fs.readFileSync("web/schema.json", "utf8");
// Cover all v1 FX parameters on the transmitted clip, including when inherited by split.
const fx = JSON.parse(schema).$defs.effects.properties;
for (const [id, rule] of Object.entries(fx)) {
  const params = {};
  for (const [k, v] of Object.entries(rule.properties))
    params[k] =
      v.$ref === "#/$defs/color" ? "#43ad81" : v.enum ? v.enum[0] : v.minimum;
  seed.mainTrack.clips[1].effects[id] = params;
}
const oracle = (p, op) => {
  const q = structuredClone(p);
  q.revision++;
  if (op === "order") q.layers.reverse();
  else if (op === "split") {
    const c = q.mainTrack.clips[1],
      r = structuredClone(c);
    c.outUs = 6000000;
    r.inUs = 6000000;
    r.id = "cB";
    q.mainTrack.clips.push(r);
  } else
    q.layers
      .find((l) => l.id === "title")
      .transform.keys.splice(1, 0, {
        atUs: 750000,
        value: {
          x: 77,
          y: 50,
          w: 100,
          h: 100,
          angle: 0,
          opacity: 100,
          cropX: 0,
          cropY: 0,
        },
      });
  return q;
};
const adb = (args, input) =>
  exec("adb", args, { input, timeout: 30000, encoding: "utf8" });
function android(input, op) {
  adb(["shell", "am", "force-stop", pkg]);
  adb(["shell", "run-as", pkg, "mkdir", "-p", "files"]);
  adb(["shell", "run-as", pkg, "rm", "-f", "files/output.json"]);
  adb(["shell", `run-as ${pkg} sh -c 'cat > files/input.json'`], input);
  adb([
    "shell",
    "am",
    "start",
    "-W",
    "-n",
    pkg + "/.Lab",
    "--es",
    "fixtureAction",
    op,
  ]);
  return adb(["exec-out", "run-as", pkg, "cat", "files/output.json"]);
}
async function web(br, url, raw, op, filename) {
  const c = await br.newContext({ acceptDownloads: true });
  try {
    const p = await c.newPage();
    await p.goto(url);
    await p
      .locator("#input")
      .setInputFiles({
        name: "fixture.json",
        mimeType: "application/json",
        buffer: Buffer.from(raw),
      });
    await p.waitForFunction(() =>
      document.querySelector("#status").textContent.startsWith("ready:"),
    );
    await p.locator("#" + op).click();
    assert.match(await p.locator("#status").textContent(), /^edited:/);
    const pending = p.waitForEvent("download");
    await p.locator("#save").click();
    await (await pending).saveAs(filename);
    return fs.readFileSync(filename, "utf8");
  } finally {
    await c.close();
  }
}
async function contracts(br, url, name) {
  const p = await br.newPage();
  await p.goto(url);
  try {
    return await p.evaluate(
      async ({ schema, seed, measure }) => {
        const { EditorPort } = await import("./core.mjs"),
          { openFixture } = await import("./adapter.mjs");
        const port = new EditorPort(schema);
        const rows = [];
        const call = (m, d) =>
          JSON.parse(port.call(JSON.stringify({ api: 1, method: m, data: d })));
        const check = (r, code, rev) => {
          if (
            r.error !== code ||
            r.ok !== (code === null) ||
            r.revision !== rev
          )
            throw Error(JSON.stringify(r));
          rows.push([code, rev]);
        };
        check(call("snapshot", null), "NOT_OPEN", null);
        check(
          JSON.parse(port.call('{"api":2,"method":"open","data":null}')),
          "BAD_API",
          null,
        );
        check(
          JSON.parse(port.call('{"api":1,"api":1,"method":"open","data":"x"}')),
          "DUPLICATE_FIELD",
          null,
        );
        const raw = JSON.stringify(seed),
          bad = JSON.parse(raw);
        bad.mainTrack.clips[1].effects.unknown = { p: 1 };
        const unsupported = JSON.stringify(bad),
          reject = openFixture(schema, unsupported);
        if (reject.original !== unsupported) throw Error("Original lost");
        check(reject.opened, "INVALID_PROJECT", null);
        check(call("open", raw), null, 0);
        check(call("open", raw), "ALREADY_OPEN", 0);
        check(call("unknown", null), "BAD_METHOD", 0);
        const before = call("snapshot", null).value;
        check(
          call("edit", { op: "undo", expectedRevision: 0 }),
          "UNDO_EMPTY",
          0,
        );
        check(
          call("edit", {
            op: "split",
            id: "cA",
            atUs: 3000000,
            rightId: "title",
            expectedRevision: 0,
          }),
          "DUPLICATE_ID",
          0,
        );
        check(
          call("edit", {
            op: "order",
            ids: ["overlay", "title"],
            expectedRevision: 1,
          }),
          "STALE_REVISION",
          0,
        );
        if (call("snapshot", null).value !== before)
          throw Error("reject mutated");
        check(call("render", 3000000), null, 0);
        if (
          call("render", 6000000).value !== null ||
          call("render", 3000000).value.primary.effects.length !== 10
        )
          throw Error("render intent");
        const s = openFixture(schema, raw),
          cmd = { op: "order", ids: ["overlay", "title"] },
          cancel = s.gesture();
        cancel.move(cmd);
        cancel.cancel();
        if (cancel.finish() !== null || s.revision !== 0) throw Error("cancel");
        const stale = s.gesture();
        stale.move(cmd);
        s.edit({ ...cmd, expectedRevision: 0 });
        check(stale.finish(), "STALE_REVISION", 1);
        if (!measure) return { rows };
        const big = structuredClone(seed);
        big.mainTrack.clips = Array.from({ length: 128 }, (_, i) => ({
          ...seed.mainTrack.clips[0],
          id: "clip" + i,
        }));
        big.layers = Array.from({ length: 16 }, (_, i) => ({
          ...seed.layers[0],
          id: "layer" + i,
        }));
        const text = JSON.stringify(big);
        const samples = [];
        for (let i = 0; i < 8; i++) {
          const pair = {};
          let poses = [];
          for (const mode of ["eager", "draft"]) {
            const s = openFixture(schema, text),
              g = s.gesture(),
              t = performance.now();
            for (let n = 1; n <= 60; n++) {
              const c = {
                op: "putKey",
                id: "layer0",
                atUs: 500000,
                value: { ...big.layers[0].transform.base, x: n },
              };
              if (mode === "draft") g.move(c);
              else if (!s.edit({ ...c, expectedRevision: s.revision }).ok)
                throw Error("eager");
            }
            if (mode === "draft" && !g.finish().ok) throw Error("commit");
            pair[mode] = performance.now() - t;
            const q = JSON.parse(s.call("snapshot", null).value);
            if (q.revision !== (mode === "draft" ? 1 : 60))
              throw Error("command count");
            delete q.revision;
            poses.push(JSON.stringify(q));
          }
          if (poses[0] !== poses[1]) throw Error("different final edit");
          if (i) samples.push(pair);
        }
        return { rows, gesture60Ms: samples };
      },
      { schema, seed, measure: name === "chromium" },
    );
  } finally {
    await p.close();
  }
}
(async () => {
  const physical = process.env.PHYSICAL === "1",
    emulated =
      adb(["shell", "getprop", "ro.kernel.qemu"]).trim() === "1" ||
      adb(["shell", "getprop", "ro.boot.qemu"]).trim() === "1";
  if (physical === emulated)
    throw Error("Device class does not match requested mode");
  const env = {
    physical,
    model: adb(["shell", "getprop", "ro.product.model"]).trim(),
    fingerprint: adb(["shell", "getprop", "ro.build.fingerprint"]).trim(),
  };
  fs.writeFileSync(dir + "/device.json", JSON.stringify(env, null, 2));
  const server = http.createServer((req, res) => {
    const file = {
      "/": "index.html",
      "/schema.json": "schema.json",
      "/core.mjs": "core.mjs",
      "/adapter.mjs": "adapter.mjs",
    }[req.url];
    if (!file) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      file.endsWith("mjs")
        ? "text/javascript"
        : file.endsWith("json")
          ? "application/json"
          : "text/html; charset=utf-8",
    );
    res.end(fs.readFileSync(path.join("web", file)));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + server.address().port + "/";
  try {
    fs.writeFileSync(dir + "/seed.json", JSON.stringify(seed));
    for (const name of ["chromium", "firefox", "webkit"]) {
      const br = await engines[name].launch(
        name === "chromium"
          ? {
              executablePath:
                process.env.CHROME_BIN || "/usr/bin/google-chrome",
              args: ["--no-sandbox"],
            }
          : {},
      );
      try {
        const report = {
          browser: name,
          version: br.version(),
          ...(await contracts(br, url, name)),
          routes: [],
        };
        for (const [route, steps] of Object.entries({
          WAW: [
            ["W", "split"],
            ["A", "order"],
            ["W", "key"],
          ],
          AWA: [
            ["A", "order"],
            ["W", "split"],
            ["A", "key"],
          ],
        })) {
          let raw = JSON.stringify(seed),
            expected = seed;
          for (const [host, op] of steps) {
            const file = `${dir}/${name}-${route}-${expected.revision + 1}.json`;
            raw =
              host === "A"
                ? android(raw, op)
                : await web(br, url, raw, op, file);
            fs.writeFileSync(file, raw);
            expected = oracle(expected, op);
            assert.deepStrictEqual(JSON.parse(raw), expected);
            report.routes.push({
              route,
              host,
              op,
              revision: expected.revision,
              file,
            });
          }
        }
        fs.writeFileSync(
          `${dir}/${name}.json`,
          JSON.stringify(report, null, 2),
        );
        console.log(
          name,
          br.version(),
          ": both routes, all six whole states passed",
        );
      } finally {
        await br.close();
      }
    }
  } finally {
    server.closeAllConnections();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
