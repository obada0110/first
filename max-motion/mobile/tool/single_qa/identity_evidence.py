"""Inspection only of the installed release under test; app data cleared only by the test harness."""
from host import adb, find, tap, shot, nodes, out, app
import json, time
from pathlib import Path
from zipfile import ZipFile
from hashlib import sha256
import os

def empty_proof(launch,stop):
    apk=Path(os.environ['RUNNER_TEMP'])/'normal.apk'
    with ZipFile(apk) as z:
        prefix='assets/flutter_assets/'
        manifest=json.loads(z.read(prefix+'FontManifest.json'))
        taj=next(e for e in manifest if e['family']=='Tajawal')['fonts'];assert [f['weight'] for f in taj]==[400,500,700],taj
        for f in taj:assert z.read(prefix+f['asset'])==Path(f['asset']).read_bytes()
        assert not any(x.startswith(prefix) and x.lower().endswith(('.jpg','.jpeg','.webp','.mp4')) for x in z.namelist())
    captures=[]
    for name in ['empty-first','empty-reopened']:
        find('مشروع جديد');find('اختيار فيديو');shot(name)
        ns=nodes();assert all('قوالب البداية' not in n.get('content-desc','')+n.get('text','') for n in ns)
        assert 'single-v1.json' not in adb('shell','run-as',app,'ls','files').decode().splitlines()
        captures.append(name)
        if name=='empty-first':stop();launch()
    try:
        adb('shell','wm','size','320x680');adb('shell','settings','put','system','font_scale','2.0');time.sleep(1.5)
        find('مشروع جديد');find('اختيار فيديو');shot('empty-320-large-text')
    finally:
        adb('shell','settings','put','system','font_scale','1.0');adb('shell','wm','size','600x1080');time.sleep(1)
    tap(find('الإعدادات'));find('لغة التطبيق');shot('settings-ar');tap(find('English'));find('Settings');shot('settings-en');tap(find('العربية'));find('الإعدادات');adb('shell','input','keyevent','4');find('مشروع جديد')
    (out/'identity.json').write_text(json.dumps({'fonts':taj,'apkSha256':sha256(apk.read_bytes()).hexdigest(),'emptyStarts':captures,'noSeededProject':True,'settings':['ar','en']},indent=2))

def rotation_proof(snapshot):
    # Preserve one real committed range while the Android surface is re-laid out.
    original=snapshot()
    try:
        adb('shell','settings','put','system','accelerometer_rotation','0')
        adb('shell','settings','put','system','user_rotation','1');time.sleep(2)
        find('mx-land.mp4');shot('workspace-landscape')
        import struct
        width,height=struct.unpack('>II',(out/'workspace-landscape.png').read_bytes()[16:24]);assert width>height,(width,height)
        assert snapshot()==original
    finally:
        adb('shell','settings','put','system','user_rotation','0');time.sleep(1)
    find('mx-land.mp4');assert snapshot()==original
