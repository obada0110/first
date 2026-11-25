"""Supplementary navigation ONLY in a disposable copy of the unchanged editor tests.
Inputs still use their original picker logic. Published files live under Movies,
not Downloads. Select them via DocumentsUI's Recent root, just as a tester can.
Never inject a URI, copy a published file to Downloads, or skip a test assertion.
"""
from pathlib import Path
import sys
p = Path(sys.argv[1]); s = p.read_text(); marker = 'def frames(p,t):'
assert s.count(marker) == 1
helper = '''original_pick = pick
def pick(file):
    if not re.fullmatch(r'MAX-[0-9a-f-]{36}\\.mp4', file):
        return original_pick(file)
    try:
        for _ in range(32):
            ui = [n for n in nodes() if n.get('package','').endswith('documentsui')]
            match = next((n for n in ui if n.get('text') == file), None)
            if match is not None:
                tap(match); print('Selected real published document: '+file,flush=True); return
            recent = next((n for n in ui if n.get('text') == 'Recent' and n.get('resource-id','') != 'com.android.documentsui:id/breadcrumb_text'),None)
            drawer = next((n for n in ui if n.get('content-desc','').lower() in ('show roots','show navigation drawer')),None)
            if recent is not None: tap(recent)
            elif drawer is not None: tap(drawer)
            time.sleep(.4)
        raise RuntimeError('Published file not found in DocumentsUI Recent: '+file)
    except Exception: traceback.print_exc(); shot('published-picker-failure')
'''
p.write_text(s.replace(marker, helper+'\n'+marker))
