import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:max_editor/app/locale_controller.dart';
import 'package:max_editor/app/max_editor_app.dart';
import 'package:max_editor/features/settings/locale_preferences.dart';

class MemoryPreferences implements LocalePreferences {
  String? stored;
  bool fail = false;
  @override
  Future<String?> readTag() async => stored;
  @override
  Future<void> writeTag(String tag) async {
    if (fail) throw Exception();
    stored = tag;
  }
}

void main() {
  test('Unavailable saved languages fall back to Arabic', () async {
    final prefs = MemoryPreferences()..stored = 'unknown';
    final controller = LocaleController(prefs);
    await controller.restore();
    expect(controller.locale, const Locale('ar'));
  });

  testWidgets('Arabic RTL → English LTR → Arabic RTL, with persisted choice', (tester) async {
    final prefs = MemoryPreferences();
    final controller = LocaleController(prefs);
    await controller.restore();
    await tester.pumpWidget(MaxEditorApp(controller: controller));
    await tester.pumpAndSettle();
    TextDirection direction(String title) => Directionality.of(tester.element(find.text(title)));
    expect(direction('الإعدادات'), TextDirection.rtl);
    await tester.tap(find.byKey(const ValueKey('en')));
    await tester.pumpAndSettle();
    expect(direction('Settings'), TextDirection.ltr);
    final restored = LocaleController(prefs);
    await restored.restore();
    expect(restored.locale, const Locale('en'));
    await tester.tap(find.byKey(const ValueKey('ar')));
    await tester.pumpAndSettle();
    expect(direction('الإعدادات'), TextDirection.rtl);
    expect(prefs.stored, 'ar');
  });

  testWidgets('Storage failure keeps the old language and reports in that language', (tester) async {
    final prefs = MemoryPreferences()..fail = true;
    await tester.pumpWidget(MaxEditorApp(controller: LocaleController(prefs)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('en')));
    await tester.pumpAndSettle();
    expect(find.text('الإعدادات'), findsOneWidget);
    expect(find.byType(SnackBar), findsOneWidget);
    expect(prefs.stored, isNull);
  });
}
