"""Observe the real legacy monitor inside the separate application ID on an empty emulator.
Do not run this helper against a user's phone or alter the production package.
"""
import os,sys,time,json,subprocess as sp
from pathlib import Path
out=Path(sys.argv[2]); os.environ['QA']=str(out.parent); sys.path.insert(0,str(Path(sys.argv[1])/'mobile/tool/single_qa'));import host
host.app='lab.maxeditor.hostpilot';host.out=out
adb,find,tap=host.adb,host.find,host.tap
assert b'1' in (adb('shell','getprop','ro.boot.qemu')+adb('shell','getprop','ro.kernel.qemu'))
activity=host.app+'/io.github.obada0110.maxeditor.MainActivity'
def launch():adb('shell','am','start','-W','-n',activity);time.sleep(2)
def stop():adb('shell','am','force-stop',host.app)
def snap():return json.loads(adb('exec-out','run-as',host.app,'cat','files/single-v1.json'))
def capture(n,land=False):
 f=out/(n+'.png');f.write_bytes(adb('exec-out','screencap','-p'));x,y=(778,250) if land else (268,194);pixels=sp.check_output(['ffmpeg','-v','error','-i',str(f),'-vf',f'crop=64:64:{x}:{y}','-f','rawvideo','-pix_fmt','rgb24','-threads','1','-']);assert len(pixels)==4096*3;rgb=list(zip(pixels[::3],pixels[1::3],pixels[2::3]));return {'image':f.name,'box':[x,y,64,64],'saturated':sum(max(p)-min(p)>50 for p in rgb),'nearBlack':sum(max(p)<12 for p in rgb),'pixels':len(rgb)}
try:
 adb('shell','wm','size','600x1080');adb('shell','wm','density','160');adb('shell','settings','put','system','accelerometer_rotation','0');adb('shell','settings','put','system','user_rotation','0');launch();tap(find('اختيار فيديو'));find('mx-land.mp4');host.pick('mx-land.mp4');find('تشغيل المصدر');play=find('تشغيل المصدر');tap(play);time.sleep(1);rows=[capture('live')];tap(play);tap(find('تحديد المقطع وفتح القص'));tap(find('البداية عند المؤشر'));tap(find('حفظ النطاق'));find('تم حفظ نطاق المقطع');saved=snap();stop();launch();tap(find('استئناف التحرير'));find('تشغيل المصدر');time.sleep(1);rows.append(capture('paused-restore'));adb('shell','settings','put','system','user_rotation','1');time.sleep(2);find('mx-land.mp4');rows.append(capture('paused-rotate',True));assert snap()==saved
 (out/'paused.json').write_text(json.dumps({'stateUnchanged':True,'revision':saved['revision'],'samples':rows,'frameGatePassed':rows[0]['saturated']>500 and all(row['saturated']>500 for row in rows[1:])},indent=2))
finally:
 adb('shell','settings','put','system','user_rotation','0');stop()
