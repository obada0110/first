"""Film the published Android APK, not a reimplementation. Run on a clean API 35 AVD."""
import os, sys, time, subprocess, json
from pathlib import Path
from contextlib import contextmanager
os.environ['QA']=str(Path.cwd()); sys.path.insert(0,'max-motion/mobile/tool/single_qa');from host import adb, find, tap, pick
# The first UI hierarchy may not exist yet while the activity is starting.
import host
read_nodes=host.nodes
def ready_nodes():
    for i in range(8):
        try:return read_nodes()
        except (subprocess.CalledProcessError,ValueError):time.sleep(.6)
    return read_nodes()
host.nodes=ready_nodes
out=Path('capture');out.mkdir(exist_ok=True)
def snap(n): (out/(n+'.png')).write_bytes(adb('exec-out','screencap','-p'))
@contextmanager
def clip(n):
    rec=subprocess.Popen(['adb','shell','screenrecord','--bit-rate','3800000','--time-limit','60','/sdcard/'+n+'.mp4']);time.sleep(1.2)
    try:yield
    finally:
        time.sleep(1);adb('shell','pkill','-INT','screenrecord');rec.wait(timeout=12);adb('pull','/sdcard/'+n+'.mp4',out/(n+'.mp4'))
app='io.github.obada0110.maxeditor';adb('shell','wm','size','600x1080');adb('shell','wm','density','160');adb('shell','settings','put','system','show_touches','1');adb('push','max-motion/media/ridge.mp4','/sdcard/Download/Ridge.mp4');adb('shell','am','broadcast','-a','android.intent.action.MEDIA_SCANNER_SCAN_FILE','-d','file:///sdcard/Download/Ridge.mp4');adb('shell','am','start','-n',app+'/.MainActivity');find('اختيار فيديو');snap('home')
with clip('pages'):
    tap(find('الإعدادات'));find('لغة التطبيق');snap('settings');tap(find('English'));find('Settings');snap('english');tap(find('العربية'));time.sleep(.65);adb('shell','input','keyevent','4');find('اختيار فيديو')
with clip('preview'):
    tap(find('اختيار فيديو'));pick('Ridge.mp4');find('Ridge.mp4');play=find('تشغيل المصدر');tap(play);time.sleep(1.6);snap('preview');tap(play);time.sleep(.5)
with clip('cut'):
    tap(find('البداية عند المؤشر'));tap(play);time.sleep(1.4);tap(play);tap(find('النهاية عند المؤشر'));snap('selection');tap(find('تصدير الجزء المحدد'));find('تم حفظ الفيديو');snap('saved')
p=json.loads(adb('exec-out','run-as',app,'cat','files/single-v1.json'));c=p['mainTrack']['clips'][0];assert 0<c['inUs']<c['outUs']<=p['assets'][0]['durationUs'];print('Recorded',c['inUs'],c['outUs']);(out/'range.json').write_text(json.dumps([c['inUs'],c['outUs']]))
