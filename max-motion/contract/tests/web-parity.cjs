// Test adapter only. Opens an isolated browser profile and invokes the REAL web editor.
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures', name)));
const project = fixture('project.json'), gold = fixture('vectors.json');
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mx-contract-'));
  let browser;
  try {
    const video = path.join(tmp, 'clock.mp4');
    execFileSync(process.env.FFMPEG || 'ffmpeg', ['-loglevel','error','-f','lavfi','-i','color=c=blue:s=80x48:r=24','-t','10','-c:v','libx264','-pix_fmt','yuv420p',video]);
    browser = await chromium.launch({executablePath:process.env.CHROME_BIN, args:['--no-sandbox','--disable-dev-shm-usage']});
    const page = await browser.newPage();
    const errors=[]; page.on('pageerror', e=>errors.push(String(e)));
    const url = new URL(process.argv[2]); url.searchParams.set('editor','1'); await page.goto(url.href);
    await page.waitForFunction(()=>ready&&!loading);
    await page.locator('#file').setInputFiles(video);
    await page.waitForFunction(()=>!loading&&ready&&v.videoWidth===80);
    await page.evaluate(async p=>{
      const assetIds = {a:pieces[0][3], pic:await register('media/ridge.jpg',true)};
      const tr = t => ({...t.base, keys:t.keys.map(k=>({...k.value,t:k.atUs/1e6}))});
      pieces = p.mainTrack.clips.map(c=>[c.inUs/1e6,c.outUs/1e6,c.effects,assetIds[c.assetId],tr(c.transform)]);
      layers = p.layers.map(l=>({...l,tr:tr(l.transform),start:l.startUs/1e6,dur:l.durationUs/1e6,asset:l.assetId?assetIds[l.assetId]:undefined}));
      project = {w:p.canvas.width,h:p.canvas.height,bg:p.canvas.background}; move(0);
    }, project);
    // The contract freezes the actual v1 FX IDs, parameter names and allowed ranges.
    const effects = JSON.parse(fs.readFileSync(path.join(__dirname,'../schema/project-v1.json'))).$defs.effects.properties;
    const catalog = await page.evaluate(()=>FX.tools.map(t=>({id:t.id,params:t.params})));
    assert.deepEqual(Object.keys(effects).sort(),catalog.map(t=>t.id).sort());
    for(const {id,params} of catalog){
      assert.deepEqual([...effects[id].required].sort(),params.map(p=>p.key).sort());
      for(const p of params){const rule=effects[id].properties[p.key];
        if('min' in p) assert.deepEqual([rule.minimum,rule.maximum],[p.min,p.max]);
        else assert.equal(rule.$ref,'#/$defs/color');
      }
    }
    const projection=()=>page.evaluate(()=>pieces.map(c=>c.slice(0,2).map(t=>Math.round(t*1e6))));
    assert.equal(await page.evaluate(()=>Math.round(total()*1e6)),gold.durationUs);
    assert.deepEqual(await projection(),gold.rangesBefore);
    for(const sample of gold.samples) {
      const actual=await page.evaluate(timeUs=>{
        move(timeUs/1e6);const c=pieces[active], source=c[0]+pos-base(active);
        const ls=layers.filter(l=>visible(l,pos)), title=ls.find(l=>l.kind==='text');
        return {timeUs,index:active,sourceUs:Math.round(source*1e6),x:at(c[4],source).x,layers:ls.map(l=>l.id),titleX:title?at(title.tr,pos-title.start).x:null};
      },sample.timeUs);assert.deepEqual(actual,sample);
    }
    await page.evaluate(t=>move(t/1e6),gold.split.timeUs);
    await page.locator('[data-panel=cut]').click();await page.locator('#split').click();
    assert.deepEqual(await projection(),gold.rangesAfter);
    assert(await page.evaluate(()=>JSON.stringify(pieces[1][4])===JSON.stringify(pieces[2][4])&&pieces[1][2].light.exposure===pieces[2][2].light.exposure));
    await page.evaluate(()=>ProjectLibrary.save('contract-check','parity'));
    await page.locator('#undo').click();assert.deepEqual(await projection(),gold.rangesBefore);
    await page.reload();await page.waitForFunction(()=>ready&&!loading);
    await page.evaluate(()=>ProjectLibrary.restore('contract-check'));
    assert.deepEqual(await projection(),gold.rangesAfter);
    assert.equal(await page.evaluate(()=>layers.find(l=>l.kind==='text').text),'عنوان');
    assert.deepEqual(errors,[]);
    console.log(`PASS web: ${gold.samples.length} shared samples, split inheritance, undo, IndexedDB reload. No web redo/NTSC feature asserted.`);
  }finally{await browser?.close();fs.rmSync(tmp,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
