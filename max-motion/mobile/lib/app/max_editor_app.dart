import 'package:flutter/material.dart';
import '../features/single/single_screen.dart';
import '../l10n/generated/app_localizations.dart';
import 'locale_controller.dart';

class MaxEditorApp extends StatelessWidget {
  const MaxEditorApp({super.key, required this.controller});
  final LocaleController controller;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) => MaterialApp(
      debugShowCheckedModeBanner: false,
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      locale: controller.locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6CE6BD), brightness: Brightness.dark),
        useMaterial3: true,
      ),
      home: SingleScreen(controller: controller),
    ),
  );
}
