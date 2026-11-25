"""Compare every whole state, error, scene and value, not just terminal hashes.
Normalize object order and equivalent JSON numbers; preserve list order and types.
"""
import json,sys,hashlib,pathlib
R=pathlib.Path('proof/records'); F=pathlib.Path('proof/fixtures')
def norm(x):
 if isinstance(x,float) and x.is_integer():return int(x)
 if isinstance(x,dict):return {k:norm(v) for k,v in x.items()}
 if isinstance(x,list):return list(map(norm,x))
 return x
def canon(x):return json.dumps(norm(x),sort_keys=True,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode()
sha=lambda b:hashlib.sha256(b).hexdigest(); golden=json.loads((F/'expected.json').read_text());inputs={c['name']:c for c in json.loads((F/'cases.json').read_text())};reports={}
for target in sys.argv[1:]:
 observed=json.loads((R/(target+'-trace.json')).read_text());assert observed.keys()==golden.keys();rows=[]
 for name,expected in golden.items():
  actual=observed[name];assert len(actual)==len(expected),(target,name,'rows')
  for i,(a,b) in enumerate(zip(actual,expected)):
   if canon(a)!=canon(b):
    (R/'mismatch.json').write_text(json.dumps({'target':target,'case':name,'row':i,'actual':a,'expected':b},ensure_ascii=False));raise ValueError(f'{target}: {name} row {i}: see mismatch.json')
   rows.append(dict(case=name,row=i,op=inputs[name]['ops'][i-1]['op'] if i else 'open',ok=a['ok'],error=a.get('error'),stateSHA256=sha(canon(a['state']))))
 (R/(target+'-checks.json')).write_text(json.dumps(rows));reports[target]={'cases':len(golden),'rows':len(rows),'rejections':sum(not r['ok'] for r in rows),'canonicalTraceSHA256':sha(canon(observed))}
assert len({v['canonicalTraceSHA256'] for v in reports.values()})==1
print(json.dumps(reports,indent=2));(R/'comparison.json').write_text(json.dumps(reports,indent=2))
