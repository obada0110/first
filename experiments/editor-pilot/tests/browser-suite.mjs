export async function exercise(f,received){
 const wait=async(cond,label)=>{for(let i=0;i<300;i++){const v=cond();if(v)return v;await new Promise(r=>setTimeout(r,50))}throw Error('timeout: '+label)};
 const panel=()=>f.contentDocument, viewport=()=>panel()?.querySelector('iframe')?.contentWindow;
 const session=()=>wait(()=>{if(viewport()?.pilotError)throw Error(viewport().pilotError);return viewport()?.pilot},'editor core + media bindings');
 let s=await session();const states=[],views=[],elapsed=[],check=(ok,msg)=>{if(!ok)throw Error(msg)};
 function click(op){const t=performance.now();panel().getElementById(op).click();elapsed.push(performance.now()-t);const p=JSON.parse(s.raw());check(panel().querySelector('output').textContent==='revision '+p.revision,'button '+op);states.push(p);views.push(s.view());}
 if(received){s.open(received);click('order');await s.save();return {states,views,elapsed};}
 for(const op of ['add','trim','split','delete','order','undo','redo'])click(op);
 const raw=s.raw();let reject=s.call({op:'undo',expectedRevision:0});check(reject.error==='STALE_REVISION'&&s.raw()===raw,'stale');reject=s.call({op:'addClip',expectedRevision:7,clip:states[0].mainTrack.clips[0]});check(reject.error==='DUPLICATE_ID'&&s.raw()===raw,'duplicate');
 await s.save();const prior=s;f.src='fixture.html?reopen='+Date.now();await wait(()=>viewport()?.pilot&&viewport().pilot!==prior,'fresh editor');s=await session();await s.restore();check(s.raw()===raw,'IndexedDB reload');check(s.call({op:'undo',expectedRevision:7}).error==='UNDO_EMPTY','history must be session-local');
 const samples=[];for(let i=0;i<18;i++){const t=performance.now();s.action('order');s.action('undo');samples.push(performance.now()-t)}
 return {states,views,elapsed,samples,restored:JSON.parse(raw),ua:navigator.userAgent};
}
