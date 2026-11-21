/// Port for a non-sensitive, device-local language preference.
abstract interface class LocalePreferences {
  Future<String?> readTag();
  Future<void> writeTag(String tag);
}
