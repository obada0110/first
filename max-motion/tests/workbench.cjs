// Real controls at phone and landscape sizes; exports the animated demo.
const { chromium } = require("playwright-core"),
  assert = require("node:assert/strict"),
  fs = require("fs");
(async () => {
  const ch = (await import("@sparticuz/chromium")).default,
    b = await chromium.launch({
      args: ch.args,
      executablePath: await ch.executablePath(),
    });
  try {
    const p = await b.newPage({
      viewport: { width: 1040, height: 700 },
      hasTouch: true,
    });
    p.setDefaultTimeout(5000);
    const errors = [];
    p.on("pageerror", (e) => {
      errors.push(String(e));
      console.log(e);
    });
    await p.goto(process.argv[2] + "?studio=1");
    await p.waitForFunction(
      () => panel === "motionLab" && ready && !fxCanvas.hidden,
    );
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: "/tmp/bench-wide.jpg" });
    await p.locator("#keyPrev").click();
    assert.equal(await p.evaluate(() => pos), 0.5);
    await p.locator("#keyNext").click();
    assert.equal(await p.evaluate(() => pos), 4.5);
    await p.locator("[data-mode=rotation]").click();
    await p.locator("[data-motion=angle]").fill("15");
    await p.locator("[data-motion=angle]").press("Tab");
    assert.equal(await p.evaluate(() => at(target().tr, target().t).angle), 15);
    await p.locator("#undo").click();
    await p.locator("[data-mode=position]").click();
    await p.evaluate(() => move(2));
    const pad = await p.locator("#gesturePad").boundingBox();
    await p.mouse.move(pad.x + 30, pad.y + 25);
    await p.mouse.down();
    await p.mouse.move(pad.x + 58, pad.y + 40, { steps: 4 });
    await p.mouse.up();
    assert.equal(await p.evaluate(() => target().tr.keys.length), 3);
    await p.locator("#removeKey").click();
    assert.equal(await p.evaluate(() => target().tr.keys.length), 2);
    await p.setViewportSize({ width: 393, height: 850 });
    await p.screenshot({ path: "/tmp/bench-phone.jpg" });
    await p.locator("#effectBrowser").click();
    assert.equal(await p.locator("#galleryCards button").count(), 10);
    await p
      .locator("#galleryCards button")
      .filter({ hasText: "توهّج" })
      .click();
    await p.locator("#fxToggle").click();
    assert(await p.evaluate(() => currentFX().glow));
    await p.locator("#render").click();
    await p.locator("#confirmSettings").click();
    await p.waitForFunction(() => exportFile && !run, null, { timeout: 22000 });
    if (process.argv[3])
      fs.writeFileSync(
        process.argv[3],
        Buffer.from(
          await p.evaluate(async () =>
            Array.from(new Uint8Array(await exportFile.arrayBuffer())),
          ),
        ),
      );
    assert.deepEqual(errors, []);
    console.log(
      "Motion inspector, drag, key navigation/deletion/undo, effect gallery, mobile export passed.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
