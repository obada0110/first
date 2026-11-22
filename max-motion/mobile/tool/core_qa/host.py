"""QA-only DocumentsUI picker, source-frame sampler and checkpoint bridge for emulator tests."""
import os,sys,time,threading,json,subprocess as sp,urllib.parse,re
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
qa=Path(os.environ['QA']);out=qa/'evidence';out.mkdir(parents=True,exist_ok=True);app='io.github.obada0110.maxeditor.phase3a';sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'single_qa'));import host as legacy
adb=legacy.adb;metrics=[]
def pick(name):
    ns=[];last_error=None
    for _ in range(24):
        try: ns=legacy.nodes()
        except sp.CalledProcessError as ex:
            last_error=str(ex);time.sleep(.25);continue
        docs=[n for n in ns if n.get('package','').endswith('documentsui')]
        match=next((n for n in docs if n.get('text')==name),None)
        if match is not None:legacy.tap(match);return
        roots=next((n for n in docs if n.get('content-desc')=='Show roots'),None)
        if roots is not None:legacy.tap(roots);time.sleep(.3);continue
        downloads=next((n for n in docs if n.get('text')=='Downloads'),None)
        if downloads is not None:legacy.tap(downloads);time.sleep(.3);continue
        time.sleep(.25)
    raise AssertionError(('DocumentsUI file not found',name,'lastUiDumpError',last_error,[(n.get('text'),n.get('content-desc')) for n in ns]))
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  try:
   op,_,name=self.path.strip('/').partition('/')
   if op=='pick' and name=='mx-land.mp4':threading.Thread(target=pick,args=(name,),daemon=True).start();data=b'picker launched'
   elif op=='checkpoint':data=adb('exec-out','run-as',app,'cat','files/single-v1.json')
   elif op=='memory':
    raw=adb('shell','dumpsys','meminfo',app).decode(errors='replace');m=re.search(r'TOTAL PSS:\s*([\d,]+)',raw);data=json.dumps({'pssKiB':int(m.group(1).replace(',','')) if m else None,'summary':[x.strip() for x in raw.splitlines() if 'TOTAL PSS' in x or 'TOTAL RSS' in x]}).encode()
   elif op=='shot':
    target=out/(name+'.png');target.write_bytes(adb('exec-out','screencap','-p'));data=b'screenshot captured'
   elif op=='rotate' and name in ('portrait','landscape'):
    adb('shell','settings','put','system','accelerometer_rotation','0');adb('shell','settings','put','system','user_rotation','0' if name=='portrait' else '1');data=b'rotated'
   else:raise ValueError(self.path)
   self.send_response(200);self.send_header('Content-Type','application/json' if op in ('checkpoint','memory') else 'text/plain');self.end_headers();self.wfile.write(data)
  except Exception as e:self.send_error(500,str(e))
 def do_POST(self):
  try:
   body=json.loads(self.rfile.read(int(self.headers['Content-Length'])));name=urllib.parse.urlparse(self.path).path.strip('/').split('/')[-1]
   if name=='metrics':(out/'metrics.json').write_text(json.dumps(body,indent=2));data=json.dumps({'ok':True}).encode()
   elif name.startswith('frame-'):
    shot=out/(name+'.png');shot.write_bytes(adb('exec-out','screencap','-p'))
    # Match the validated preview probe used by the production-screen QA suite.
    raw=sp.check_output(['ffmpeg','-v','error','-i',str(shot),'-vf','crop=64:64:(iw-64)/2:ih*0.21','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-threads','1','pipe:1'])
    pixels=list(zip(raw[::3],raw[1::3],raw[2::3]));row={'sample':name,'saturated':sum(max(p)-min(p)>50 for p in pixels),'nearBlack':sum(max(p)<12 for p in pixels),'pixels':len(pixels)};metrics.append(row);(out/'frame-observations.json').write_text(json.dumps(metrics,indent=2));data=json.dumps(row).encode()
   else:raise ValueError(self.path)
   self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(data)
  except Exception as e:self.send_error(500,str(e))
if __name__=='__main__':ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
