import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:max_editor/main.dart' as app;

void main(){
 IntegrationTestWidgetsFlutterBinding.ensureInitialized();
 testWidgets('real MAX EDITOR screen uses durable shared core behind debug-only flag',(tester)async{
  const legacy=MethodChannel('max_editor/single/v1'),core=MethodChannel('max_editor/project_core/v1');
  Future<void> host(String path)async{final c=HttpClient();try{final r=await(await c.getUrl(Uri.parse('http://127.0.0.1:8765/$path'))).close();expect(r.statusCode,200);await r.drain<void>();}finally{c.close();}}
  Future<Map> post(String path,Map<String,dynamic> data)async{final c=HttpClient();try{final q=await c.postUrl(Uri.parse('http://127.0.0.1:8765/$path'));q.headers.contentType=ContentType.json;q.write(jsonEncode(data));final r=await q.close();expect(r.statusCode,200);return jsonDecode(await r.transform(utf8.decoder).join()) as Map;}finally{c.close();}}
  Future<Map> frame(String name)async{final rect=tester.getRect(find.byKey(const ValueKey('monitor')));final dpr=tester.view.devicePixelRatio;final inset=tester.view.padding.top/dpr;final pixels=await post('frame-$name',{'x':((rect.left)*dpr).round(),'y':((rect.top+inset)*dpr).round(),'w':(rect.width*dpr).round(),'h':(rect.height*dpr).round()});final state=(await legacy.invokeMapMethod('state'))!;return {...pixels,'renderedFrames':state['renderedFrames']};}
  Future<Map> snapshot()async=>jsonDecode((await core.invokeMethod<String>('snapshot'))!) as Map;
  Future<Map> memory()async{final c=HttpClient();try{final r=await(await c.getUrl(Uri.parse('http://127.0.0.1:8765/memory'))).close();expect(r.statusCode,200);return jsonDecode(await r.transform(utf8.decoder).join()) as Map;}finally{c.close();}}
  Future<Map> checkpoint()async{final c=HttpClient();try{final r=await(await c.getUrl(Uri.parse('http://127.0.0.1:8765/checkpoint'))).close();expect(r.statusCode,200);return jsonDecode(await r.transform(utf8.decoder).join()) as Map;}finally{c.close();}}
  Future<Map> waitState(bool Function(Map) ok)async{for(var i=0;i<100;i++){final s=(await legacy.invokeMapMethod('state'))!;if(ok(s))return s;await tester.pump(const Duration(milliseconds:100));}throw StateError('timeout ${(await legacy.invokeMapMethod('state'))}');}
  Future<void> tapKey(String key)async{final f=find.byKey(ValueKey(key));expect(f,findsOneWidget);await tester.ensureVisible(f);await tester.tap(f);await tester.pump();await tester.pump(const Duration(milliseconds:400));}
  Future<void> revision(int n)async{for(var i=0;i<60;i++){if((await snapshot())['revision']==n)return;await tester.pump(const Duration(milliseconds:100));}fail('revision $n not reached: ${await snapshot()}');}
  await app.main();await tester.pump();await Future<void>.delayed(const Duration(seconds:1));await tester.pump();
  expect(await core.invokeMethod<bool>('enabled'),isTrue);
  await host('pick/mx-land.mp4');await legacy.invokeMethod('open').timeout(const Duration(seconds:60));await waitState((s)=>s['duration']!=null);
  await tester.pump();await tester.pump(const Duration(milliseconds:500));var p=await snapshot();expect(p['schemaVersion'],1);expect((p['mainTrack']['clips'] as List).length,1);expect(p['revision'],0);
  await host('shot/phase3a-before-editor');
  await legacy.invokeMethod('play');await waitState((s)=>(s['position'] as int)>800000&&s['playing']==true);final live=await frame('frame-live');stdout.writeln('FRAME_LIVE ${jsonEncode(live)}');expect(live['saturated'],greaterThan(500));
  await legacy.invokeMethod('play');await waitState((s)=>s['playing']==false);await legacy.invokeMethod('restore');await waitState((s)=>s['playing']==false);await tester.pump(const Duration(seconds:2));final restoredFrame=await frame('frame-restored');stdout.writeln('FRAME_RESTORED ${jsonEncode(restoredFrame)}');
  await tapKey('core-add');await revision(1);p=await snapshot();expect((p['mainTrack']['clips'] as List).length,2);final ids0=(p['mainTrack']['clips'] as List).map((c)=>c['id']).toList();expect(ids0.toSet().length,2);
  await legacy.invokeMethod('seek',{'us':3000000});await waitState((s)=>(s['position'] as int)>=2900000);
  await tapKey('core-trim-end');await revision(2);p=await snapshot();expect((p['mainTrack']['clips'][1]['outUs']),3000000);
  await legacy.invokeMethod('seek',{'us':1500000});await waitState((s)=>(s['position'] as int)>=1400000);
  await tapKey('core-split');await revision(3);p=await snapshot();expect((p['mainTrack']['clips'] as List).length,3);final splitId=p['mainTrack']['clips'][2]['id'];expect(p['mainTrack']['clips'][2]['inUs'],1500000);
  await tapKey('core-left');await revision(4);p=await snapshot();expect(p['mainTrack']['clips'][0]['id'],ids0[0]);
  // A second move verifies ordered clips while retaining all stable IDs.

  await tapKey('core-left');await revision(5);p=await snapshot();expect(p['mainTrack']['clips'][0]['id'],splitId);
  await tapKey('core-undo');await revision(6);p=await snapshot();expect(p['mainTrack']['clips'][0]['id'],ids0[0]);
  await tapKey('core-redo');await revision(7);p=await snapshot();expect(p['mainTrack']['clips'][0]['id'],splitId);
  await tapKey('core-delete');await revision(8);p=await snapshot();expect((p['mainTrack']['clips'] as List).length,2);
  final dragTimes=<double>[];
  for(var i=0;i<8;i++){
   final current=await snapshot(),clips=current['mainTrack']['clips'] as List;final from=clips.last['id'] as String,to=clips.first['id'] as String;
   final source=find.byKey(ValueKey('core-clip-item-$from')),target=find.byKey(ValueKey('core-clip-item-$to'));
   await tester.ensureVisible(source);await tester.ensureVisible(target);final a=tester.getCenter(source),b=tester.getCenter(target);final sw=Stopwatch()..start();
   await tester.timedDragFrom(a,b-a,const Duration(milliseconds:350));await tester.pump(const Duration(milliseconds:500));
   await revision((current['revision'] as int)+1);sw.stop();dragTimes.add(sw.elapsedMicroseconds/1000);
   expect((await snapshot())['mainTrack']['clips'][0]['id'],from);
  }
  p=await snapshot();var persisted=await checkpoint();expect(persisted,p);expect(persisted['schemaVersion'],1);expect(persisted['projectId'],p['projectId']);expect((persisted['assets'] as List).map((a)=>a['id']).toList(),(p['assets'] as List).map((a)=>a['id']).toList());
  final dragSorted=[...dragTimes]..sort();final uiPerf={'clipReorderDrags':dragTimes.length,'medianHarnessMs':dragSorted[dragSorted.length~/2],'maxHarnessMs':dragSorted.last,'revision':p['revision']};stdout.writeln('UI_DRAG ${jsonEncode(uiPerf)}');
  await host('shot/phase3a-after-seven-commands-and-drag');
  // RTL/LTR remain the existing app locale behavior while the production controls are mounted.
  await tester.tap(find.byKey(const ValueKey('settings')));await tester.pump();await tester.pump(const Duration(milliseconds:500));
  for(final lang in ['en','ar']){await tester.tap(find.byKey(ValueKey(lang)));await tester.pump();await tester.pump(const Duration(milliseconds:500));expect(Localizations.localeOf(tester.element(find.byKey(ValueKey(lang)))).languageCode,lang);expect(Directionality.of(tester.element(find.byKey(ValueKey(lang)))),lang=='ar'?TextDirection.rtl:TextDirection.ltr);}
  await tester.pageBack();await tester.pump();await tester.pump(const Duration(milliseconds:500));
  await host('rotate/landscape');await tester.pump(const Duration(seconds:3));final rotatedFrame=await frame('frame-rotated');stdout.writeln('FRAME_ROTATED ${jsonEncode(rotatedFrame)}');await host('rotate/portrait');await tester.pump(const Duration(seconds:3));
  // Independent 22-clip file/state stress after UI acceptance; no UI project changes are pending.
  final memoryBefore=await memory();final samples=<double>[];final base=Map<String,dynamic>.from(p['mainTrack']['clips'][0] as Map);
  for(var i=0;i<20;i++){final before=await snapshot();final clip={...base,'id':'stress${i.toString().padLeft(2,'0')}'};final sw=Stopwatch()..start();final next=await core.invokeMethod<String>('edit',jsonEncode({'op':'addClip','expectedRevision':before['revision'],'clip':clip}));sw.stop();samples.add(sw.elapsedMicroseconds/1000);p=jsonDecode(next!) as Map;}
  for(var i=0;i<20;i++){final before=await snapshot();final sw=Stopwatch()..start();final next=await core.invokeMethod<String>('edit',jsonEncode({'op':'delete','expectedRevision':before['revision'],'id':'stress${i.toString().padLeft(2,'0')}'}));sw.stop();samples.add(sw.elapsedMicroseconds/1000);p=jsonDecode(next!) as Map;}
  final memoryAfter=await memory();final sorted=[...samples]..sort();final perf={'memoryBefore':memoryBefore,'memoryAfter':memoryAfter,'channelEdits':samples.length,'channelMedianMs':sorted[sorted.length~/2],'channelP95Ms':sorted[(sorted.length*.95).floor()],'channelMaxMs':sorted.last,'clipReorderDrags':dragTimes.length,'dragHarnessMedianMs':dragSorted[dragSorted.length~/2],'dragHarnessMaxMs':dragSorted.last,'projectClipPeak':22,'finalClips':(p['mainTrack']['clips'] as List).length,'serializedBytes':utf8.encode(jsonEncode(p)).length};stdout.writeln('CORE_STRESS ${jsonEncode(perf)}');await post('metrics',perf);persisted=await checkpoint();expect(persisted,p);
  final reopened=jsonDecode((await core.invokeMethod<String>('reload'))!) as Map;expect(reopened,persisted);expect(await snapshot(),persisted);
  await expectLater(core.invokeMethod('edit',jsonEncode({'op':'undo','expectedRevision':p['revision']-1})),throwsA(isA<PlatformException>()));expect(await checkpoint(),persisted);
  // Reopening the session establishes a fresh, deliberately non-portable undo boundary.
  await expectLater(core.invokeMethod('edit',jsonEncode({'op':'undo','expectedRevision':p['revision']})),throwsA(isA<PlatformException>()));expect(await snapshot(),persisted);
  final c=HttpClient();try{final r=await(await c.getUrl(Uri.parse('http://127.0.0.1:8765/shot/phase3a-after-commands-and-stress'))).close();expect(r.statusCode,200);await r.drain<void>();}finally{c.close();}
 },timeout:const Timeout(Duration(minutes:5)));
}
