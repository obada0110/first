import 'dart:io';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:max_editor/main.dart' as app;

void main(){
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('real SAF, playback, selection, exports, cancellation and errors',(tester) async {
    const api=MethodChannel('max_editor/single/v1');
    Future<Map<dynamic,dynamic>> state() async => (await api.invokeMapMethod('state'))!;
    Future<void> host(String path) async {final c=HttpClient();try{final r=await(await c.getUrl(Uri.parse('http://127.0.0.1:8765/$path'))).close();expect(r.statusCode,200);await r.drain<void>();}finally{c.close();}}
    Future<Map<dynamic,dynamic>> until(bool Function(Map<dynamic,dynamic>) predicate) async {for(var i=0;i<160;i++){final s=await state();if(predicate(s))return s;await tester.pump(const Duration(milliseconds:200));}throw StateError('timeout: ${await state()}');}
    Future<void> open(String file) async {printOnFailure('opening $file');await host('pick/$file');await api.invokeMethod('open').timeout(const Duration(seconds:70));}
    await app.main();await tester.pump();await Future<void>.delayed(const Duration(seconds:1));await until((s)=>s['working']==false);
    for(final file in ['mx-land.mp4','mx-tall.mp4']){
      await open(file);final s=await state();expect(s['duration'],closeTo(6000000,45000));expect(s['w'],file=='mx-land.mp4'?320:180);expect(s['audio'],file=='mx-land.mp4');
      await api.invokeMethod('play');await until((s)=>s['position']>400000 && s['playing']==true);await api.invokeMethod('play');await api.invokeMethod('seek',{'us':1500000});await tester.pump(const Duration(milliseconds:500));await host('shot/${file=='mx-land.mp4'?'land':'tall'}-preview');
      await expectLater(api.invokeMethod('range',{'from':0,'to':20000,'revision':0}),throwsA(isA<PlatformException>()));
      await api.invokeMethod('range',{'from':1000000,'to':3500000,'revision':0});
      await api.invokeMethod('export');await api.invokeMethod('cancel');expect((await state())['export'],'cancelled');
      await api.invokeMethod('export');final finished=await until((s)=>!['exporting','publishing'].contains(s['export']));expect(finished['export'],'done',reason:'$finished');await host('verify/$file');
      await tester.pump(const Duration(milliseconds:300));await host('shot/export-complete');
    }
    await expectLater(open('mx-bad.mp4'),throwsA(isA<PlatformException>()));expect((await state())['name'],'mx-tall.mp4');
    await host('hide/mx-tall.mp4');try{await api.invokeMethod('export');final failed=await until((s)=>!['exporting','publishing'].contains(s['export']));expect(failed['export'],'exportError');await expectLater(api.invokeMethod('restore'),throwsA(isA<PlatformException>()));expect((await state())['issue'],'missing');}finally{await host('show/mx-tall.mp4');}
  },timeout:const Timeout(Duration(minutes:6)));
}
