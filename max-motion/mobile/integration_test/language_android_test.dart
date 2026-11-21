import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:max_editor/app/locale_controller.dart';
import 'package:max_editor/main.dart' as app;
import 'package:max_editor/platform/android_locale_preferences.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('real Android preference channel and live layout direction', (tester) async {
    const prefs = AndroidLocalePreferences();
    final before = await prefs.readTag();
    try {
      await app.main();
      await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('settings')));
    await tester.pumpAndSettle();
      for (final tag in ['ar', 'en', 'ar']) {
        await tester.tap(find.byKey(ValueKey(tag)));
        await tester.pumpAndSettle();
        final ctx = tester.element(find.byKey(ValueKey(tag)));
        expect(Localizations.localeOf(ctx).languageCode, tag);
        expect(Directionality.of(ctx), tag == 'ar' ? TextDirection.rtl : TextDirection.ltr);
        final restored = LocaleController(prefs);
        await restored.restore();
        expect(restored.locale.languageCode, tag);
      }
    } finally {
      await prefs.writeTag(before ?? 'ar');
    }
  });
}
