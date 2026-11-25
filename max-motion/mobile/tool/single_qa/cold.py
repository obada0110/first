"""Production entry point, actual process termination. No debug-only application commands."""
from host import *
activity=app+'/.MainActivity'
def launch():adb('shell','am','start','-n',activity);time.sleep(2)
def stop():adb('shell','am','force-stop',app)
def snapshot():return json.loads(adb('exec-out','run-as',app,'cat','files/single-v1.json'))
from identity_evidence import empty_proof, rotation_proof
launch(); empty_proof(launch,stop)
tap(find('اختيار فيديو')); pick('mx-land.mp4'); find('mx-land.mp4')
play=find('تشغيل المصدر'); tap(play); time.sleep(1.4); tap(play)
initial=snapshot(); tap(find('تحديد المقطع وفتح القص'))
tap(find('البداية عند المؤشر')); assert snapshot()==initial
# Discard is local only; then explicitly commit the same playhead position.
tap(find('إلغاء المسودة')); assert snapshot()==initial
tap(find('البداية عند المؤشر')); tap(find('حفظ النطاق')); find('تم حفظ نطاق المقطع')
a=snapshot(); c=a['mainTrack']['clips'][0]; assert 50000<=c['inUs']<c['outUs'] and a['revision']>0,c
shot('trim-saved'); stop(); launch(); find('mx-land.mp4'); shot('home-resume')
# Replacement can be abandoned before opening SAF and inside the system picker.
tap(find('اختيار فيديو')); tap(find('إلغاء')); assert snapshot()==a
tap(find('اختيار فيديو')); tap(find('اختيار فيديو من الملفات')); time.sleep(1); adb('shell','input','keyevent','4'); find('استئناف التحرير'); assert snapshot()==a
tap(find('استئناف التحرير')); find('تشغيل المصدر'); assert snapshot()==a; shot('restored'); rotation_proof(snapshot)
adb('shell','wm','size','390x844'); time.sleep(1); find('mx-land.mp4'); shot('phone-source')
tap(find('تحديد المقطع وفتح القص')); find('خصائص المقطع'); shot('phone-trim')
tap(find('مراجعة التصدير')); find('مراجعة التصدير'); shot('export-review')
adb('shell','wm','size','600x1080'); stop(); adb('shell','mv','/sdcard/Download/mx-land.mp4','/data/local/tmp/mx-land.off'); launch()
find('تعذّر فتح المصدر'); assert snapshot()==a; shot('missing')
(out/'cold.json').write_text(json.dumps({'revision':a['revision'],'inUs':c['inUs'],'outUs':c['outUs'],'snapshotUnchanged':True,'missingReported':True,'draftDiscardedWithoutWrite':True,'replacementCancelledBeforeAndInsidePicker':True},indent=2))
print('PASS production cold reopen + missing source + draft/replace cancellation')
# Open a published MP4 in the emulator's independent system player (not Flutter).
rows=adb('shell','content','query','--uri','content://media/external/video/media','--projection','_id:_display_name').decode()
ids=re.findall(r'_id=(\d+), _display_name=MAX-',rows);assert len(ids)==2,rows
adb('shell','am','start','-W','-a','android.intent.action.VIEW','-n','com.android.gallery3d/.app.MovieActivity','-d','content://media/external/video/media/'+ids[0],'-t','video/mp4','-f','1');time.sleep(.45);shot('output-playing');print('PASS system player opened the published MediaStore URI')
