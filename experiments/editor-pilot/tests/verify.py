"""Independent state oracle; never uses platform A as expected for platform B."""
import json,sys,copy,pathlib,hashlib,statistics
r=pathlib.Path(sys.argv[1]); get=lambda n:json.loads((r/n).read_text());q=get('seed.json');dup=copy.deepcopy;states=[]
def step():q['revision']+=1;states.append(dup(q))
c=q['mainTrack']['clips'];c.append({**dup(c[0]),'id':'extra0'});step();c[0]['outUs']=1500000;step();right={**dup(c[1]),'id':'right2','inUs':6000000};c[1]['outUs']=6000000;c.insert(2,right);step();c.pop();step();q['layers'].reverse();step();q['layers'].reverse();step();q['layers'].reverse();step();c[0]['inUs']=500000;step();q['layers'].reverse();step();out={}
for n in sys.argv[2:]:
 a=get(n+'.json');assert 'error' not in a,a;expected=states[-1:] if n=='returned' else states[:8 if n=='android' else 7];assert len(a['states'])==len(expected)
 for i,(actual,e) in enumerate(zip(a['states'],expected)):
  assert actual==e,(n,i+1,actual,e);cs=e['mainTrack']['clips'];view=a['views'][i];
  if n=='android':assert view['name'] in [c['id'] for c in cs] and view['duration']==sum(c['outUs']-c['inUs'] for c in cs)
  else:assert view=={'ranges':[[c['inUs'],c['outUs']] for c in cs],'rows':len(e['layers']),'layerIds':[l['id'] for l in e['layers']]}
 if n!='returned':assert a['restored']==states[6]
 samples=a.get('samples',[]);out[n]={'rows':len(expected),'verified':True,'medianUiMs':statistics.median(a['elapsed']),'maxUiMs':max(a['elapsed']),'orderUndoMedianMs':statistics.median(samples) if samples else None,'orderUndoMaxMs':max(samples) if samples else None}
if 'returned' in sys.argv:assert get('android-file.json')==states[7]
print(json.dumps(out,indent=2));(r/'comparison.json').write_text(json.dumps(out,indent=2))
