import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:max_editor/app/design/max_theme.dart';
import 'package:max_editor/app/locale_controller.dart';
import 'package:max_editor/app/max_editor_app.dart';
import 'package:max_editor/features/settings/locale_preferences.dart';

class _Prefs implements LocalePreferences {
  _Prefs(this.tag);final String tag;
  @override Future<String?> readTag() async => tag;
  @override Future<void> writeTag(String tag) async {}
}
void main(){
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final loader=FontLoader('Tajawal');
    for(final name in ['Regular','Medium','Bold']){loader.addFont(rootBundle.load('assets/fonts/Tajawal-$name.ttf'));}
    await loader.load();
  });
  for(final lang in ['ar','en']){
    for(final size in [const Size(320,640),const Size(360,720),const Size(390,844),const Size(800,360),const Size(1024,720)]){
      for(final scale in [1.0,1.3,2.0]){
        testWidgets('identity $lang ${size.width}x${size.height} text $scale',(t) async {
          t.view.devicePixelRatio=1;t.view.physicalSize=size;t.platformDispatcher.textScaleFactorTestValue=scale;
          addTearDown((){t.view.reset();t.platformDispatcher.clearTextScaleFactorTestValue();});
          final messenger=TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
          const api=MethodChannel('max_editor/single/v1');
          final seeks=<int>[];
          messenger.setMockMethodCallHandler(api,(call) async {
            if(call.method=='seek')seeks.add(call.arguments['us'] as int);
            return call.method=='state'?{'duration':6000000,'position':2000000,'from':1000000,'to':3500000,'name':'مشهد_الرحلة_الجبلية_Ridge_Final_Take_018.mp4','revision':1,'w':320,'h':180,'rot':0,'fps':24,'audio':true}:null;
          });
          messenger.setMockMethodCallHandler(SystemChannels.platform_views,(c) async=>c.method=='create'?0:null);
          final ctrl=LocaleController(_Prefs(lang));await ctrl.restore();await t.pumpWidget(MaxEditorApp(controller:ctrl));await t.pump();await t.pump();
          final clock=find.byKey(const ValueKey('source-clock'));
          expect(Directionality.of(t.element(clock)),TextDirection.ltr);
          final ctx=t.element(find.byKey(const ValueKey('settings')));
          expect(Directionality.of(ctx),lang=='ar'?TextDirection.rtl:TextDirection.ltr);
          final theme=Theme.of(ctx);expect(theme.scaffoldBackgroundColor,Mx.canvas);expect(theme.colorScheme.primary,Mx.gold);
          for(final pair in [(theme.textTheme.titleLarge!,FontWeight.w700),(theme.textTheme.titleMedium!,FontWeight.w500),(theme.textTheme.bodyMedium!,FontWeight.w400)]){
            expect(pair.$1.fontFamily,'Tajawal');expect(pair.$1.fontWeight,pair.$2);
          }
          final style=theme.filledButtonTheme.style!;expect(style.textStyle!.resolve({})!.fontWeight,FontWeight.w500);expect(style.shape!.resolve({}),const RoundedRectangleBorder(borderRadius:Mx.control));
          expect(find.byKey(const ValueKey('panes')),size.width>=600?findsOneWidget:findsNothing);
          await t.ensureVisible(clock);await t.pump();final rect=t.getRect(clock);
          for(final frac in [.2,.8]){await t.tapAt(Offset(rect.left+rect.width*frac,rect.center.dy));await t.pump();}
          expect(seeks.length,2);expect(seeks[1],greaterThan(seeks[0]));
          for(final label in (lang=='ar'?['حفظ النطاق','تصدير الجزء المحدد']:['Save range','Export selection'])){
            final button=find.text(label);await t.ensureVisible(button);await t.pump();expect(button.hitTestable(),findsOneWidget);
            final r=t.getRect(button);expect(r.left,greaterThanOrEqualTo(0));expect(r.right,lessThanOrEqualTo(size.width));
          }
          expect(t.takeException(),isNull);await t.pumpWidget(const SizedBox());await t.pump();ctrl.dispose();messenger.setMockMethodCallHandler(api,null);messenger.setMockMethodCallHandler(SystemChannels.platform_views,null);
        });
      }
    }
  }
}
