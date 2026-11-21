"""Independent expectations, patched explicitly from v1 fixtures. No call to Kotlin here."""
import copy, json, pathlib, sys
D=pathlib.Path(sys.argv[1]); D.mkdir(parents=True,exist_ok=True)
F=pathlib.Path('fixtures'); p=json.loads((F/'project.json').read_text()); gold=json.loads((F/'vectors.json').read_text()); copyit=copy.deepcopy
ops=[]; inputs=[]; expected={}
def write(file,obj): (D/file).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n')
def start(name, initial=p):
 global state,trace,commands
 state=copyit(initial);trace=[];commands=[];expected[name]=trace;inputs.append(dict(name=name,input=json.dumps(initial,ensure_ascii=False),ops=commands)); trace.append(dict(ok=True,value=None,state=copyit(state)))
def step(op, args={}, *, change=None, to=None, value=None, error=None, revision=None):
 cmd=dict(op=op,**args);read=op in ['scene','duration','frames','pts'];
 if not read:cmd['expectedRevision']=state['revision'] if revision is None else revision
 commands.append(cmd)
 if error is not None: trace.append(dict(ok=False,error=error,state=copyit(state)));return
 if not read:
  rev=state['revision'];
  if to is not None:state.clear();state.update(copyit(to))
  if change:change(state)
  state['revision']=rev+1
 trace.append(dict(ok=True,value=copyit(value),state=copyit(state)))
def clips(s):return s['mainTrack']['clips']
def rejected(name, doc, code):
 raw=doc if isinstance(doc,str) else json.dumps(doc,ensure_ascii=False);inputs.append(dict(name=name,input=raw,ops=[]));expected[name]=[dict(ok=False,error=code,state=None)]
def bad(name,fn,code='INVALID_V1_OR_INPUT'):
 d=copyit(p);fn(d);rejected(name,d,code)
k0=clips(p)[0]['transform']['base'];pose=lambda x:{**k0,'x':x}
start('frozen-v1-clock');step('duration',value=gold['durationUs']);step('frames',value=gold['frames'])
for frame,t in gold['frameSamples']:step('pts',dict(index=frame),value=t)
def spec(s,time,idx,src,x,layerids,tx):
 c=clips(s)[idx]; draw=[]
 for id in layerids:
  l=next(l for l in s['layers'] if l['id']==id); L={k:l[k] for k in ('id','kind','assetId','text','font','color','effect') if k in l};L.update(localUs=time-l['startUs'],pose=pose(tx if id=='title' else 50));
  if id=='overlay':L['audioPolicy']='mute'
  draw.append(L)
 return dict(renderSpecVersion=1,projectId=s['projectId'],revision=s['revision'],ptsUs=time,canvas=s['canvas'],fps=s['fps'],primary=dict(clipId=c['id'],assetId=c['assetId'],sourceUs=src,pose=pose(x),audioPolicy='source-if-present',effects=[dict(id=k,params=c['effects'][k]) for k in ['key','blur','motion','temp','light','contrast','sat','glow','rain','frost'] if k in c['effects']]),layers=draw)
for sample in gold['samples']:
 t=sample['timeUs'];step('scene',dict(atUs=t),value=spec(p,t,sample['index'],sample['sourceUs'],sample['x'],sample['layers'],sample['titleX']))
for t in [-1,6000000,6000001]:step('scene',dict(atUs=t),value=None)
step('scene',dict(atUs=1999999),value=spec(p,1999999,0,1999999,50,[],None));step('pts',dict(index=-1),error='INVALID_V1_OR_INPUT')
start('cut-history-revision');step('undo',error='UNDO_EMPTY'); step('redo',error='REDO_EMPTY'); arg={'id':'cA','atUs':3000000,'rightId':'cB'}
step('split',arg,revision=1,error='STALE_REVISION');step('split',{**arg,'rightId':'title'},error='DUPLICATE_ID');step('split',{**arg,'atUs':2049999},error='CUT_MARGIN');step('split',{**arg,'atUs':6000000},error='TIME_RANGE');step('delete',{'id':'none'},error='UNKNOWN_ID')
def split(s):
 c=clips(s)[1];r=copyit(c);r.update(id='cB',inUs=6000000);c['outUs']=6000000;clips(s).append(r)
step('split',arg,change=split);after=copyit(state);step('undo',to=p);step('delete',{'id':'none'},error='UNKNOWN_ID');step('redo',to=after);step('trimLeft',{'id':'cB','atUs':3050000},change=lambda s:clips(s)[2].update(inUs=6050000));step('trimRight',{'id':'intro','atUs':1950000},change=lambda s:clips(s)[0].update(outUs=1950000));step('delete',{'id':'cA'},change=lambda s:clips(s).pop(1));step('delete',{'id':'intro'},change=lambda s:clips(s).pop(0));step('delete',{'id':'cB'},error='LAST_CLIP');step('redo',error='REDO_EMPTY');step('delete',{'id':'cB','surprise':1},error='INVALID_V1_OR_INPUT')
start('layer-order-and-keys');step('order',{'ids':['title','title']},error='BAD_ORDER');step('order',{'ids':['overlay','title']},change=lambda s:s['layers'].reverse());step('scene',{'atUs':3000000},value=spec(state,3000000,1,6000000,30,['overlay','title'],35));
def keyChange(s,t,v):
 ks=s['layers'][1]['transform']['keys'];ks[:]=sorted([k for k in ks if k['atUs']!=t]+[dict(atUs=t,value=v)],key=lambda k:k['atUs'])
arg={'id':'title','atUs':500000,'value':pose(63)};step('putKey',arg,change=lambda s:keyChange(s,500000,pose(63)));step('putKey',{**arg,'value':pose(75)},change=lambda s:keyChange(s,500000,pose(75)));after=copyit(state);step('scene',dict(atUs=2750000),value=spec(state,2750000,1,5750000,25,['title'],47.5));step('removeKey',{'id':'title','atUs':500000},change=lambda s:s['layers'][1]['transform']['keys'].pop(1));step('undo',to=after);step('putKey',{**arg,'atUs':2000001},error='KEY_CLOCK');step('removeKey',{'id':'title','atUs':42},error='NO_KEY');step('putKey',{'id':'intro','atUs':12345,'value':pose(66)},change=lambda s:clips(s)[0]['transform']['keys'].append(dict(atUs=12345,value=pose(66))));step('redo',error='REDO_EMPTY');step('removeKey',{'id':'intro','atUs':12345},change=lambda s:clips(s)[0].update(transform=dict(base=pose(66),keys=[])))
start('max-clock', {**p,'assets':[{**p['assets'][0],'durationUs':86400000000},p['assets'][1]],'fps':{'num':60000,'den':1001},'mainTrack':{'id':'primary','clips':[{**clips(p)[0],'outUs':86400000000}]}});step('frames',value=(86400000000*60000+1001000000-1)//1001000000);step('pts',{'index':5184000},value=5184000*1000000*1001//60000)
start('revision-cap',{**p,'revision':9007199254740990});step('order',{'ids':['overlay','title']},change=lambda s:s['layers'].reverse());step('undo',error='REVISION_LIMIT');step('redo',revision=9007199254740990,error='STALE_REVISION')
start('astral-name-boundary',{**p,'name':'🎬'*120});bad('name-too-long',lambda s:s.update(name='🎬'*121));bad('duplicate-layer',lambda s:s['layers'][1].update(id='title'),'DUPLICATE_ID');bad('dangling-clip',lambda s:clips(s)[1].update(assetId='missing'),'MISSING_ASSET');bad('dangling-layer',lambda s:s['layers'][1].update(assetId='missing'),'MISSING_ASSET');bad('unknown-effect',lambda s:clips(s)[0].update(effects={'fog':{}}));bad('missing-fx-parameter',lambda s:clips(s)[1]['effects']['light'].pop('gamma'));bad('repeated-key',lambda s:clips(s)[1]['transform']['keys'].reverse(),'KEY_CLOCK');bad('fractional-us',lambda s:clips(s)[1].update(inUs=5000000.5));bad('bad-fps',lambda s:s.update(fps={'num':2997,'den':100}));bad('unsupported-version',lambda s:s.update(schemaVersion=2));bad('inverted-range',lambda s:clips(s)[0].update(outUs=0));bad('unknown-project-field',lambda s:s.update(extra='preserve in upstream archive, reject here'));rejected('duplicate-json-field','{"name":"a","\\u006eame":"b"}','DUPLICATE_FIELD');rejected('syntax-error','{"layers":[1,]}','INVALID_V1_OR_INPUT')
# The stored FX map is deliberately in the reverse of the renderer's order.
fx=copyit(p);clips(fx)[1]['effects']={'rain':{'rainAmt':60,'speed':20,'wind':-5,'rainMix':40},'light':clips(fx)[1]['effects']['light'],'blur':{'radius':4,'area':0,'cx':50,'cy':50}}
start('multi-fx-source-time',fx);step('scene',{'atUs':3000000},value=spec(state,3000000,1,6000000,30,['title','overlay'],35))
for num,den in [(24,1),(30,1),(60,1),(24000,1001),(60000,1001)]:
 start(f'fps-{num}-{den}',{**p,'fps':dict(num=num,den=den)});step('pts',{'index':23},value=23*1000000*den//num);step('frames',value=(6000000*num+1000000*den-1)//(1000000*den))
start('history-bound'); snaps=[copyit(state)]
for i in range(101):step('order',{'ids':list(reversed([l['id'] for l in state['layers']]))},change=lambda s:s['layers'].reverse());snaps.append(copyit(state))
for i in range(100,0,-1):step('undo',to=snaps[i]);
step('undo',error='UNDO_EMPTY')
write('cases.json',inputs);write('expected.json',expected);write('schema.json',json.loads((F/'project-v1.json').read_text()));write('project.json',p)
large=copyit(p);large['mainTrack']['clips']=[{**copyit(clips(p)[0]),'id':'intro' if i==0 else 'copy'+str(i)} for i in range(128)];large['layers']=[{**copyit(p['layers'][0]),'id':'text'+str(i)} for i in range(16)];write('large.json',large)
bench=[]
for i in range(6):bench.extend([dict(op='split',id='intro',atUs=100000,rightId='rhs',expectedRevision=len(bench)),dict(op='undo',expectedRevision=len(bench)+1)])
for i in range(12):bench.append(dict(op='putKey',id='intro',atUs=i*100000,value=pose(i+1),expectedRevision=len(bench)))
write('bench-ops.json',bench);print(len(inputs),'cases;',sum(map(len,expected.values())),'full trace rows')
