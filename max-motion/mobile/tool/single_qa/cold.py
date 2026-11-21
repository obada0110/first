"""Production entry point, actual process termination. No debug-only application commands."""
from host import *
activity=app+'/.MainActivity'
def launch():adb('shell','am','start','-n',activity);time.sleep(2)
def stop():adb('shell','am','force-stop',app)
def snapshot():return json.loads(adb('exec-out','run-as',app,'cat','files/single-v1.json'))
launch();tap(find('اختيار فيديو'));pick('mx-land.mp4');find('mx-land.mp4');play=find('تشغيل المصدر');tap(play);time.sleep(1.4);tap(play);tap(find('البداية عند المؤشر'));time.sleep(.5);a=snapshot();c=a['mainTrack']['clips'][0];assert 50000<=c['inUs']<c['outUs'] and a['revision']>0,c;stop();launch();find('mx-land.mp4');find('تشغيل المصدر');assert snapshot()==a;shot('restored');stop();adb('shell','mv','/sdcard/Download/mx-land.mp4','/sdcard/Download/mx-land.off');launch();find('تعذّر فتح المصدر');assert snapshot()==a;shot('missing');(out/'cold.json').write_text(json.dumps({'revision':a['revision'],'inUs':c['inUs'],'outUs':c['outUs'],'snapshotUnchanged':True,'missingReported':True},indent=2));print('PASS production cold reopen + missing source')
