import 'package:flutter/widgets.dart';
import '../features/settings/locale_preferences.dart';
import '../l10n/generated/app_localizations.dart';

class LocaleController extends ChangeNotifier {
  LocaleController(this._preferences);
  final LocalePreferences _preferences;
  Locale _locale = const Locale('ar');
  Locale get locale => _locale;

  Future<void> restore() async {
    // Ignore missing, obsolete or unreadable settings; first launch is Arabic
    // regardless of the device's language.
    String? tag;
    try {
      tag = await _preferences.readTag();
    } on Exception {
      tag = null;
    }
    _locale = AppLocalizations.supportedLocales.firstWhere(
      (item) => item.toLanguageTag() == tag,
      orElse: () => const Locale('ar'),
    );
    notifyListeners();
  }

  Future<void> select(Locale value) async {
    if (_locale == value || !AppLocalizations.supportedLocales.contains(value)) return;
    await _preferences.writeTag(value.toLanguageTag());
    _locale = value;
    notifyListeners();
  }
}
