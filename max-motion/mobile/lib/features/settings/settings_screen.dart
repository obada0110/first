import 'package:flutter/material.dart';
import '../../app/locale_controller.dart';
import '../../app/design/max_theme.dart';
import '../../l10n/generated/app_localizations.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, required this.controller});
  final LocaleController controller;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _saving = false;

  Future<void> _select(Locale? value) async {
    if (value == null || _saving) return;
    setState(() => _saving = true);
    try {
      await widget.controller.select(value);
    } on Exception {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppLocalizations.of(context).saveFailed)),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: const BrandMark()),
      body: SafeArea(child: Center(child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 600),
        child: ListView(padding: const EdgeInsetsDirectional.fromSTEB(16, 16, 16, 24), children: [
          Text(text.settings, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Text(text.settingsHint),
          const SizedBox(height: 24),
          Semantics(header: true, child: Text(text.language, style: Theme.of(context).textTheme.titleMedium)),
          MxPanel(child: RadioGroup<Locale>(
            groupValue: widget.controller.locale,
            onChanged: _select,
            child: Column(children: [
              for (final locale in AppLocalizations.supportedLocales)
                RadioListTile<Locale>(
                  key: ValueKey(locale.toLanguageTag()),
                  enabled: !_saving,
                  value: locale,
                  title: Text(lookupAppLocalizations(locale).languageName),
                ),
            ]),
          )),
        ]),
      ))),
    );
  }
}
