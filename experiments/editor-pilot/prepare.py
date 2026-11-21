"""Materialize disposable hosts from the frozen Git tree, never from user storage."""
import sys,subprocess,tarfile,io,shutil,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; LAB=Path(__file__).resolve().parent
BASE='9fba216f7652eb7bef580ddd6b9a30da0283aefa'
out=Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
src=subprocess.check_output(['git','archive',BASE,'max-motion','experiments/max-core-kmp','experiments/max-integration'],cwd=ROOT);tarfile.open(fileobj=io.BytesIO(src)).extractall(out,filter='data')
def replace(p,a,b):
 t=p.read_text();assert t.count(a)==1,(p,a);p.write_text(t.replace(a,b))
k=out/'experiments/max-core-kmp/src/commonMain/kotlin/core/Engine.kt';replace(k,'val args=when(op){','val args=when(op){"addClip"->setOf("clip");');replace(k,'val candidate=when(op){','''val candidate=when(op){
            "addClip" -> { clips.add(c.getValue("clip").jsonObject); track(p,clips) }''')
# ABI 2 only, append to existing v1 asset; global candidate validation/history from the original session.
k=out/'experiments/max-integration/common/Port.kt';replace(k,'put("api", 1)','put("api", 2)');replace(k,'== JsonPrimitive(1)','== JsonPrimitive(2)')
w=out/'max-motion';m=w/'mobile'; lib=m/'lib'; android=m/'android/app';src=android/'src/main/kotlin/io/github/obada0110/maxeditor';
replace(android/'build.gradle.kts','applicationId = "io.github.obada0110.maxeditor"','applicationId = "lab.maxeditor.hostpilot"');replace(android/'build.gradle.kts','dependencies {','dependencies {\n    implementation(files("libs/core-pilot.jar"))');
replace(src/'MainActivity.kt','val messenger = flutterEngine.dartExecutor.binaryMessenger','val messenger = flutterEngine.dartExecutor.binaryMessenger\n        PilotChannel(this, messenger)');shutil.copy(LAB/'android/PilotChannel.kt',src);shutil.copy(LAB/'android/PilotView.kt',src)
replace(android/'src/main/AndroidManifest.xml','android:label="MAX EDITOR"','android:usesCleartextTraffic="true" android:label="MAX Host Pilot"');replace(android/'src/main/AndroidManifest.xml','        <!-- Don\'t delete','        <activity android:name=".PilotView" android:exported="true"/>\n        <!-- Don\'t delete')
shutil.copy(LAB/'android/pilot_screen.dart',lib/'features/single');replace(lib/'features/single/single_screen.dart',"import 'source_timeline.dart';","import 'source_timeline.dart';\nimport 'pilot_screen.dart';");replace(lib/'features/single/single_screen.dart','child: Scaffold(','child: Scaffold(\n        floatingActionButton: home ? FloatingActionButton.small(key: const ValueKey("pilot"),onPressed:()=>Navigator.of(context).push(MaterialPageRoute(builder:(_)=>const PilotScreen())),child:const Text("K")) : null,');shutil.copy(LAB/'tests/pilot_test.dart',m/'integration_test')
a=android/'src/main/assets';a.mkdir(exist_ok=True,parents=True);shutil.copy(w/'contract/fixtures/project.json',a/'pilot.json');(android/'libs').mkdir(exist_ok=True)
# Web path is an isolated origin and a fresh profile; additionally namespace any legacy DB opens.
replace(w/'interface/library.js','"max-motion-studio"','"max-pilot-fallback-library"');replace(w/'editor.js','function edit(op) {','function edit(op) {\n  if(window.hostPilotEdit) return window.hostPilotEdit(op);');replace(w/'index.html','</body>','<script type="module" src="pilot.mjs"></script></body>');shutil.copy(LAB/'web/pilot.mjs',w);shutil.copy(LAB/'web/index.html',w/'fixture.html');shutil.copy(LAB/'tests/browser-suite.mjs',w);(w/'pilot-schema.json').write_bytes((w/'contract/schema/project-v1.json').read_bytes())
