import 'package:flutter/widgets.dart';
import 'app/locale_controller.dart';
import 'app/max_editor_app.dart';
import 'platform/android_locale_preferences.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final controller = LocaleController(const AndroidLocalePreferences());
  await controller.restore();
  runApp(MaxEditorApp(controller: controller));
}
