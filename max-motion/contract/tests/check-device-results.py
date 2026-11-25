"""A green Gradle invocation with zero instrumentation tests is not acceptance."""
from pathlib import Path
from xml.etree import ElementTree as ET
import sys

expected = {'sharedGoldenClockAndLayers', 'splitUndoRedoAndDurableRestore',
            'trimsRippleDeleteAndDiscardRedo', 'invalidCommandIsAtomic',
            'failedSavePreservesBothHistoryAndRevision', 'rejectMalformedProjects',
            'rollbackInterruptedFileAndCheckFrameEdges'}
passed = set()
for xml in Path(sys.argv[1]).rglob('*.xml'):
    for case in ET.parse(xml).iter('testcase'):
        if case.get('classname') != 'maxeditor.contract.ContractTest':
            continue
        if any(case.find(status) is not None for status in ('failure','error','skipped')):
            raise SystemExit(f'::error::{case.get("name")} failed/skipped: {ET.tostring(case, encoding="unicode")[:1200]}')
        passed.add(case.attrib['name'])
if expected != passed:
    raise SystemExit(f'Expected {sorted(expected)}, observed {sorted(passed)}')
print(f'::notice title=Android contract acceptance::{len(passed)} device tests passed: '+', '.join(sorted(passed)))
