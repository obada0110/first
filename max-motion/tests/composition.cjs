// node composition.cjs http://localhost:8098 fixture-dir output.mp4
const { chromium } = require("playwright-core"),
  fs = require("fs"),
  path = require("path"),
  assert = require("node:assert/strict");
(async () => {
  const ch = (await import("@sparticuz/chromium")).default,
    b = await chromium.launch({
      args: ch.args,
      executablePath: await ch.executablePath(),
    });
  try {
    const p = await b.newPage({
      viewport: { width: 393, height: 850 },
      hasTouch: true,
      isMobile: true,
    });
    p.setDefaultTimeout(6000);
    const errors = [];
    p.on("pageerror", (e) => {
      errors.push(String(e));
      console.error(e);
    });
    const url = new URL(
      process.argv[2].includes("://")
        ? process.argv[2]
        : "file://" + process.argv[2],
    );
    url.searchParams.set("editor", "1");
    await p.goto(url.href);
    const wait = (f) => p.waitForFunction(f),
      click = (id) => p.locator("#" + id).click(),
      tab = (id) => p.locator("[data-panel=" + id + "]").click(),
      file = (id) =>
        p
          .locator("#" + id)
          .setInputFiles(path.join(process.argv[3], "fx-fixture.webm"));
    await wait(() => ready && !loading);
    await file("file");
    await wait(() => !loading && v.videoWidth === 240);
    await file("appendFiles");
    await wait(() => !loading && pieces.length === 2);
    await p.evaluate(() => move(0));
    await click("projectBtn");
    await p.locator("#preset").selectOption("1080,1920");
    await p.locator("#pw").fill("240");
    await p.locator("#ph").fill("360");
    await p.locator("#bg").selectOption("#1565ff");
    await click("confirmSettings");
    await tab("transform");
    const setTr = async (k, val) => {
      const e = p.locator("[data-tr=" + k + "]");
      await e.fill("" + val);
      await e.press("Tab");
    };
    await setTr("cropX", 10);
    await setTr("x", 38);
    await p.getByRole("button", { name: /إضافة كي فريم/ }).click();
    await p.evaluate(() => move(1));
    await setTr("x", 68);
    assert.equal(await p.evaluate(() => pieces[0][4].keys.length), 2);
    await p.evaluate(() => move(0));
    await tab("text");
    await p.getByRole("button", { name: "＋ نص عربي" }).click();
    await p.locator("#caption").fill("فيديو عربي");
    await p.locator("#textFx").selectOption("outline");
    await setTr("y", 15);
    await tab("overlay");
    await p
      .locator("#overlayFile")
      .setInputFiles(path.join(process.argv[3], "fx-fixture.png"));
    await wait(() => !loading && layers.length === 2);
    await setTr("y", 80);
    await setTr("w", 30);
    await setTr("h", 30);
    await click("dismiss");
    await click("render");
    await p.locator("#fps").selectOption("24");
    await p.locator("#quality").fill("2");
    await click("confirmSettings");
    await p.waitForFunction(() => !run && !!exportFile, null, {
      timeout: 20000,
    });
    fs.writeFileSync(
      process.argv[4],
      Buffer.from(
        await p.evaluate(async () =>
          Array.from(new Uint8Array(await exportFile.arrayBuffer())),
        ),
      ),
    );
    await click("closeResult");
    await tab("cut");
    await p.evaluate(() => move(0.5));
    await click("split");
    assert.equal(await p.evaluate(() => pieces.length), 3);
    await click("undo");
    assert.equal(await p.evaluate(() => pieces.length), 2);
    assert.deepEqual(errors, []);
    console.log(
      "Passed: project geometry, append, crop, transforms, keys, Arabic caption, image overlay, split/undo and composed export.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
