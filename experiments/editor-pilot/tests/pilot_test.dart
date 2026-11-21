import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:max_editor/main.dart' as app;
import 'package:max_editor/features/single/source_timeline.dart';

void main(){IntegrationTestWidgetsFlutterBinding.ensureInitialized();testWidgets('real home, fixture route, timeline and native port', (t)async{
 const ch=MethodChannel('max_editor/fixture_pilot');final http=HttpClient();final states=[],views=[],timings=[];
 Future<Map> call(String method,d)async=>jsonDecode((await ch.invokeMethod<String>('call',jsonEncode({'api':2,'method':method,'data':d})))!);
 Future<String> raw()async=>(await call('snapshot',null))['value'] as String;
 Future<void> waitFor(bool Function() done)async{for(int i=0;i<200;i++){await t.pump(const Duration(milliseconds:30));if(done())return;}fail('timed out waiting for fixture UI');}
 String status()=>t.widget<Text>(find.byKey(const ValueKey('pilot-status'))).data!;
 Future<void> tap(String key)async{final f=find.byKey(ValueKey(key));await t.ensureVisible(f);await t.tap(f);await t.pump();}
 Future<void> route()async{await tap('pilot');await t.pumpAndSettle();await waitFor(()=>find.byKey(const ValueKey('pilot-status')).evaluate().isNotEmpty&&status()=='seed:0');}
 Future<void> op(String name,int rev,{String? id,int? time})async{if(id!=null)await tap('select:$id');if(time!=null){final slider=t.widget<Slider>(find.byKey(const ValueKey('source-clock')));slider.onChanged!(time.toDouble());await t.pump();}
 final sw=Stopwatch()..start();await tap('op:$name');await waitFor(()=>status()=='$name:$rev');timings.add(sw.elapsedMicroseconds/1000);states.add(jsonDecode(await raw()));final v=t.widget<SourceTimeline>(find.byType(SourceTimeline));views.add({'name':v.name,'duration':v.duration,'start':v.start,'end':v.end});}
 await app.main();await t.pumpAndSettle();await route();await op('addClip',1);await op('trimRight',2,id:'intro',time:1500000);await op('split',3,id:'cA',time:2500000);await op('delete',4,id:'extra0');await op('order',5);await op('undo',6);await op('redo',7);
 final before=await raw();expect((await call('edit',{'op':'undo','expectedRevision':0}))['error'],'STALE_REVISION');expect(await raw(),before);
 await tap('op:save');await waitFor(()=>status()=='save:7');await t.pageBack();await t.pumpAndSettle();await route();await tap('op:restore');await waitFor(()=>status()=='restore:7');expect(await raw(),before);expect((await call('edit',{'op':'undo','expectedRevision':7}))['error'],'UNDO_EMPTY');
 // This response is the browser's actual restored snapshot, not its expected vector.
 final res=await(await http.getUrl(Uri.parse('http://127.0.0.1:8974/handoff.json'))).close();expect(res.statusCode,200);final incoming=await utf8.decoder.bind(res).join();expect(jsonDecode(incoming),jsonDecode(before));final opened=jsonDecode((await ch.invokeMethod<String>('import',incoming))!);expect(opened['ok'],true);await ch.invokeMethod<String>('save');await tap('op:restore');await waitFor(()=>status()=='restore:7');await op('trimLeft',8,id:'intro',time:500000);await tap('op:save');await waitFor(()=>status()=='save:8');
 final req=await http.postUrl(Uri.parse('http://127.0.0.1:8974/result/android'));req.write(jsonEncode({'states':states,'views':views,'elapsed':timings,'restored':jsonDecode(before)}));expect((await req.close()).statusCode,200);http.close();
 },timeout:const Timeout(Duration(minutes:5)));}
