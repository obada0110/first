// Executed only inside the lab's read-only editor viewport; canonical data never comes back from a projection.
import {EditorPort} from './core-pilot.mjs';
if(new URLSearchParams(location.search).has('pilot')) boot().catch(e=>{window.pilotError=String(e);parent.postMessage(String(e),location.origin)});
async function boot(){
 const schema=await (await fetch('pilot-schema.json')).text(),seed=await(await fetch('contract/fixtures/project.json')).text();let port,doc,reply;
 const call=(method,data)=>JSON.parse(port.call(JSON.stringify({api:2,method,data})));
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('max-editor-pilot-v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('fixture');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 function storage(action,key,value){return new Promise((resolve,reject)=>{const t=db.transaction('fixture',action==='put'?'readwrite':'readonly'),s=t.objectStore('fixture'),r=action==='put'?s.put(value,key):s.get(key);t.oncomplete=()=>resolve(r.result);t.onabort=t.onerror=()=>reject(t.error)})}
 const binding={};for(const [id,file,img] of [['a','pilot.webm',false],['pic','media/ridge.jpg',true]]){let blob=await storage('get','asset:'+id);if(!blob){blob=await(await fetch(file)).blob();await storage('put','asset:'+id,blob)}binding[id]=await register(new File([blob],file,{type:blob.type}),img)}
 const tr=t=>({...t.base,keys:t.keys.map(k=>({...k.value,t:k.atUs/1e6}))});
 function paintSnapshot(){doc=JSON.parse(call('snapshot',null).value);pieces=doc.mainTrack.clips.map(c=>[c.inUs/1e6,c.outUs/1e6,c.effects,binding[c.assetId],tr(c.transform)]);layers=doc.layers.map(l=>({...l,tr:tr(l.transform),start:l.startUs/1e6,dur:l.durationUs/1e6,asset:binding[l.assetId]}));project={w:doc.canvas.width,h:doc.canvas.height,bg:doc.canvas.background};ready=true;selected='';move(Math.min(pos,total()));}
 function open(text){const next=new EditorPort(schema);const res=JSON.parse(next.call(JSON.stringify({api:2,method:'open',data:text})));if(!res.ok)throw Error(res.error);const candidate=JSON.parse(text);if(candidate.projectId!=='parity'||candidate.assets.some(a=>!Object.hasOwn(binding,a.id)))throw Error('UNBOUND_FIXTURE');port=next;paintSnapshot()}
 function edit(cmd){const r=call('edit',cmd);if(r.ok)paintSnapshot();return r}
 window.hostPilotEdit=op=>{const c=doc.mainTrack.clips[active],rev=doc.revision;let cmd={op:{right:'trimRight',left:'trimLeft',del:'delete'}[op]||op,expectedRevision:rev};if(op!=='undo'){cmd.id=c.id;if(op!=='del')cmd.atUs=Math.round(pos*1e6);if(op==='split')cmd.rightId='right'+rev}return reply=edit(cmd)};
 function action(k){const rev=doc.revision,clips=doc.mainTrack.clips,baseCmd={expectedRevision:rev};if(k==='add')return edit({...baseCmd,op:'addClip',clip:{...clips[0],id:'extra'+rev}});if(k==='order')return edit({...baseCmd,op:'order',ids:doc.layers.map(l=>l.id).reverse()});if(k==='redo')return edit({...baseCmd,op:'redo'});
 const id={trim:'right',left:'left',delete:'del'}[k]||k;if(k!=='undo'){const idx=k==='split'?clips.findIndex(c=>c.id==='cA'):k==='delete'?clips.findIndex(c=>c.id.startsWith('extra')):0;if(idx<0)throw Error('No matching fixture target');move(base(idx)+(k==='split'?1:k==='trim'?1.5:k==='left'?0.5:0))}return editViaExistingHandler(id)}
 function editViaExistingHandler(id){reply=null;$(id).onclick();return reply}
 open(seed);document.querySelector('.app').hidden=false;const hub=document.querySelector('#dashboard');if(hub)hub.hidden=true;$('slate').hidden=true;
 window.pilot={action,open,call:edit,raw:()=>call('snapshot',null).value,save:()=>storage('put','snapshot',call('snapshot',null).value),restore:async()=>open(await storage('get','snapshot')),view:()=>({ranges:pieces.map(p=>p.slice(0,2).map(n=>Math.round(n*1e6))),layerIds:layers.map(l=>l.id),rows:$('layerRows').children.length})};parent.postMessage('ready',location.origin);
}
