import 'package:flutter/services.dart';
import '../features/settings/locale_preferences.dart';

class AndroidLocalePreferences implements LocalePreferences {
  const AndroidLocalePreferences();
  static const _channel = MethodChannel('max_editor/settings');

  @override
  Future<String?> readTag() => _channel.invokeMethod<String>('readLocale');

  @override
  Future<void> writeTag(String tag) => _channel.invokeMethod<void>('writeLocale', tag);
}
