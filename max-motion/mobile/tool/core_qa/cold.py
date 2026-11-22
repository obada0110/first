"""Force-stop the actual app: prove v1 restore, revoked-SAF recovery and stable IDs."""
import json,re,time,subprocess as sp,os
from pathlib import Path
app='io.github.obada0110.maxeditor.phase3a'
def adb(*a):return sp.check_output(['adb',*a],timeout=35)
def launch():sp.run(['adb','shell','monkey','-p',app,'1'],check=True,stdout=sp.DEVNULL);time.sleep(5)
def stop():sp.run(['adb','shell','am','force-stop',app],check=True)
def snapshot():return json.loads(adb('exec-out','run-as',app,'cat','files/single-v1.json'))
def ui():
 sp.run(['adb','shell','uiautomator','dump','--compressed','/sdcard/core-ui.xml'],stdout=sp.DEVNULL,stderr=sp.DEVNULL)
 return adb('shell','cat','/sdcard/core-ui.xml').decode(errors='replace')
old=snapshot();assert old['schemaVersion']==1 and len(old['mainTrack']['clips'])==2 and old['revision']>=16
stop();launch();time.sleep(2);xml=ui();assert 'تعذّر فتح المصدر المحفوظ' in xml or 'Unable to open the saved source' in xml or 'إعادة ربط ملف المصدر' in xml,xml[:2500]
assert snapshot()==old
Path(os.environ['QA']+'/evidence/permission-revoked.png').write_bytes(adb('exec-out','screencap','-p'))
# User-visible repair in the existing library. Select the same media via the official SAF picker.
label='إعادة ربط ملف المصدر'
if label not in xml:label='Relink source file'
nodes=__import__('xml.etree.ElementTree',fromlist=['ElementTree']).fromstring(xml)
node=next((n for n in nodes.iter('node') if label in n.get('text','') or label in n.get('content-desc','')),None);assert node is not None,label
x,y,x2,y2=map(int,re.findall(r'\d+',node.get('bounds','')));sp.run(['adb','shell','input','tap',str((x+x2)//2),str((y+y2)//2)],check=True);time.sleep(.6)
confirm=next((n for n in __import__('xml.etree.ElementTree',fromlist=['ElementTree']).fromstring(ui()).iter('node') if 'متابعة اختيار الملف' in n.get('text','') or 'Choose source file' in n.get('text','')),None);assert confirm is not None,'relink confirmation missing'
x,y,x2,y2=map(int,re.findall(r'\d+',confirm.get('bounds','')));sp.run(['adb','shell','input','tap',str((x+x2)//2),str((y+y2)//2)],check=True);time.sleep(.6)
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'single_qa'));import host
host.pick('mx-land.mp4')
for _ in range(40):
 time.sleep(.25);xml=ui()
 if 'Add clip' in xml or 'إضافة' in xml:break
assert 'Add clip' in xml or 'إضافة' in xml,xml[:3000]
relinked=snapshot();assert relinked==old
Path(os.environ['QA']+'/evidence/permission-relinked.png').write_bytes(adb('exec-out','screencap','-p'))
# Stop and launch again after reacquisition: ContentResolver.inspect must now succeed.
stop();launch();xml=ui();resume=next((n for n in __import__('xml.etree.ElementTree',fromlist=['ElementTree']).fromstring(xml).iter('node') if n.get('text','').startswith('Resume') or 'استئناف التحرير' in n.get('text','')),None)
if resume is not None:
 x,y,x2,y2=map(int,re.findall(r'\d+',resume.get('bounds','')));sp.run(['adb','shell','input','tap',str((x+x2)//2),str((y+y2)//2)],check=True);time.sleep(2)
xml=ui();assert 'Add clip' in xml or 'إضافة' in xml,xml[:3000];assert snapshot()==old
Path(os.environ['QA']+'/evidence/cold-reopen.png').write_bytes(adb('exec-out','screencap','-p'))
print(json.dumps({'processColdRestore':True,'permissionRevokedAndReacquired':True,'projectDataUnchanged':True,'schemaVersion':1,'revision':old['revision'],'projectId':old['projectId'],'clipIds':[c['id'] for c in old['mainTrack']['clips']],'assetIds':[a['id'] for a in old['assets']]},ensure_ascii=False))
