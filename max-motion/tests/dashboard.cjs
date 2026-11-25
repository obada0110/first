// node dashboard.cjs <served editor URL> <path to fx-fixture.webm>
const { chromium } = require("playwright-core"),
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
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.goto(process.argv[2]);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: "/tmp/hub6-phone.jpg" });
    await p.setViewportSize({ width: 1280, height: 820 });
    await p.screenshot({ path: "/tmp/hub6-wide.jpg" });
    await p.setViewportSize({ width: 393, height: 850 });
    const click = (id) => p.locator("#" + id).click(),
      action = (k) => p.locator(`[data-action="${k}"]:visible`).first().click();
    await action("template:story");
    await p.locator("#projectName").fill("فيلم التجربة");
    await p.locator("#newProjectForm .bright").click();
    await p.waitForFunction(
      () => ready && !loading && !document.querySelector(".app").hidden,
    );
    assert.deepEqual(await p.evaluate(() => projectSize()), [1080, 1920]);
    await p.locator("#appendFiles").setInputFiles(process.argv[3]);
    await p.waitForFunction(() => !loading && pieces.length === 2);
    await p.locator("[data-panel=text]").click();
    await p.getByRole("button", { name: "＋ نص عربي" }).click();
    await p.locator("#caption").fill("نص محفوظ");
    await click("backHome");
    await p.waitForFunction(() => !$("dashboard").hidden);
    await p.reload();
    await action("route:projects");
    await p.locator(".projectRow button").first().click();
    await p.waitForFunction(
      () => ready && !document.querySelector(".app").hidden,
    );
    assert.deepEqual(
      await p.evaluate(() => [pieces.length, layers[0].text, v.videoWidth]),
      [2, "نص محفوظ", 240],
    );
    await click("backHome");
    await action("route:tools");
    await p.locator("#toolQuery").fill("تثبيت");
    await p.locator(".catalogGrid button:visible").click();
    assert.match(await p.locator("#sheetBody").innerText(), /قيد التطوير/);
    await click("sheetClose");
    await click("navSettings");
    await p.locator("#qualityPref").selectOption("480");
    await p.reload();
    assert.equal(await p.evaluate(() => window.previewLimit), 480);
    assert.deepEqual(errors, []);
    console.log(
      "Dashboard, templates, editor round-trip, saved video + text after reload, upcoming tool status and preferences passed.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
