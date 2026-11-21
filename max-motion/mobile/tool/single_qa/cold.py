"""Production entry point, actual process termination. No debug-only application commands."""
from host import *
activity=app+'/.MainActivity'
def launch():adb('shell','am','start','-n',activity);time.sleep(2)
def stop():adb('shell','am','force-stop',app)
def snapshot():return json.loads(adb('exec-out','run-as',app,'cat','files/single-v1.json'))
from identity_evidence import empty_proof, rotation_proof
launch();empty_proof(launch,stop);tap(find('اختيار فيديو'));pick('mx-land.mp4');find('mx-land.mp4');play=find('تشغيل المصدر');tap(play);time.sleep(1.4);tap(play);tap(find('البداية عند المؤشر'));time.sleep(.5);a=snapshot();c=a['mainTrack']['clips'][0];assert 50000<=c['inUs']<c['outUs'] and a['revision']>0,c;stop();launch();find('mx-land.mp4');find('تشغيل المصدر');assert snapshot()==a;shot('restored');rotation_proof(snapshot);stop();adb('shell','mv','/sdcard/Download/mx-land.mp4','/data/local/tmp/mx-land.off');launch();find('تعذّر فتح المصدر');assert snapshot()==a;shot('missing');(out/'cold.json').write_text(json.dumps({'revision':a['revision'],'inUs':c['inUs'],'outUs':c['outUs'],'snapshotUnchanged':True,'missingReported':True},indent=2));print('PASS production cold reopen + missing source')
# Open a published MP4 in the emulator's independent system player (not Flutter).
rows=adb('shell','content','query','--uri','content://media/external/video/media','--projection','_id:_display_name').decode()
ids=re.findall(r'_id=(\d+), _display_name=MAX-',rows);assert len(ids)==2,rows
adb('shell','am','start','-W','-a','android.intent.action.VIEW','-n','com.android.gallery3d/.app.MovieActivity','-d','content://media/external/video/media/'+ids[0],'-t','video/mp4','-f','1');time.sleep(.45);shot('output-playing');print('PASS system player opened the published MediaStore URI')
