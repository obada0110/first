"""Offline sanity checks; these do not replace flutter analyze/test/build."""
import json
from pathlib import Path
import re
from xml.etree import ElementTree
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
messages = {}
for file in sorted((root/'lib/l10n').glob('*.arb')):
    data = json.loads(file.read_text())
    tag = data['@@locale']
    assert file.stem == f'app_{tag}', file
    messages[tag] = {key for key, value in data.items() if not key.startswith('@')}
    assert all(isinstance(data[k], str) and data[k].strip() for k in messages[tag])
assert {'ar', 'en'} <= messages.keys() and all(v == messages['en'] for v in messages.values())
for file in (root/'lib').rglob('*.dart'):
    if 'generated' not in file.parts:
        assert not re.search(r'''\bText\(\s*['"]''', file.read_text()), file
for file in (root/'android/app/src').rglob('*.xml'):
    ElementTree.parse(file)
manifest = (root/'android/app/src/main/AndroidManifest.xml').read_text()
assert 'android:supportsRtl="true"' in manifest and '<uses-permission' not in manifest
for file in (root/'android').rglob('*.kts'):
    assert '{{' not in file.read_text(), file
with ZipFile(root/'android/gradle/wrapper/gradle-wrapper.jar') as jar:
    assert jar.testzip() is None and 'org/gradle/wrapper/GradleWrapperMain.class' in jar.namelist()
print(f'PASS: {len(messages)} locale files, {len(messages["en"])} common messages, UI literal guard, Android XML, wrapper archive and Gradle template sanity.')
