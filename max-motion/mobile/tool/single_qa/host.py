"""Test-only companion for the official DocumentsUI picker, independent screenshot & decoder."""
import hashlib, json, os, re, subprocess as sp, sys, threading, time, traceback
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from xml.etree import ElementTree as ET
import array, math
qa=Path(os.environ['QA']); out=qa/'evidence'; app='io.github.obada0110.maxeditor'
def cmd(*a):return sp.check_output(list(map(str,a)),timeout=35)
def adb(*a):return cmd('adb',*a)
def shot(name): (out/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
def nodes():
    adb('shell','uiautomator','dump','--compressed','/sdcard/qa-window.xml');return list(ET.fromstring(adb('shell','cat','/sdcard/qa-window.xml')).iter('node'))
def tap(n):
    x,y,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')));adb('shell','input','tap',(x+x2)//2,(y+y2)//2)
def find(label):
    for _ in range(12):
        ns=nodes()
        for n in ns:
            if label.lower() in (n.get('text','')+' '+n.get('content-desc','')).lower():return n
        time.sleep(.15)
    raise AssertionError((label,[(n.get('text'),n.get('content-desc')) for n in ns]))
def pick(file):
    try:
        for i in range(14):
            ns=nodes();opts=[n for n in ns if n.get('package','').endswith('documentsui')]; match=next((n for n in opts if file in n.get('text','')+' '+n.get('content-desc','')),None)
            if match is not None:tap(match);return
            if opts:
                down=next((n for n in opts if n.get('text')=='Downloads'),None); drawer=next((n for n in opts if 'roots' in n.get('content-desc','').lower() or 'Show navigation' in n.get('content-desc','')),None)
                if down is not None:tap(down)
                elif drawer is not None:tap(drawer)
            time.sleep(.4)
        raise RuntimeError([(n.get('text'),n.get('content-desc')) for n in ns])
    except Exception:traceback.print_exc();shot('picker-failure')
def frames(p,t):return cmd('ffmpeg','-v','error','-ss',str(t),'-i',p,'-frames:v','1','-vf','scale=48:48','-f','rawvideo','-pix_fmt','rgb24','-threads','1','pipe:1')
def verify(file):
    dest=adb('shell','ls','-t','/sdcard/Movies/MAX\\ EDITOR/').decode().splitlines()[0].strip();target=out/(file+'-clip.mp4');adb('pull','/sdcard/Movies/MAX EDITOR/'+dest,target)
    src=qa/'fixtures'/file
    def tracks(p):return json.loads(cmd('ffprobe','-v','error','-show_streams','-show_format','-of','json',p))
    a,b=tracks(src),tracks(target);dur=float(b['format']['duration']);assert abs(dur-2.5)<.13,dur
    streams=b['streams'];sound=any(s['codec_type']=='audio' for s in streams);assert sound==(file=='mx-land.mp4')
    v=next(s for s in streams if s['codec_type']=='video');rot=next((s['rotation'] for s in v.get('side_data_list',[]) if 'rotation' in s),0);w,h=v['width'],v['height'];display=[h,w] if abs(rot)%180==90 else [w,h];assert display==([320,180] if sound else [180,320]),display
    diffs=[]
    for t in [.25,1,2.25]:
        orig,clip=frames(src,1+t),frames(target,t);assert len(orig)==len(clip)==6912
        diff=sum(abs(x-y) for x,y in zip(orig,clip))/len(orig);diffs.append(round(diff,2));assert diff<12,(t,diff)
    cmd('ffmpeg','-v','error','-xerror','-i',target,'-f','null','-');tone=None
    if sound:
        pcm=array.array('h',cmd('ffmpeg','-v','error','-ss','.2'.replace('.','0.'),'-t','1','-i',target,'-vn','-ac','1','-ar','16000','-f','s16le','-'));tone=sum(x<0<=y for x,y in zip(pcm,pcm[1:]));assert 650<tone<670 and max(pcm)>500,tone
    digest=lambda b:hashlib.sha256(b).hexdigest();sourcehash=digest(src.read_bytes());assert sourcehash==digest(adb('exec-out','cat','/sdcard/Download/'+file))
    result=dict(source=file,duration=dur,display=display,audio=sound,toneHz=tone,frameMeanErrors=diffs,sourceSHA256=sourcehash,outputSHA256=digest(target.read_bytes()));(out/(file+'.json')).write_text(json.dumps(result,indent=2));print(result,flush=True)
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            op,_,name=self.path.strip('/').partition('/');assert name in ('mx-land.mp4','mx-tall.mp4','mx-bad.mp4','land-preview','tall-preview','export-complete')
            if op=='pick':threading.Thread(target=pick,args=(name,),daemon=True).start()
            elif op=='shot':shot(name)
            elif op=='verify':verify(name)
            elif op=='hide':adb('shell','mv','/sdcard/Download/'+name,'/sdcard/Download/'+name+'.off')
            elif op=='show':adb('shell','mv','/sdcard/Download/'+name+'.off','/sdcard/Download/'+name)
            else:raise ValueError(op)
            self.send_response(200);self.end_headers();self.wfile.write(b'ok')
        except Exception as exc:traceback.print_exc();self.send_error(500,str(exc))
if __name__=='__main__':ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
